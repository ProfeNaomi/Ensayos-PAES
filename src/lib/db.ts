import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { QuizQuestion } from './gemini';

export interface Quiz {
  id: string;
  title: string;
  createdAt: any; // Using serverTimestamp or Timestamp
  questions: QuizQuestion[];
}

export async function getQuizzes(): Promise<Quiz[]> {
  try {
    const quizzesCol = collection(db, 'quizzes');
    const q = query(quizzesCol, orderBy('createdAt', 'desc'));
    const quizSnapshot = await getDocs(q);
    return quizSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toMillis() || Date.now()
    } as Quiz));
  } catch (error) {
    console.error("Error getting quizzes:", error);
    return [];
  }
}

export async function saveQuiz(quiz: Omit<Quiz, 'id' | 'createdAt'>): Promise<string> {
  try {
    const quizzesCol = collection(db, 'quizzes');
    const docRef = await addDoc(quizzesCol, {
      ...quiz,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error saving quiz:", error);
    throw error;
  }
}

export async function deleteQuiz(id: string): Promise<void> {
  try {
    const quizDoc = doc(db, 'quizzes', id);
    await deleteDoc(quizDoc);
  } catch (error) {
    console.error("Error deleting quiz:", error);
    throw error;
  }
}

