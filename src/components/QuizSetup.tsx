import React, { useState } from "react";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import { fileToBase64 } from "../lib/utils";
import { generateQuizFromImages, QuizQuestion } from "../lib/gemini";
import { extractQuestionImages } from "../lib/pdf";
import { saveQuiz, Quiz } from "../lib/db";
import { v4 as uuidv4 } from "uuid";

interface QuizSetupProps {
  onQuizGenerated: (quiz: Quiz) => void;
}

export function QuizSetup({ onQuizGenerated }: QuizSetupProps) {
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [solutionsFile, setSolutionsFile] = useState<File | null>(null);
  const [quizName, setQuizName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!questionsFile) return;

    setIsGenerating(true);
    setError(null);

    try {
      setStatusText("Procesando PDF (Páginas a Imágenes)...");
      const { pdfToImages } = await import("../lib/pdf");
      const { generateQuizFromImages } = await import("../lib/gemini");
      
      const questionImages = await pdfToImages(questionsFile);
      const solutionImages = solutionsFile ? await pdfToImages(solutionsFile) : [];

      // PROCESAMIENTO POR LOTES (Chunking) para evitar que la IA se corte
      setStatusText("Iniciando extracción por partes...");
      const CHUNK_SIZE = 3; // Procesar 3 páginas a la vez
      let allQuestions: QuizQuestion[] = [];
      
      for (let i = 0; i < questionImages.length; i += CHUNK_SIZE) {
        const chunk = questionImages.slice(i, i + CHUNK_SIZE);
        const progress = Math.round(((i + chunk.length) / questionImages.length) * 100);
        setStatusText(`Extrayendo preguntas: ${progress}% completado...`);
        
        // Enviamos el trozo de preguntas y las imágenes de soluciones (para que la IA corrija)
        const chunkQuestions = await generateQuizFromImages(chunk, solutionImages);
        allQuestions = [...allQuestions, ...chunkQuestions];
      }
      
      if (allQuestions.length === 0) {
        setError("No se pudieron extraer preguntas. Intenta con un PDF más claro.");
        setIsGenerating(false);
        return;
      }

      setStatusText("Recortando imágenes de las preguntas...");
      const questionsWithImages = await extractQuestionImages(questionsFile, allQuestions);

      setStatusText("Guardando ensayo...");
      const quizId = await saveQuiz({
        title: quizName.trim() || questionsFile.name.replace(".pdf", ""),
        questions: questionsWithImages,
      });

      onQuizGenerated({
        id: quizId,
        title: quizName.trim() || questionsFile.name.replace(".pdf", ""),
        questions: questionsWithImages,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al procesar el ensayo.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Subir Nuevo Ensayo</h2>
        <p className="text-slate-500">Sube tus archivos PDF para generar un cuestionario interactivo con tutoría de IA.</p>
      </div>

      <div className="space-y-6">
        {/* Quiz Name */}
        <div className="space-y-2">
          <label htmlFor="quiz-name" className="block text-sm font-medium text-slate-700">
            Nombre del Ensayo
          </label>
          <input
            type="text"
            id="quiz-name"
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
            placeholder="Ej: Ensayo PAES Matemáticas M1 - Forma 113"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
            disabled={isGenerating}
          />
        </div>

        {/* Questions Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            PDF de Preguntas (Obligatorio)
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
              className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                questionsFile ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
              }`}
            >
              <div className="flex flex-col items-center space-y-2 text-center">
                {questionsFile ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                    <span className="text-emerald-700 font-medium">{questionsFile.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400" />
                    <span className="text-slate-600">Haz clic para subir el PDF de preguntas</span>
                    <span className="text-xs text-slate-400">Solo archivos PDF</span>
                  </>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Solutions Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            PDF de Solucionario (Opcional)
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
              className={`flex items-center justify-center w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                solutionsFile ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
              }`}
            >
              <div className="flex flex-col items-center space-y-2 text-center">
                {solutionsFile ? (
                  <>
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                    <span className="text-emerald-700 font-medium">{solutionsFile.name}</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-8 h-8 text-slate-400" />
                    <span className="text-slate-600">Haz clic para subir el PDF del solucionario</span>
                    <span className="text-xs text-slate-400">Si no lo subes, la IA intentará resolverlas por ti</span>
                  </>
                )}
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!questionsFile || !quizName.trim() || isGenerating}
          className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{statusText || "Procesando..."}</span>
            </>
          ) : (
            <span>Generar Cuestionario</span>
          )}
        </button>
      </div>
    </div>
  );
}
