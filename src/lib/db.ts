import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { QuizQuestion } from './gemini';

export interface Quiz {
  id: string;
  title: string;
  createdAt: number;
  questions: QuizQuestion[];
}

const LOCAL_STORAGE_KEY = 'paes_tutor_quizzes';

// Helper to get quizzes from local storage
function getLocalQuizzes(): Quiz[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export async function getQuizzes(): Promise<Quiz[]> {
  // Si no hay DB, usamos LocalStorage
  if (!db) {
    return getLocalQuizzes().sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const quizzesCol = collection(db, 'quizzes');
    const q = query(quizzesCol, orderBy('createdAt', 'desc'));
    const quizSnapshot = await getDocs(q);
    
    return quizSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toMillis?.() || Date.now()
      } as Quiz;
    });
  } catch (error) {
    console.warn("Error con Firebase, usando LocalStorage:", error);
    return getLocalQuizzes().sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function saveQuiz(quizData: Omit<Quiz, 'id' | 'createdAt'>): Promise<string> {
  const newQuiz: Quiz = {
    ...quizData,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: Date.now()
  };

  // 1. Guardar en LocalStorage siempre (como backup)
  const localQuizzes = getLocalQuizzes();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newQuiz, ...localQuizzes]));

  // 2. Intentar guardar en Firebase si existe
  if (db) {
    try {
      const quizzesCol = collection(db, 'quizzes');
      const docRef = await addDoc(quizzesCol, {
        ...quizData,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.warn("No se pudo guardar en Firebase, se guardó localmente:", error);
    }
  }

  return newQuiz.id;
}

export async function deleteQuiz(id: string): Promise<void> {
  // Eliminar de LocalStorage
  const localQuizzes = getLocalQuizzes();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localQuizzes.filter(q => q.id !== id)));

  // Intentar eliminar de Firebase
  if (db) {
    try {
      const quizDoc = doc(db, 'quizzes', id);
      await deleteDoc(quizDoc);
    } catch (error) {
      console.error("Error eliminando de Firebase:", error);
    }
  }
}

