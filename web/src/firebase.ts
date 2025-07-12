import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { isDev } from './devUtils';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyAXfzNwNECmVKQrIhp9yhaF_IuVXMBfajA",
  authDomain: "tgbc-camp-tickets.firebaseapp.com",
  projectId: "tgbc-camp-tickets",
  storageBucket: "tgbc-camp-tickets.firebasestorage.app",
  messagingSenderId: "785909138910",
  appId: "1:785909138910:web:44e24e3074c9c22a8b094f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

if (isDev()) {
  connectFirestoreEmulator(db, "127.0.0.1", 5002);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  console.log("Firebase emulators connected");
} else {
  getAnalytics(app);
  console.log("Firebase connected to production");
}
