import React, { useState, useEffect } from "react";
import { QuizQuestion } from "../lib/gemini";
import { AITutor } from "./AITutor";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, RotateCcw, Bot, Trophy, Info, Sparkles, ShieldCheck, Check } from "lucide-react";
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
      <div className="w-full min-h-screen flex items-center justify-center p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl p-12 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-indigo-600" />
          <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
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
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#f8fafc] overflow-hidden min-h-screen">
      {/* Questions Area */}
      <div className="w-full lg:w-[75%] h-full overflow-y-auto px-6 md:px-12 py-12 custom-scrollbar relative border-r border-slate-200">
        <div className="w-full space-y-10 pb-20">
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center space-x-4">
                  <div className="px-5 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-2">
                     <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pregunta</span>
                     <span className="text-lg font-black text-indigo-600">{currentIndex + 1}</span>
                     <span className="text-slate-300 font-bold">/</span>
                     <span className="text-slate-400 font-bold">{questions.length}</span>
                  </div>
               </div>
               
               <div className="hidden md:flex items-center space-x-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full border border-slate-200 flex items-center">
                     <ShieldCheck className="w-3 h-3 mr-1.5 text-indigo-500" />
                     Digitalizado por IA Profesora Naomi
                  </span>
               </div>
            </div>

            <div className="space-y-8">
               {/* Image Preview if exists */}
               {question.imageBase64 && (
                 <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-2">
                    <img 
                      src={question.imageBase64} 
                      alt="Pregunta original" 
                      className="w-full h-auto rounded-2xl"
                    />
                 </div>
               )}

               {/* Question Text */}
               <div className="prose prose-slate max-w-none prose-p:text-slate-700 prose-p:text-xl prose-p:font-bold prose-p:leading-relaxed prose-strong:text-indigo-600">
                 <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                  >
                   {question.text}
                 </ReactMarkdown>
               </div>

               {/* Options */}
               <div className="grid grid-cols-1 gap-4">
                 {question.options.map((option, idx) => {
                   let stateClasses = "border-slate-200 hover:border-indigo-400 hover:bg-white text-slate-700 hover:shadow-md";
                   
                   if (isAnswered) {
                     if (idx === question.correctOptionIndex) {
                       stateClasses = "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-emerald-100 shadow-lg scale-[1.02] z-10";
                     } else if (idx === selectedOption) {
                       stateClasses = "border-rose-500 bg-rose-50 text-rose-800 opacity-90";
                     } else {
                       stateClasses = "border-slate-100 opacity-50 grayscale-[0.5]";
                     }
                   }

                   return (
                     <button
                       key={idx}
                       onClick={() => handleSelect(idx)}
                       disabled={isAnswered}
                       className={cn(
                         "flex items-start w-full p-5 rounded-2xl border-2 transition-all duration-300 group text-left relative",
                         stateClasses
                       )}
                     >
                       <div className={cn(
                         "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg mr-4 shrink-0 transition-colors",
                         isAnswered && idx === question.correctOptionIndex ? "bg-emerald-500 text-white" : 
                         isAnswered && idx === selectedOption ? "bg-rose-500 text-white" :
                         "bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                       )}>
                         {String.fromCharCode(65 + idx)}
                       </div>
                       
                       <div className="pt-1.5 flex-1 font-bold">
                         <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                           {option}
                         </ReactMarkdown>
                       </div>

                       {isAnswered && idx === question.correctOptionIndex && (
                         <div className="ml-2 flex items-center text-emerald-600">
                            <CheckCircle className="w-6 h-6 fill-emerald-100" />
                         </div>
                       )}
                       {isAnswered && idx === selectedOption && idx !== question.correctOptionIndex && (
                         <div className="ml-2 flex items-center text-rose-600">
                            <XCircle className="w-6 h-6 fill-rose-100" />
                         </div>
                       )}
                     </button>
                   );
                 })}
               </div>
            </div>
          </motion.div>
        </div>

        {/* Footer Navigation */}
        <div className="fixed bottom-0 left-0 w-full lg:w-[75%] bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 md:p-6 z-30">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={handlePrevious}
              className="p-4 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all active:scale-90 border border-transparent hover:border-slate-200"
              disabled={currentIndex === 0}
            >
              <ArrowLeft className="w-6 h-6 " />
            </button>
            
            <div className="flex-1 px-8">
               <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                  <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                     className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full shadow-lg shadow-indigo-100"
                  />
               </div>
            </div>

            {isAnswered ? (
              <button
                onClick={handleNext}
                className="btn-premium py-4 px-8 text-lg animate-pulse hover:animate-none group"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
                <div className="flex items-center text-xs font-black text-slate-300 uppercase tracking-widest pr-4">
                    Selecciona una respuesta
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Side Panel (Tutor) */}
      <div className="w-full lg:w-[25%] h-[400px] lg:h-full bg-white border-l border-slate-200 flex flex-col shadow-2xl relative z-40">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
               <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Tutor IA Stephanie</h3>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">En línea</p>
            </div>
          </div>
          <button 
            onClick={() => setShowTutor(!showTutor)}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {showTutor ? (
            <AITutor 
               question={question} 
               userWrongAnswerIndex={selectedOption ?? -1} 
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 border border-indigo-100">
                <Sparkles className="w-10 h-10 text-indigo-300 animate-pulse" />
              </div>
              <h4 className="text-lg font-black text-slate-800 mb-2">¿Necesitas ayuda?</h4>
              <p className="text-sm font-medium text-slate-400 leading-relaxed mb-6">
                El Tutor IA Stephanie puede explicarte este ejercicio paso a paso después de que respondas.
              </p>
              {isAnswered && (
                  <button 
                    onClick={() => setShowTutor(true)}
                    className="flex items-center space-x-2 text-indigo-600 font-bold hover:underline"
                  >
                    <span>Ver explicación</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
