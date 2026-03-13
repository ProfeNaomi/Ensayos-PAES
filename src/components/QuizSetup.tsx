import React, { useState } from "react";
import { Loader2, Image as ImageIcon, Sparkles, X, Check } from "lucide-react";
import { generateQuizFromImages, QuizQuestion } from "../lib/gemini";
import { saveQuiz, Quiz } from "../lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

interface QuizSetupProps {
  onQuizGenerated: (quiz: Quiz) => void;
  user: any;
}

const OPTIONS = ["A", "B", "C", "D", "E"];

export function QuizSetup({ onQuizGenerated, user }: QuizSetupProps) {
  const [individualImages, setIndividualImages] = useState<File[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<Record<number, number>>({});
  const [quizName, setQuizName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const optimizeImage = (base64: string, maxWidth = 1000): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(base64);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (individualImages.length === 0) return;
    if (!quizName.trim()) {
      setError("Por favor, ingresa un nombre para el ensayo.");
      return;
    }

    // Validar que todas las imágenes tengan respuesta
    for (let i = 0; i < individualImages.length; i++) {
        if (correctAnswers[i] === undefined) {
            setError(`Por favor, selecciona la alternativa correcta para la Pregunta ${i + 1} en el Solucionario.`);
            return;
        }
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      let finalQuestions: QuizQuestion[] = [];

      setStatusText("Paso 1/5: Optimizando imágenes...");
      const rawBase64s = await Promise.all(individualImages.map(f => fileToBase64(f)));
      const base64Images = await Promise.all(rawBase64s.map(b => optimizeImage(b)));
      
      setStatusText("Paso 2/5: Analizando con IA...");
      const CHUNK_SIZE = 3;
      for (let i = 0; i < base64Images.length; i += CHUNK_SIZE) {
        const chunk = base64Images.slice(i, i + CHUNK_SIZE);
        const chunkAnswers = individualImages.slice(i, i + CHUNK_SIZE).map((_, idx) => correctAnswers[i + idx]);
        
        const currentProgress = Math.round(((i + chunk.length) / base64Images.length) * 100);
        setProgress(currentProgress);
        setStatusText(`Paso 3/5: Procesando (${currentProgress}%)...`);
        
        const chunkQuestions = await generateQuizFromImages(chunk, [], chunkAnswers);
        
        const mappedQuestions = chunkQuestions.map((q) => {
          const chunkIdx = (q.pageIndex !== undefined && q.pageIndex >= 0 && q.pageIndex < chunk.length) 
            ? q.pageIndex 
            : 0;
            
          const globalIdx = i + chunkIdx;
          
          return {
            ...q,
            imageBase64: chunk[chunkIdx],
            correctOptionIndex: correctAnswers[globalIdx] ?? q.correctOptionIndex
          };
        });
        finalQuestions = [...finalQuestions, ...mappedQuestions];
      }
      
      if (finalQuestions.length === 0) {
        setError("No se pudieron extraer preguntas. Intenta con archivos más claros.");
        setIsGenerating(false);
        return;
      }

      finalQuestions = finalQuestions.sort((a, b) => (a.id || 0) - (b.id || 0));

      setStatusText("Paso 4/5: Subiendo datos a la nube...");
      const finalTitle = quizName.trim();
      
      const quizId = await saveQuiz({
        title: finalTitle,
        questions: finalQuestions,
      }, user.uid);

      setStatusText("Paso 5/5: Finalizando...");

      onQuizGenerated({
        id: quizId,
        title: finalTitle,
        questions: finalQuestions,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al procesar el ensayo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setIndividualImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setIndividualImages(prev => {
        const newImages = [...prev];
        newImages.splice(index, 1);
        return newImages;
    });

    setCorrectAnswers(prev => {
        const newAns: Record<number, number> = {};
        const entries = Object.entries(prev)
            .map(([k, v]) => [parseInt(k), v])
            .filter(([k]) => k !== index)
            .map(([k, v]) => [k > index ? k - 1 : k, v]);
        
        entries.forEach(([k, v]) => {
            newAns[k as number] = v as number;
        });
        return newAns;
    });
  };

  const handleSetAnswer = (imageIndex: number, optionIndex: number) => {
      setCorrectAnswers(prev => ({
          ...prev,
          [imageIndex]: optionIndex
      }));
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-10 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-4">
            <ImageIcon className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Portal de Creación Docente</h2>
        <p className="text-slate-500 font-medium">Sube las imágenes del ensayo y marca la alternativa correcta para cada una.</p>
      </div>

      <div className="space-y-8">
        {/* Quiz Name */}
        <div className="space-y-3">
          <label htmlFor="quiz-name" className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
            Título del Ensayo
          </label>
          <input
            type="text"
            id="quiz-name"
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
            placeholder="Ej: Ensayo M1 Matemáticas"
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold text-slate-700 shadow-inner"
            disabled={isGenerating}
          />
        </div>

        {/* Images Mode */}
        <div className="space-y-4">
          <div className="flex items-center justify-between ml-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                Fotos de las Preguntas
            </label>
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {individualImages.length} {individualImages.length === 1 ? 'Foto' : 'Fotos'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <AnimatePresence mode="popLayout">
              {individualImages.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${idx}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden group border border-slate-200 shadow-sm"
                >
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="preview" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                  />
                  <div className="absolute top-2 left-2 w-7 h-7 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-lg">
                    {idx + 1}
                  </div>
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-white/95 text-rose-500 rounded-lg shadow-sm hover:bg-rose-500 hover:text-white transition-all transform hover:scale-110"
                    title="Eliminar imagen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-0 left-0 w-full bg-white/80 backdrop-blur-sm p-2 text-[10px] text-slate-800 font-bold truncate">
                    {file.name}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <label 
              className="aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 cursor-pointer bg-slate-50 transition-all hover:bg-indigo-50/50 hover:shadow-inner group"
              htmlFor="multi-image-upload"
            >
              <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-center px-4 leading-tight">Agregar Foto de Pregunta</span>
              <input
                type="file"
                id="multi-image-upload"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Solucionario Section */}
        {individualImages.length > 0 && (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-4 pt-4 border-t border-slate-100"
            >
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                Solucionario (Claves)
              </label>
              <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-[2rem] space-y-3 shadow-inner">
                {individualImages.map((file, imgIdx) => (
                  <div key={`ans-${imgIdx}`} className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 group hover:border-indigo-200 transition-colors">
                     <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">
                          {imgIdx + 1}
                        </div>
                        <span className="text-sm font-bold text-slate-600">Pregunta {imgIdx + 1}</span>
                     </div>
                     <div className="flex items-center space-x-2">
                        {OPTIONS.map((opt, optIdx) => {
                            const isSelected = correctAnswers[imgIdx] === optIdx;
                            return (
                                <button
                                   key={opt}
                                   onClick={() => handleSetAnswer(imgIdx, optIdx)}
                                   className={cn(
                                       "w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-all border-2",
                                       isSelected 
                                          ? "bg-emerald-500 border-emerald-500 text-white scale-110 shadow-lg shadow-emerald-200" 
                                          : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                                   )}
                                >
                                   {isSelected ? <Check className="w-5 h-5" /> : opt}
                                </button>
                            )
                        })}
                     </div>
                  </div>
                ))}
              </div>
            </motion.div>
        )}

        {isGenerating && (
          <div className="space-y-4 pt-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                   <span className="text-sm font-black text-slate-700">{statusText}</span>
                </div>
                <span className="text-sm font-black text-indigo-600">{progress}%</span>
             </div>
             <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                />
             </div>
          </div>
        )}

        {error && (
          <div className="p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-bold flex items-center space-x-3">
             <X className="w-5 h-5 shrink-0" />
             <span>{error}</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating || individualImages.length === 0}
          className="w-full btn-premium py-5 text-xl mt-6 shadow-2xl shadow-indigo-100"
        >
          {isGenerating ? (
              <span>Procesando...</span>
          ) : (
            <>
               <Sparkles className="w-6 h-6 " />
               <span>Generar Ensayo IA</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
