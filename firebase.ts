import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

declare global {
  interface Window {
    __app_id?: string;
    __firebase_config?: string;
    __initial_auth_token?: string;
  }
}

// El Árbol original: Firebase fijo y aislado de cualquier otro proyecto/runtime.
export const appId = 'el-arbol-pos-default';

const firebaseConfigObj = {
  apiKey: "AIzaSyAcL_ud83T6jmDAPpfZE7G-XsoVbBbF5Mg",
  authDomain: "el-arbol-pizzeria.firebaseapp.com",
  projectId: "el-arbol-pizzeria",
  storageBucket: "el-arbol-pizzeria.appspot.com",
  messagingSenderId: "384832129676",
  appId: "1:384832129676:web:b76e1e4ab0366be03489a9"
};

const firebaseAppName = 'el-arbol-pizzeria';
let app: any;
let auth: any = null;
let db: any = null;
let firebaseErrorMsg: string | null = null;

try {
  app = getApps().find(existing => existing.name === firebaseAppName)
    || initializeApp(firebaseConfigObj, firebaseAppName);
  auth = getAuth(app);
  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    db = getFirestore(app);
  }
} catch (e: any) {
  console.error("Firebase Init Error:", e);
  firebaseErrorMsg = e.message;
}

export { auth, db, firebaseErrorMsg };
