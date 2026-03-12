import React, { useState } from "react";
import { Upload, FileText, CheckCircle, Loader2, Image as ImageIcon, FileUp, Sparkles, X } from "lucide-react";
import { generateQuizFromImages, QuizQuestion } from "../lib/gemini";
import { extractQuestionImages, pdfToImages } from "../lib/pdf";
import { saveQuiz, Quiz } from "../lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

interface QuizSetupProps {
  onQuizGenerated: (quiz: Quiz) => void;
  user: any;
}

type SetupMode = "pdf" | "images";

export function QuizSetup({ onQuizGenerated, user }: QuizSetupProps) {
  const [mode, setMode] = useState<SetupMode>("pdf");
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [solutionsFile, setSolutionsFile] = useState<File | null>(null);
  const [individualImages, setIndividualImages] = useState<File[]>([]);
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
        resolve(canvas.toDataURL("image/jpeg", 0.7)); // Compresión al 70%
      };
      img.onerror = () => resolve(base64); // Fallback si falla optimización
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
    if (mode === "pdf" && !questionsFile) return;
    if (mode === "images" && individualImages.length === 0) return;
    if (!quizName.trim()) {
      setError("Por favor, ingresa un nombre para el ensayo.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      let finalQuestions: QuizQuestion[] = [];
      const solutionImages: string[] = solutionsFile ? await pdfToImages(solutionsFile) : [];

      if (mode === "pdf" && questionsFile) {
        setStatusText("Paso 1/5: Procesando PDF...");
        const questionImages = await pdfToImages(questionsFile);

        setStatusText("Paso 2/5: Iniciando extracción...");
        const CHUNK_SIZE = 3; 
        
        for (let i = 0; i < questionImages.length; i += CHUNK_SIZE) {
          const chunk = questionImages.slice(i, i + CHUNK_SIZE);
          const currentProgress = Math.round(((i + chunk.length) / questionImages.length) * 100);
          setProgress(currentProgress);
          setStatusText(`Paso 3/5: Extrayendo preguntas (${currentProgress}%)...`);
          
          const chunkQuestions = await generateQuizFromImages(chunk, solutionImages);
          finalQuestions = [...finalQuestions, ...chunkQuestions];
        }

        setStatusText("Recortando imágenes de las preguntas...");
        finalQuestions = await extractQuestionImages(questionsFile, finalQuestions);

      } else if (mode === "images" && individualImages.length > 0) {
        setStatusText("Paso 1/5: Optimizando imágenes...");
        const rawBase64s = await Promise.all(individualImages.map(f => fileToBase64(f)));
        const base64Images = await Promise.all(rawBase64s.map(b => optimizeImage(b)));
        
        setStatusText("Paso 2/5: Analizando con IA...");
        const CHUNK_SIZE = 3;
        for (let i = 0; i < base64Images.length; i += CHUNK_SIZE) {
          const chunk = base64Images.slice(i, i + CHUNK_SIZE);
          const currentProgress = Math.round(((i + chunk.length) / base64Images.length) * 100);
          setProgress(currentProgress);
          setStatusText(`Paso 3/5: Procesando (${currentProgress}%)...`);
          const chunkQuestions = await generateQuizFromImages(chunk, []);
          
          // Mapear el imageBase64 original a cada pregunta
          // IMPORTANTE: pageIndex del AI debe estar entre 0 y chunk.length-1
          const mappedQuestions = chunkQuestions.map(q => {
            const imageIdx = (q.pageIndex !== undefined && q.pageIndex >= 0 && q.pageIndex < chunk.length) 
              ? q.pageIndex 
              : 0; // Fallback al primero si falla la IA
            
            return {
              ...q,
              imageBase64: chunk[imageIdx]
            };
          });
          finalQuestions = [...finalQuestions, ...mappedQuestions];
        }
      }
      
      if (finalQuestions.length === 0) {
        setError("No se pudieron extraer preguntas. Intenta con archivos más claros.");
        setIsGenerating(false);
        return;
      }

      // Limpiar duplicados y ordenar
      const uniqueQuestions = finalQuestions
        .filter((q, index, self) =>
          index === self.findIndex((t) => t.text.trim() === q.text.trim())
        )
        .sort((a, b) => (a.id || 0) - (b.id || 0));

      setStatusText("Paso 4/5: Subiendo imágenes a la nube...");
      const finalTitle = quizName.trim();
      
      const quizId = await saveQuiz({
        title: finalTitle,
        questions: uniqueQuestions,
      }, user.uid);

      setStatusText("Paso 5/5: Finalizando...");

      onQuizGenerated({
        id: quizId,
        title: finalTitle,
        questions: uniqueQuestions,
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
    setIndividualImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-10 bg-slate-900/60 backdrop-blur rounded-[2.5rem] shadow-xl border border-indigo-500/20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-slate-100 mb-3 tracking-tight">Portal de Creación Docente</h2>
        <p className="text-slate-400 font-medium">Sube tus guías en PDF o imágenes separadas para crear tu ensayo.</p>
      </div>

      <div className="flex bg-slate-800/50 p-1.5 rounded-2xl mb-10">
        <button
          onClick={() => setMode("pdf")}
          className={cn(
            "flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all",
            mode === "pdf" ? "bg-slate-900/60 backdrop-blur text-indigo-400 shadow-lg" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <FileUp className="w-4 h-4" />
          <span>Modo PDF</span>
        </button>
        <button
          onClick={() => setMode("images")}
          className={cn(
            "flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all",
            mode === "images" ? "bg-slate-900/60 backdrop-blur text-indigo-400 shadow-lg" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Modo Imágenes</span>
        </button>
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
            className="w-full px-6 py-4 bg-slate-900/40 border-2 border-slate-50 rounded-2xl focus:bg-slate-900/60 backdrop-blur focus:border-indigo-500 transition-all outline-none font-bold text-slate-200"
            disabled={isGenerating}
          />
        </div>

        {mode === "pdf" ? (
          <>
            {/* Questions Upload */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                PDF de Preguntas
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setQuestionsFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="questions-upload"
                />
                <label
                  htmlFor="questions-upload"
                  className={`flex items-center justify-center w-full p-10 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${
                    questionsFile ? "border-emerald-500 bg-emerald-500/10/50" : "border-slate-700 hover:border-indigo-400 hover:bg-slate-900/40"
                  }`}
                >
                  <div className="flex flex-col items-center space-y-3 text-center">
                    {questionsFile ? (
                      <>
                        <CheckCircle className="w-10 h-10 text-emerald-500" />
                        <span className="text-emerald-200 font-bold text-lg">{questionsFile.name}</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-10 h-10 text-slate-400" />
                        <span className="text-slate-300 font-bold">Haz clic para subir el PDF</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Solutions Upload */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                Solucionario PDF (Opcional)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSolutionsFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="solutions-upload"
                />
                <label
                  htmlFor="solutions-upload"
                  className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                    solutionsFile ? "border-indigo-500 bg-indigo-500/20/30" : "border-slate-700 hover:bg-slate-900/40"
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2 text-center">
                    {solutionsFile ? (
                       <span className="text-indigo-700 font-bold">{solutionsFile.name}</span>
                    ) : (
                      <>
                        <FileText className="w-6 h-6 text-slate-300" />
                        <span className="text-slate-400 font-bold text-sm">Cargar pauta de respuestas</span>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Fotos de las Preguntas
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <AnimatePresence>
                {individualImages.map((file, idx) => (
                  <motion.div
                    key={`${file.name}-${idx}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="relative aspect-square bg-slate-800/50 rounded-2xl overflow-hidden group border border-slate-700"
                  >
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="preview" 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 p-1 bg-slate-900/60 backdrop-blur/90 text-red-500 rounded-full shadow-lg hover:bg-slate-900/60 backdrop-blur"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 w-full bg-black/50 p-2 text-[10px] text-white font-bold truncate">
                      {idx + 1}. {file.name}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <label 
                className="aspect-square border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-400 cursor-pointer bg-slate-900/40 transition-all hover:bg-slate-800/50"
                htmlFor="multi-image-upload"
              >
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">Agregar Fotos</span>
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
        )}

        {isGenerating && (
          <div className="space-y-4 pt-4">
             <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                   <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                   <span className="text-sm font-black text-slate-200">{statusText}</span>
                </div>
                <span className="text-sm font-black text-indigo-400">{progress}%</span>
             </div>
             <div className="w-full h-3 bg-slate-800/50 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${progress}%` }}
                   className="h-full bg-indigo-600 rounded-full shadow-lg shadow-indigo-200"
                />
             </div>
          </div>
        )}

        {error && (
          <div className="p-5 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-2xl text-sm font-bold">
             {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!questionsFile && individualImages.length === 0)}
          className="w-full btn-premium py-5 text-xl mt-6 shadow-2xl shadow-indigo-100"
        >
          {isGenerating ? (
              <span>Procesando...</span>
          ) : (
            <>
               <Sparkles className="w-6 h-6" />
               <span>Generar Cuestionario IA</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
