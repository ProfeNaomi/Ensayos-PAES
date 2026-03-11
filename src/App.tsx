import React, { useState, useEffect } from 'react';
import { QuizSetup } from './components/QuizSetup';
import { QuizRunner } from './components/QuizRunner';
import { LoginModal } from './components/LoginModal';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Clock, 
  GraduationCap, 
  UserCog, 
  LogOut, 
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { getQuizzes, deleteQuiz, Quiz } from './lib/db';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setRole('teacher');
      } else {
        setRole('student');
      }
      setIsLoading(false);
    });
    loadQuizzes();
    return () => unsubscribe();
  }, []);

  const loadQuizzes = async () => {
    const loaded = await getQuizzes();
    setQuizzes(loaded);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar este ensayo?')) {
      await deleteQuiz(id);
      await loadQuizzes();
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRole('student');
    setCurrentQuiz(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <BookOpen className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => {
              setCurrentQuiz(null);
              setIsCreating(false);
            }}
          >
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                PAES<span className="text-indigo-600">TUTOR</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Inteligencia Artificial</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* View Mode */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
              <button
                onClick={() => { setRole('student'); setCurrentQuiz(null); setIsCreating(false); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2",
                  role === 'student' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <GraduationCap className="w-4 h-4" />
                <span className="hidden md:inline">Alumno</span>
              </button>
              
              <button
                onClick={() => {
                  if (user) {
                    setRole('teacher');
                    setCurrentQuiz(null);
                  } else {
                    setIsLoginOpen(true);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center space-x-2",
                  role === 'teacher' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <UserCog className="w-4 h-4" />
                <span className="hidden md:inline">Profesora</span>
                {user && <ShieldCheck className="w-3 h-3 text-indigo-400" />}
              </button>
            </div>

            {user && (
              <button
                onClick={handleLogout}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={cn(
        "mx-auto transition-all duration-500",
        currentQuiz ? "w-full h-[calc(100vh-5rem)]" : "max-w-7xl px-4 sm:px-6 lg:px-8 py-12"
      )}>
        <AnimatePresence mode="wait">
          {currentQuiz ? (
            <motion.div
              key="quiz-runner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full"
            >
              <QuizRunner 
                questions={currentQuiz.questions} 
                onRestart={() => setCurrentQuiz(null)} 
              />
            </motion.div>
          ) : isCreating && role === 'teacher' ? (
            <motion.div
              key="quiz-setup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="mb-8">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="text-indigo-600 font-bold flex items-center space-x-2 hover:translate-x-1 transition-transform"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  <span>Volver al Repositorio</span>
                </button>
              </div>
              <QuizSetup onQuizGenerated={(q) => { loadQuizzes(); setCurrentQuiz(q); setIsCreating(false); }} />
            </motion.div>
          ) : (
            <motion.div
              key="repository"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Hero Section */}
              <div className="relative overflow-hidden bg-indigo-600 rounded-[2.5rem] p-8 md:p-16 text-white shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-64 h-64 bg-violet-500 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 max-w-2xl">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center space-x-2 bg-indigo-500/30 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold mb-6 border border-white/10"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>Potenciado con Gemini 3.1</span>
                  </motion.div>
                  <h2 className="text-4xl md:text-6xl font-black mb-6 leading-[1.1]">
                    Tu camino a la <span className="text-yellow-300">Universidad</span> comienza aquí.
                  </h2>
                  <p className="text-lg md:text-xl text-indigo-100 mb-8 font-medium leading-relaxed">
                    Practica con ensayos reales y obtén retroalimentación instantánea de nuestra IA. 
                    Aprende de cada error y mejora tu puntaje paso a paso.
                  </p>
                  
                  {role === 'teacher' && (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="group bg-white text-indigo-600 hover:bg-slate-50 px-8 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl flex items-center space-x-3"
                    >
                      <Plus className="w-6 h-6" />
                      <span>Subir Nuevo Ensayo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quiz List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center space-x-3">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    <span>Ensayos Disponibles</span>
                  </h3>
                  <div className="text-sm font-bold text-slate-400 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                    {quizzes.length} {quizzes.length === 1 ? 'Ensayo' : 'Ensayos'} encontrados
                  </div>
                </div>

                {quizzes.length === 0 ? (
                  <div className="bg-white border-2 border-slate-200 border-dashed rounded-[2rem] p-16 text-center">
                    <div className="w-24 h-24 bg-slate-100 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-6">
                      <BookOpen className="w-12 h-12" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Aún no hay material disponible</h4>
                    <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
                      {role === 'teacher' 
                        ? 'Empieza por subir un PDF con preguntas tipo PAES. Nuestra IA se encargará de extraerlas y crear el cuestionario.'
                        : 'Tu profesora aún no ha publicado ensayos. ¡Vuelve pronto para empezar a practicar!'}
                    </p>
                    {role === 'teacher' && (
                      <button
                        onClick={() => setIsCreating(true)}
                        className="btn-premium"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Publicar Primer Ensayo</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {quizzes.map((quiz, idx) => (
                      <motion.div 
                        key={quiz.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => setCurrentQuiz(quiz)}
                        className="card-premium flex flex-col group overflow-hidden"
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 rotate-3 group-hover:rotate-0">
                            <BookOpen className="w-7 h-7" />
                          </div>
                          {role === 'teacher' && (
                            <button
                              onClick={(e) => handleDelete(quiz.id, e)}
                              className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        
                        <h3 className="text-xl font-black text-slate-800 mb-4 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                          {quiz.title}
                        </h3>
                        
                        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Preguntas</span>
                            <span className="text-lg font-black text-slate-800">{quiz.questions.length}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Fecha</span>
                            <div className="flex items-center space-x-1 text-slate-800 font-bold">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="absolute top-0 right-0 mt-4 mr-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                          <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onSuccess={() => { loadQuizzes(); setRole('teacher'); }}
      />
    </div>
  );
}

