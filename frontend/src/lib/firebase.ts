import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => typeof value === "undefined" || value === "")
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(`Missing Firebase configuration values: ${missingKeys.join(", ")}`);
}

export const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
