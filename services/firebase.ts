import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  getDocs
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { ScriptData, SavedVocabularyItem } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("Error signing in with Google:", error);

    const errorCode = error?.code || '';

    // Check for popup closed by user
    if (errorCode === 'auth/popup-closed-by-user') {
      throw new Error("Sign-in cancelled.");
    }

    throw error;
  }
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

// Hook-like subscription for Auth State
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// --- HISTORY FUNCTIONS ---

export const saveScriptToCloud = async (userId: string, script: ScriptData) => {
  try {
    // We use the script ID as the document ID to prevent duplicates easily
    const scriptRef = doc(db, "users", userId, "history", script.id);
    await setDoc(scriptRef, script);
  } catch (e) {
    console.error("Error saving script to cloud", e);
  }
};

export const deleteScriptFromCloud = async (userId: string, scriptId: string) => {
  try {
    await deleteDoc(doc(db, "users", userId, "history", scriptId));
  } catch (e) {
    console.error("Error deleting script from cloud", e);
  }
};

export const subscribeToHistory = (userId: string, callback: (history: ScriptData[]) => void) => {
  const q = query(collection(db, "users", userId, "history"), orderBy("timestamp", "desc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const historyData: ScriptData[] = [];
    snapshot.forEach((doc) => {
      historyData.push(doc.data() as ScriptData);
    });
    callback(historyData);
  });

  return unsubscribe;
};

// --- VOCABULARY FUNCTIONS ---

export const saveWordToCloud = async (userId: string, item: SavedVocabularyItem) => {
  try {
    // Use lowercase word as ID to prevent duplicates
    const docId = item.word.toLowerCase().trim();
    const wordRef = doc(db, "users", userId, "vocabulary", docId);
    await setDoc(wordRef, item);
  } catch (e) {
    console.error("Error saving word to cloud", e);
  }
};

export const deleteWordFromCloud = async (userId: string, word: string) => {
  try {
    const docId = word.toLowerCase().trim();
    await deleteDoc(doc(db, "users", userId, "vocabulary", docId));
  } catch (e) {
    console.error("Error deleting word from cloud", e);
  }
};

export const subscribeToVocabulary = (userId: string, callback: (words: SavedVocabularyItem[]) => void) => {
  const q = query(collection(db, "users", userId, "vocabulary"), orderBy("timestamp", "desc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const vocabData: SavedVocabularyItem[] = [];
    snapshot.forEach((doc) => {
      vocabData.push(doc.data() as SavedVocabularyItem);
    });
    callback(vocabData);
  });

  return unsubscribe;
};