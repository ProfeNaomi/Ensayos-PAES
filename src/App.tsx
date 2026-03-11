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
      {/* Panel de Sesión y Debug (Solo visible si hay usuario) */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col items-end space-y-2 pointer-events-none">
        {user && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 border border-indigo-100 text-right pointer-events-auto"
          >
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Sesión Activa</p>
            <p className="text-sm font-black text-slate-800">{user.email}</p>
            <div className="flex items-center justify-end space-x-2 mt-2">
              <span className={cn(
                "text-[10px] font-black px-2 py-1 rounded-lg uppercase",
                role === 'teacher' || isActuallyTeacher ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              )}>
                Rol: {isActuallyTeacher ? 'Profesora' : 'Estudiante'}
              </span>
              <button 
                onClick={handleLogout}
                className="text-[10px] font-black text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors border border-red-100"
              >
                CERRAR SESIÓN
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => {
              setCurrentQuiz(null);
              setIsCreating(false);
              setShowStats(false);
            }}
          >
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                PAES<span className="text-indigo-600">TUTOR</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Platform IA v2.0</p>
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
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
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
                <button onClick={() => setShowStats(false)} className="text-indigo-600 font-bold flex items-center space-x-2">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                  <span>Volver al Repositorio</span>
                </button>
              </div>

              {studentResults.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-16 text-center shadow-xl border border-slate-100">
                  <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-slate-800">Aún no tienes estadísticas</h3>
                  <p className="text-slate-500 mt-2">Realiza tu primer ensayo para empezar a registrar tu avance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {studentResults.map((res, i) => (
                      <div key={i} className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
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
                                    className="h-full bg-indigo-600 rounded-full" 
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
                   className="text-indigo-600 font-bold flex items-center space-x-2 hover:translate-x-1 transition-transform"
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
                    <span>Plataforma Oficial Profe Naomi</span>
                  </motion.div>
                  <h2 className="text-4xl md:text-6xl font-black mb-6 leading-[1.1]">
                    {user ? `¡Hola de nuevo, ${userProfile?.displayName?.split(' ')[0] || 'estudiante'}!` : 'Tu formación PAES comienza aquí.'}
                  </h2>
                  <p className="text-lg md:text-xl text-indigo-100 mb-8 font-medium leading-relaxed">
                    Practica con ensayos reales y obtén retroalimentación instantánea de nuestra IA. 
                    Aprende de cada error y mejora tu puntaje paso a paso.
                  </p>
                  
                  {role === 'teacher' || user?.email?.toLowerCase().includes('naomi') ? (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="group bg-white text-indigo-600 hover:bg-slate-50 px-8 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl flex items-center space-x-3"
                    >
                      <Plus className="w-6 h-6" />
                      <span>Subir Material Docente</span>
                    </button>
                  ) : !user && (
                    <button
                      onClick={() => setIsLoginOpen(true)}
                      className="group bg-indigo-500 text-white hover:bg-indigo-400 px-8 py-4 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl flex items-center space-x-3 border border-indigo-400"
                    >
                      <GraduationCap className="w-6 h-6" />
                      <span>Crea tu perfil de alumno</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quiz List */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center space-x-3">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    <span>Repositorio de Ensayos</span>
                  </h3>
                  <div className="text-sm font-bold text-slate-400 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                    {quizzes.length} {quizzes.length === 1 ? 'Ensayo' : 'Ensayos'} disponibles
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
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
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                            </div>
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
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
