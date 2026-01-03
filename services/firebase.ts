import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  signInAnonymously,
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
import { ScriptData, SavedVocabularyItem } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBcakd5WsncVKdEsrrGT4UqxUTqbAAjckk",
  authDomain: "dailyflow-eadca.firebaseapp.com",
  projectId: "dailyflow-eadca",
  storageBucket: "dailyflow-eadca.firebasestorage.app",
  messagingSenderId: "337666298928",
  appId: "1:337666298928:web:48f0c40aa83340144309f5",
  measurementId: "G-1P3ZHYPQYT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("Error signing in with Google:", error);
    
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';
    const errorString = JSON.stringify(error);

    // If the domain is unauthorized (common in cloud IDEs like IDX/Replit),
    // Fallback to Anonymous Authentication so the user can still save data.
    if (errorCode === 'auth/unauthorized-domain' || errorMessage.includes('unauthorized-domain') || errorString.includes('unauthorized-domain')) {
      console.warn("Domain not authorized. Attempting fallback to Anonymous Authentication.");
      try {
        await signInAnonymously(auth);
        // We return here to indicate success (via fallback)
        return; 
      } catch (anonError: any) {
        console.error("Anonymous fallback failed:", anonError);
        const anonCode = anonError?.code || '';
        
        // If Anonymous Auth is not enabled in Firebase Console
        if (anonCode === 'auth/admin-restricted-operation' || anonCode === 'auth/operation-not-allowed') {
             throw new Error("⚠️ SETUP REQUIRED:\n\n1. Go to Firebase Console > Build > Authentication > Sign-in method.\n2. Enable 'Anonymous' provider.\n\n(Required because the current cloud domain is not authorized for Google Sign-In)");
        }
        
        throw new Error("Login failed. Could not establish a secure connection.");
      }
    }
    
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