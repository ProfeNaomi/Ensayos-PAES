import React, { useState, useEffect } from "react";
import { QuizQuestion } from "../lib/gemini";
import { AITutor } from "./AITutor";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, RotateCcw, Bot, Trophy, Info, Sparkles, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { saveQuizResult } from "../lib/db";

interface QuizRunnerProps {
  questions: QuizQuestion[];
  quizId: string;
  quizTitle: string;
  user: any;
  onRestart: () => void;
}

export function QuizRunner({ questions, quizId, quizTitle, user, onRestart }: QuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [score, setScore] = useState(0);
  const [hasSavedResult, setHasSavedResult] = useState(false);

  const question = questions[currentIndex];
  // Guard for result screen or out of bounds
  const hasQuestion = question !== undefined;
  const isCorrect = hasQuestion && selectedOption === question.correctOptionIndex;

  // Guardar resultado al finalizar
  useEffect(() => {
    const saveResult = async () => {
      if (currentIndex >= questions.length && user && !hasSavedResult) {
        try {
          await saveQuizResult({
            quizId,
            quizTitle,
            userId: user.uid,
            userName: user.displayName || user.email,
            score,
            totalQuestions: questions.length
          });
          setHasSavedResult(true);
        } catch (error) {
          console.error("Error guardando el resultado:", error);
        }
      }
    };
    saveResult();
  }, [currentIndex, questions.length, user, quizId, quizTitle, score, hasSavedResult]);

  const handleSelect = (index: number) => {
    if (isAnswered || !hasQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);

    if (index === question.correctOptionIndex) {
      setScore((s) => s + 1);
    } else {
      setShowTutor(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((c) => c + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowTutor(false);
    } else {
      setCurrentIndex(questions.length);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((c) => c - 1);
      setSelectedOption(null); 
      setIsAnswered(false);
      setShowTutor(false);
    }
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-50">
        <Bot className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">No hay preguntas disponibles</h2>
        <button onClick={onRestart} className="mt-4 text-indigo-600 font-bold underline">Volver al Repositorio</button>
      </div>
    );
  }

  if (currentIndex >= questions.length) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl p-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-indigo-600" />
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Trophy className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">¡Misión cumplida!</h2>
          <p className="text-xl text-slate-500 mb-10 font-medium">
            Has completado este ensayo con <span className="text-indigo-600 font-black">{score}</span> de {questions.length} correctas.
          </p>
          
          <div className="bg-slate-50 rounded-3xl p-6 mb-10 border border-slate-100">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl shadow-sm text-center">
                   <div className="text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Efectividad</div>
                   <div className="text-3xl font-black text-slate-800">{Math.round((score / questions.length) * 100)}%</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm text-center">
                   <div className="text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">Preguntas</div>
                   <div className="text-3xl font-black text-slate-800">{questions.length}</div>
                </div>
             </div>
          </div>

          <button
            onClick={onRestart}
            className="w-full btn-premium py-5 text-lg group"
          >
            <RotateCcw className="w-5 h-5 group-hover:rotate-[-45deg] transition-transform" />
            <span>Volver al Repositorio</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#f8fafc] overflow-hidden">
      {/* Questions Area */}
      <div className="w-full lg:w-[75%] h-full overflow-y-auto px-6 md:px-12 py-12 custom-scrollbar relative border-r border-slate-100">
        <div className="w-full space-y-10 pb-20">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-5 py-2 rounded-xl border border-indigo-100 tracking-tight">
                  PREGUNTA {question.id || currentIndex + 1}
                </span>
                <div className="hidden sm:flex space-x-1.5 ">
                  {questions.slice(0, 10).map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-2 h-2 rounded-full transition-all duration-500",
                        i === currentIndex ? "w-8 bg-indigo-600" : i < currentIndex ? "bg-emerald-400" : "bg-slate-200"
                      )}
                    />
                  ))}
                  {questions.length > 10 && <span className="text-[10px] text-slate-300 font-bold">...</span>}
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-white px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">
                   {score}/{questions.length} Correctas
                </span>
                <div className="w-px h-3 bg-slate-200" />
                <span className="text-xs font-black text-indigo-600">{Math.round((score/questions.length)*100)}%</span>
              </div>
            </div>

            {/* Question Area */}
            <div className="mb-12">
              {(question.imageBase64 || (question as any).imageUrl) ? (
                <div className="relative group overflow-visible">
                  <div className="absolute -inset-8 bg-indigo-500/5 rounded-[4rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <img 
                    src={question.imageBase64 || (question as any).imageUrl} 
                    alt="Pregunta" 
                    className="relative w-full object-contain max-h-[75vh] rounded-[2.5rem] shadow-2xl shadow-slate-200/40 block mx-auto py-8 px-6 bg-white border border-white"
                  />
                </div>
              ) : (
                <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-white prose prose-slate prose-xl max-w-none font-black text-slate-800 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {question.text.trim().startsWith('{') ? "Error al extraer el texto de la imagen." : question.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-4">
              {question.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectOption = idx === question.correctOptionIndex;
                
                return (
                  <motion.button
                    key={idx}
                    whileHover={!isAnswered ? { scale: 1.01, x: 5 } : {}}
                    whileTap={!isAnswered ? { scale: 0.99 } : {}}
                    onClick={() => handleSelect(idx)}
                    disabled={isAnswered}
                    className={cn(
                      "group w-full text-left p-6 rounded-[1.5rem] border-2 transition-all flex items-start space-x-5",
                      !isAnswered 
                        ? (isSelected ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50")
                        : (isCorrectOption ? "border-emerald-500 bg-emerald-50 shadow-xl shadow-emerald-100/50 z-10" : 
                          (isSelected ? "border-rose-400 bg-rose-50 opacity-100" : "border-slate-100 opacity-40 hover:opacity-100"))
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 font-black",
                      isAnswered && isCorrectOption ? "bg-emerald-500 border-emerald-500 text-white scale-110" :
                      isAnswered && isSelected && !isCorrectOption ? "bg-rose-500 border-rose-500 text-white" :
                      isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-50 border-slate-200 text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-600 group-hover:bg-white"
                    )}>
                      {isAnswered && isCorrectOption ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : isAnswered && isSelected && !isCorrectOption ? (
                        <ArrowLeft className="w-6 h-6 rotate-[-45deg]" /> 
                      ) : (
                        <span className="text-base">{String.fromCharCode(65 + idx)}</span>
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 prose prose-slate max-w-none pt-1",
                      isSelected || (isAnswered && isCorrectOption) ? "font-black text-slate-900" : "font-semibold text-slate-600"
                    )}>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {option}
                      </ReactMarkdown>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {isAnswered && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12"
                >
                   {isCorrect && (
                      <div className="bg-emerald-50 p-7 rounded-[2rem] border border-emerald-100 mb-8 flex items-start space-x-5 shadow-sm">
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                           <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                           <h4 className="font-black text-emerald-900 text-lg leading-none mb-1.5">¡Excelente! Respuesta Correcta</h4>
                           <p className="text-emerald-700 font-bold opacity-80">Vas progresando muy bien. Los puntos clave de esta pregunta se han reforzado.</p>
                        </div>
                      </div>
                   )}
                   
                  <div className="flex flex-col sm:flex-row gap-5 items-center justify-between pt-10 border-t border-slate-100">
                    <button
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                      className="flex items-center space-x-3 px-8 py-4 text-slate-400 hover:text-indigo-600 font-black tracking-tight transition-all disabled:opacity-0"
                    >
                      <ArrowLeft className="w-6 h-6" />
                      <span>Volver Atrás</span>
                    </button>
                    
                    <button
                      onClick={handleNext}
                      className="btn-premium px-14 py-5 shadow-2xl shadow-indigo-100 group"
                    >
                      <span className="font-black text-xl">{currentIndex < questions.length - 1 ? "Siguiente Pregunta" : "Finalizar y Ver Resultados"}</span>
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Tutor Sidebar */}
      <div className="w-full lg:w-[25%] h-full bg-white flex flex-col z-10 shadow-2xl relative overflow-hidden">
        <AnimatePresence mode="wait">
          {showTutor && selectedOption !== null ? (
            <motion.div 
              key="tutor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <AITutor question={question} userWrongAnswerIndex={selectedOption} />
            </motion.div>
          ) : (
            <motion.div 
              key="tutor-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full bg-slate-50/30 p-12 flex flex-col items-center justify-center text-center space-y-10"
            >
              <div className="relative">
                 <div className="w-36 h-36 bg-white shadow-3xl shadow-indigo-100 rounded-[3rem] flex items-center justify-center text-indigo-600 animate-float border border-white">
                    <Bot className="w-20 h-20" />
                 </div>
                 <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-white shadow-lg">
                    <Sparkles className="w-6 h-6" />
                 </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">Tutor IA Socrático</h3>
                <p className="text-slate-500 font-bold leading-relaxed px-4">
                  Analizaré tu razonamiento y te guiaré con pistas precisas para que tú mismo descubras la respuesta correcta.
                </p>
              </div>
              <div className="pt-10 border-t border-slate-200 w-full">
                 <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] justify-center">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Gemini Pro Vision Enabled</span>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
