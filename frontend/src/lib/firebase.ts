import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";

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
// Keep the sign-in only for the current browser session: it survives page
// refreshes and new tabs, but closing the browser signs the user out, so the
// next visit starts at the login page instead of a remembered dashboard.
const createAuth = (): Auth => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: browserSessionPersistence,
    });
  } catch {
    // Already initialized (e.g. after a hot reload in development).
    return getAuth(firebaseApp);
  }
};

export const auth = createAuth();
