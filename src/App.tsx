import React, { useState, useEffect } from "react";
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
  ShieldCheck,
  BarChart3,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { getQuizzes, deleteQuiz, Quiz, getUserProfile, getStudentResults, QuizResult } from './lib/db';
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
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [studentResults, setStudentResults] = useState<QuizResult[]>([]);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};

    // Timeout de seguridad: si en 4 segundos no hay respuesta de Firebase, forzamos la entrada
    const safetyTimeout = setTimeout(() => {
      console.log("Carga forzada por timeout");
      setIsLoading(false);
    }, 4000);

    if (auth) {
      try {
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          clearTimeout(safetyTimeout);
          setUser(currentUser);
          setIsLoading(false); // Liberar la pantalla de carga principal inmediatamente
          
          if (currentUser) {
            try {
              const profile = await getUserProfile(currentUser.uid);
              const emailLower = currentUser.email?.toLowerCase() || '';
              const isNaomi = emailLower.includes('naomi') || emailLower === 'naomi.urrea94@gmail.com';
              const effectiveRole = isNaomi ? 'teacher' : (profile?.role || 'student');
              
              console.log("🕵️ DEBUG AUTH:", { email: emailLower, isNaomi, role: effectiveRole });
              
              setRole(effectiveRole);
              
              if (profile) {
                setUserProfile(profile);
              } else {
                setUserProfile({
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  displayName: isNaomi ? 'Profesora Naomi' : 'Estudiante',
                  role: effectiveRole
                });
              }

              if (effectiveRole === 'student') {
                 try {
                   const results = await getStudentResults(currentUser.uid);
                   setStudentResults(results);
                 } catch (err) {
                   console.error("Error loading student results:", err);
                 }
              }
            } catch (e) {
              console.error("Error fetching user profile:", e);
            }
          } else {
            setRole('student');
            setUserProfile(null);
            setStudentResults([]);
          }
        });
      } catch (e) {
        console.error("Error setting up onAuthStateChanged:", e);
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
    
    loadQuizzes();
    return () => unsubscribe();
  }, []);

  // SEGURIDAD EXTRA: Forzar rol de profesora si el correo coincide
  useEffect(() => {
    if (user?.email?.toLowerCase().includes('naomi')) {
      console.log("🚀 Seguridad Extra: Forzando rol de Profesora por email:", user.email);
      setRole('teacher');
    }
  }, [user]);

  const loadQuizzes = async () => {
    const loaded = await getQuizzes();
    setQuizzes(loaded);
  };

  // Failsafe absoluto para Naomi
  const isActuallyTeacher = role === 'teacher' || user?.email?.toLowerCase().includes('naomi');

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
    setShowStats(false);
  };

  const handleLoginSuccess = async (newRole: 'student' | 'teacher') => {
      setRole(newRole);
      loadQuizzes();
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      }
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
      {/* Panel de Sesión y Debug (Solo visible si hay usuario) - ELIMINADO */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end space-y-2 pointer-events-none">
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => {
              setCurrentQuiz(null);
              setIsCreating(false);
              setShowStats(false);
            }}
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 tracking-tight leading-none">
                Plataforma de ejercitación<br/><span className="text-indigo-600">Profe Naomi</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            {user ? (
               <div className="flex items-center space-x-3">
                  {role === 'student' && (
                    <button 
                      onClick={() => { setShowStats(!showStats); setCurrentQuiz(null); setIsCreating(false); }}
                      className={cn(
                        "p-3 rounded-2xl transition-all border",
                        showStats ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-500 hover:text-indigo-600"
                      )}
                    >
                      <BarChart3 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{isActuallyTeacher ? 'Docente' : 'Alumno'}</p>
                    <p className="text-sm font-bold text-slate-700">{userProfile?.displayName || user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
               </div>
            ) : (
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="btn-premium px-6 py-2.5 text-sm"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Ingresar</span>
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
                quizId={currentQuiz.id}
                quizTitle={currentQuiz.title}
                user={user}
                onRestart={() => { setCurrentQuiz(null); loadQuizzes(); }} 
              />
            </motion.div>
          ) : showStats ? (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mi Progreso Académico</h2>
                  <p className="text-slate-500 font-medium">Historial de tus últimos ensayos realizados</p>
                </div>
                <button onClick={() => setShowStats(false)} className="text-indigo-400 font-bold flex items-center space-x-2">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  <span>Volver al Repositorio</span>
                </button>
              </div>

              {studentResults.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-16 text-center shadow-xl border border-slate-200">
                  <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-slate-800">Aún no tienes estadísticas</h3>
                  <p className="text-slate-500 mt-2">Realiza tu primer ensayo para empezar a registrar tu avance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {studentResults.map((res, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-200 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[3rem] -mr-8 -mt-8 transition-all group-hover:scale-110" />
                         <div className="relative z-10">
                            <h4 className="text-xl font-black text-slate-800 mb-2 truncate max-w-[80%]">{res.quizTitle}</h4>
                            <div className="flex items-center text-slate-500 text-sm font-bold mb-6 space-x-2">
                               <Calendar className="w-4 h-4" />
                               <span>{new Date(res.completedAt).toLocaleDateString()}</span>
                            </div>
                            
                            <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Resultado</span>
                                  <span className="text-lg font-black text-indigo-600">{Math.round((res.score/res.totalQuestions)*100)}%</span>
                               </div>
                               <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.2)]" 
                                    style={{ width: `${(res.score/res.totalQuestions)*100}%` }} 
                                  />
                               </div>
                               <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                  <span>{res.score} correctas</span>
                                  <span>{res.totalQuestions} totales</span>
                               </div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              )}
            </motion.div>
          ) : isCreating && isActuallyTeacher ? (
            <motion.div
              key="quiz-setup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
            >
              <div className="mb-8">
                <button 
                   onClick={() => setIsCreating(false)}
                   className="text-indigo-400 font-bold flex items-center space-x-2 hover:translate-x-1 transition-transform"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  <span>Volver al Repositorio</span>
                </button>
              </div>
              <QuizSetup user={user} onQuizGenerated={(q) => { loadQuizzes(); setCurrentQuiz(q); setIsCreating(false); }} />
            </motion.div>
          ) : (
            <motion.div
              key="repository"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col lg:flex-row gap-8"
            >
              {/* Columna Izquierda - Estadísticas Globales */}
              <div className="hidden lg:flex flex-col w-64 shrink-0 space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200">
                  <h4 className="font-black text-slate-800 mb-4 flex items-center"><BarChart3 className="w-5 h-5 mr-2 text-indigo-600" /> Rendimiento Global</h4>
                  {user ? (
                    <div>
                      <div className="text-3xl font-black text-indigo-600 mb-1">
                        {studentResults.reduce((sum, r) => sum + r.score, 0)}/{studentResults.reduce((sum, r) => sum + r.totalQuestions, 0)}
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Respuestas Correctas</p>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full" 
                          style={{width: `${Math.round((studentResults.reduce((sum, r) => sum + r.score, 0) / Math.max(1, studentResults.reduce((sum, r) => sum + r.totalQuestions, 0))) * 100)}%`}}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-500 mb-4 font-medium">Inicia sesión para ver tu progreso global</p>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-indigo-600/30 rounded-full w-1/2"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Central - Contenido Principal */}
              <div className="flex-1 space-y-8">
                {/* Hero Section Reducido */}
                <div className="relative overflow-hidden bg-white rounded-[2rem] p-8 text-slate-800 shadow-xl border border-slate-200">
                  <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                  <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-64 h-64 bg-violet-50 rounded-full blur-3xl opacity-50" />
                  
                  <div className="relative z-10">
                    <h2 className="text-3xl font-black mb-3 leading-[1.1]">
                      {user ? `¡Hola, ${userProfile?.displayName?.split(' ')[0] || 'estudiante'}!` : 'Habilidades del currículum chileno'}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6 font-medium max-w-md">
                      El currículum chileno te permite desarrollar 4 tipos de habilidades fundamentales.
                    </p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-xl">
                      {[
                        { id: 1, title: 'Argumentar y comunicar', desc: 'Describir, explicar, argumentar y evaluar procesos y resultados matemáticos.', icon: <BookOpen className="w-5 h-5 text-indigo-600 mb-1" /> },
                        { id: 2, title: 'Resolver problemas', desc: 'Emplear estrategias para abordar diversas situaciones matemáticas y verificar resultados.', icon: <CheckCircle2 className="w-5 h-5 text-indigo-600 mb-1" /> },
                        { id: 3, title: 'Modelar', desc: 'Aplicar modelos matemáticos y construir versiones abstractas de sistemas reales.', icon: <BarChart3 className="w-5 h-5 text-indigo-600 mb-1" /> },
                        { id: 4, title: 'Representar', desc: 'Elegir, utilizar y transitar entre formas concretas, pictóricas y simbólicas.', icon: <Sparkles className="w-5 h-5 text-indigo-600 mb-1" /> },
                      ].map((skill) => (
                        <div key={skill.id} className="group relative bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center cursor-help">
                          {skill.icon}
                          <span className="text-[11px] font-bold text-center leading-tight truncate w-full text-slate-700">{skill.title.split(' ')[0]}</span>
                          {/* Tooltip con información oficial del MINEDUC */}
                          <div className="absolute opacity-0 pb-3 group-hover:opacity-100 transition-all bg-slate-900 border border-slate-700 text-white p-3 rounded-xl -top-28 left-1/2 -translate-x-1/2 w-48 shadow-2xl pointer-events-none z-50">
                            <p className="font-bold text-xs text-indigo-300 mb-1">{skill.title}</p>
                            <p className="text-[10px] text-slate-200 font-medium leading-tight">{skill.desc}</p>
                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-b border-r border-slate-700"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {role === 'teacher' || user?.email?.toLowerCase().includes('naomi') ? (
                      <button
                        onClick={() => setIsCreating(true)}
                        className="group bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg flex items-center space-x-2"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Subir Material Docente</span>
                      </button>
                    ) : !user && (
                      <button
                        onClick={() => setIsLoginOpen(true)}
                        className="group bg-indigo-600 text-white hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center space-x-2 border border-indigo-400/50"
                      >
                        <GraduationCap className="w-5 h-5" />
                        <span>Crea tu perfil de alumno</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quiz List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-800 flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      <span>Repositorio de Ensayos</span>
                    </h3>
                    <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      {quizzes.length} disponibles
                    </div>
                  </div>

                  {quizzes.length === 0 ? (
                    <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-10 text-center shadow-sm">
                      <div className="w-16 h-16 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 transform -rotate-6">
                        <BookOpen className="w-8 h-8" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-200 mb-2">Aún no hay material disponible</h4>
                      <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
                        {role === 'teacher' 
                          ? 'Empieza por subir material para que tus estudiantes puedan ejercitar.'
                          : 'Aún no hay ensayos publicados.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-12">
                      {quizzes.map((quiz, idx) => (
                        <motion.div 
                          key={quiz.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => setCurrentQuiz(quiz)}
                          className="bg-white p-5 rounded-2xl shadow-md border border-slate-200 hover:shadow-xl hover:border-indigo-400 group cursor-pointer transition-all"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            {role === 'teacher' && (
                              <button
                                onClick={(e) => handleDelete(quiz.id, e)}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          <h3 className="text-base font-black text-slate-800 mb-3 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
                            {quiz.title}
                          </h3>
                          
                          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                              {quiz.questions.length} PREGUNTAS
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha - Últimos Ensayos */}
              <div className="hidden lg:flex flex-col w-64 shrink-0 space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-200">
                  <h4 className="font-black text-slate-800 mb-4 flex items-center text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Últimos Resultados</h4>
                  {user ? (
                    <div className="space-y-3">
                      {studentResults.slice(0,4).map(res => (
                        <div key={res.quizId + res.completedAt} className="flex flex-col bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1 mb-2" title={res.quizTitle}>{res.quizTitle}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-medium">Hace poco</span>
                            <span className="text-sm font-black text-indigo-600">
                               {Math.round((res.score / res.totalQuestions) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                      {studentResults.length === 0 && <p className="text-xs text-slate-400 text-center py-2">Realiza un ensayo para ver tu progreso aquí.</p>}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-500 font-medium pb-2 border-b border-slate-100 mb-2">Aquí verás tus puntajes recientes.</p>
                      <div className="bg-slate-50 h-12 rounded-xl border border-slate-100 mb-2"></div>
                      <div className="bg-slate-800/5 h-12 rounded-xl border border-slate-100"></div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
