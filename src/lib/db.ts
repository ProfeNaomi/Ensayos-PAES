import { db, storage } from './firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  query, 
  orderBy,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { QuizQuestion } from './gemini';

export interface Quiz {
  id: string;
  title: string;
  createdAt: number;
  questions: QuizQuestion[];
  teacherId?: string;
}

export interface QuizResult {
  id?: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userName: string;
  score: number;
  totalQuestions: number;
  completedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher';
}

// Subir una imagen Base64 a Firebase Storage y retornar la URL pública
// Subir una imagen Base64 a Firebase Storage y retornar la URL pública
async function uploadQuestionImage(quizId: string, questionId: number, base64: string): Promise<string> {
  if (!storage) return base64; // Fallback if no storage
  
  try {
    const storageRef = ref(storage, `quizzes/${quizId}/question_${questionId}.jpg`);
    
    // Convertir Base64 a Blob para una subida más eficiente
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Implementar un timeout de 30 segundos para la subida
    const uploadTask = uploadString(storageRef, base64Data, 'base64');
    
    // Si queremos usar blobs y uploadBytes (más eficiente):
    // const uploadTask = uploadBytes(storageRef, blob);

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout en la subida de imagen")), 30000)
    );

    await Promise.race([uploadTask, timeoutPromise]);
    
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn(`Error subiendo imagen para q_${questionId}:`, error);
    return base64; // Fallback al base64 original si falla la subida
  }
}

export async function getQuizzes(): Promise<Quiz[]> {
  if (!db) return [];

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
    console.error("Error cargando quizzes de Firebase:", error);
    return [];
  }
}

export async function saveQuiz(quizData: Omit<Quiz, 'id' | 'createdAt'>, teacherId?: string): Promise<string> {
  if (!db) throw new Error("Base de datos no disponible");

  try {
    const tempQuizId = Math.random().toString(36).substr(2, 9);
    console.log(`[SaveQuiz] Iniciando para: ${quizData.title}`);

    // Procesar imágenes en paralelo
    const uploadPromises = quizData.questions.map(async (q) => {
      if (q.imageBase64 && q.imageBase64.startsWith('data:image')) {
        try {
          console.log(`[SaveQuiz] Subiendo imagen para pregunta ${q.id}...`);
          const imageUrl = await uploadQuestionImage(tempQuizId, q.id, q.imageBase64);
          
          // CRÍTICO: Si la URL devuelta sigue siendo base64 (porque falló la subida),
          // la eliminamos si es muy grande para no bloquear Firestore
          if (imageUrl.startsWith('data:image') && imageUrl.length > 50000) {
            console.warn(`[SaveQuiz] Imagen ${q.id} falló subida y es muy grande. Se guardará sin imagen.`);
            return { ...q, imageBase64: undefined };
          }
          
          return { ...q, imageBase64: imageUrl };
        } catch (e) {
          console.error(`[SaveQuiz] Error en imagen ${q.id}:`, e);
          return { ...q, imageBase64: undefined };
        }
      }
      return q;
    });

    const questionsWithUrls = await Promise.all(uploadPromises);
    
    // LUZ ROJA: Firestore no soporta 'undefined'. Limpiamos el objeto antes de subir.
    const sanitizedQuestions = questionsWithUrls.map(q => {
      const qCopy = { ...q };
      if (qCopy.imageBase64 === undefined) delete qCopy.imageBase64;
      return qCopy;
    });

    console.log("[SaveQuiz] Imágenes procesadas. Guardando documento en Firestore...");

    const quizzesCol = collection(db, 'quizzes');
    
    // Timeout para la operación de Firestore
    const firestorePromise = addDoc(quizzesCol, {
      title: quizData.title.trim(),
      questions: sanitizedQuestions,
      teacherId: teacherId || null,
      createdAt: serverTimestamp()
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Tiempo de espera agotado al guardar en Firestore")), 20000)
    );

    const docRef = await Promise.race([firestorePromise, timeoutPromise]) as any;
    
    console.log(`[SaveQuiz] ÉXITO. ID: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error("[SaveQuiz] ERROR CRÍTICO:", error);
    // Si el error es por el tamaño, damos un mensaje más claro
    if (error.message?.includes('too large')) {
      throw new Error("El ensayo es demasiado grande para la base de datos. Intenta con menos imágenes.");
    }
    throw new Error(`No se pudo guardar: ${error.message || 'Error desconocido'}`);
  }
}

export async function deleteQuiz(id: string): Promise<void> {
  if (!db) return;
  try {
    const quizDoc = doc(db, 'quizzes', id);
    await deleteDoc(quizDoc);
  } catch (error) {
    console.error("Error eliminando quiz:", error);
  }
}

// Perfil de Usuario
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() as UserProfile : null;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', profile.uid), profile);
}

// Resultados
export async function saveQuizResult(result: Omit<QuizResult, 'id' | 'completedAt'>): Promise<string> {
  if (!db) throw new Error("Database not initialized");
  const resultsCol = collection(db, 'results');
  const docRef = await addDoc(resultsCol, {
    ...result,
    completedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getStudentResults(userId: string): Promise<QuizResult[]> {
  if (!db) return [];
  const resultsCol = collection(db, 'results');
  const q = query(resultsCol, where('userId', '==', userId), orderBy('completedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
    completedAt: doc.data().completedAt?.toMillis?.() || Date.now()
  } as QuizResult));
}
