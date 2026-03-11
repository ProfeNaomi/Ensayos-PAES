import React, { useState } from "react";
import { QuizQuestion } from "../lib/gemini";
import { AITutor } from "./AITutor";
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Bot, Trophy, Info, Sparkles, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface QuizRunnerProps {
  questions: QuizQuestion[];
  onRestart: () => void;
}

export function QuizRunner({ questions, onRestart }: QuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [score, setScore] = useState(0);

  const question = questions[currentIndex];
  const isCorrect = selectedOption === question.correctOptionIndex;

  const handleSelect = (index: number) => {
    if (isAnswered) return;
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
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                   <div className="text-xs font-black text-slate-400 uppercase mb-1">Efectividad</div>
                   <div className="text-2xl font-black text-slate-800">{Math.round((score/questions.length)*100)}%</div>
                </div>
                <div className="p-4 bg-white rounded-2xl shadow-sm">
                   <div className="text-xs font-black text-slate-400 uppercase mb-1">Preguntas</div>
                   <div className="text-2xl font-black text-slate-800">{questions.length}</div>
                </div>
             </div>
          </div>

          <button
            onClick={onRestart}
            className="w-full btn-premium py-4 text-lg"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Volver al Repositorio</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-slate-50 overflow-hidden">
      {/* Question Column - 75% Width */}
      <div className="w-full lg:w-[75%] h-full overflow-y-auto p-4 md:p-10 border-r border-slate-200">
        <div className="max-w-5xl mx-auto space-y-6 pb-20">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/40 border border-slate-100"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-6 py-2.5 rounded-2xl border border-indigo-100/50">
                  PREGUNTA {question.id || currentIndex + 1}
                </span>
                <div className="flex space-x-1.5">
                  {questions.map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all duration-500",
                        i === currentIndex ? "w-10 bg-indigo-600 shadow-lg shadow-indigo-100" : i < currentIndex ? "bg-emerald-400" : "bg-slate-200"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  {score} Aciertos
                </span>
              </div>
            </div>

            {/* Question Box - Taking full advantage of 75% width */}
            <div className="mb-12">
              {question.imageBase64 ? (
                <div className="rounded-3xl overflow-hidden border-2 border-slate-100 bg-white shadow-inner p-2">
                  <img 
                    src={question.imageBase64} 
                    alt="Pregunta" 
                    className="w-full max-h-[65vh] object-contain mx-auto transition-transform hover:scale-[1.02] duration-500"
                  />
                </div>
              ) : (
                <div className="prose prose-slate prose-xl max-w-none font-medium leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {question.text}
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
                      "group w-full text-left p-5 rounded-2xl border-2 transition-all flex items-start space-x-4",
                      !isAnswered 
                        ? (isSelected ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 hover:border-indigo-200 hover:bg-slate-50")
                        : (isCorrectOption ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100 z-10" : 
                          (isSelected ? "border-red-400 bg-red-50 opacity-100" : "border-slate-100 opacity-40"))
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-300",
                      isAnswered && isCorrectOption ? "bg-emerald-500 border-emerald-500 text-white" :
                      isAnswered && isSelected && !isCorrectOption ? "bg-red-500 border-red-500 text-white" :
                      isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-400 group-hover:border-indigo-300"
                    )}>
                      {isAnswered && isCorrectOption ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isAnswered && isSelected && !isCorrectOption ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-black">{String.fromCharCode(65 + idx)}</span>
                      )}
                    </div>
                    <div className={cn(
                      "flex-1 prose prose-sm max-w-none",
                      isSelected || (isAnswered && isCorrectOption) ? "font-bold" : "font-medium"
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
                  className="mt-10"
                >
                   {isCorrect && (
                      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 mb-6 flex items-start space-x-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-2 bg-emerald-500 rounded-lg text-white">
                           <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                           <h4 className="font-black text-emerald-900 leading-none mb-1">¡Respuesta Correcta!</h4>
                           <p className="text-sm text-emerald-700 font-medium">Sigue así, vas por muy buen camino.</p>
                        </div>
                      </div>
                   )}
                   
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between pt-6 border-t border-slate-100">
                     {isCorrect && question.explanation && (
                        <div className="flex items-center space-x-2 text-indigo-600 font-bold text-sm cursor-help hover:underline">
                           <Info className="w-4 h-4" />
                           <span>Ver explicación paso a paso</span>
                        </div>
                     )}
                     <div className="flex-1" />
                    <button
                      onClick={handleNext}
                      className="btn-premium px-10 py-4 shadow-xl shadow-indigo-200"
                    >
                      <span className="font-black">{currentIndex < questions.length - 1 ? "Siguiente Pregunta" : "Ver Resultados"}</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Tutor Sidebar - 25% Width */}
      <div className="w-full lg:w-[25%] h-full border-t lg:border-t-0 lg:border-l border-slate-200 bg-white flex flex-col z-10 shadow-2xl">
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
              className="h-full bg-slate-50/50 p-10 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="relative">
                 <div className="w-32 h-32 bg-white shadow-2xl shadow-indigo-100 rounded-[2.5rem] flex items-center justify-center text-indigo-600 animate-float">
                    <Bot className="w-16 h-16" />
                 </div>
                 <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-white">
                    <Sparkles className="w-5 h-5" />
                 </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Tutor IA Personalizado</h3>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Si tienes dudas o te equivocas, mi inteligencia se activará para explicarte el proceso paso a paso.
                </p>
              </div>
              <div className="pt-8 border-t border-slate-200 w-full flex flex-col space-y-2">
                 <div className="flex items-center space-x-2 text-xs font-black text-slate-400 uppercase tracking-widest justify-center">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Basado en Gemini 3.1 Flash</span>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

