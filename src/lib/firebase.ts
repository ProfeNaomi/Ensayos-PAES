import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "appmatematicaescolar",
  appId: "1:475003111009:web:b87353b9ddb8c4bcfc0c20",
  storageBucket: "appmatematicaescolar.firebasestorage.app",
  apiKey: "AIzaSyBhKvNKM7_ov4Ud5JCrf9nqglB304Uzqp0",
  authDomain: "appmatematicaescolar.firebaseapp.com",
  messagingSenderId: "475003111009",
  measurementId: "G-J8D19SB4LJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
