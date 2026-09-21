// Un solo punto di inizializzazione di Firebase.
// Le chiavi stanno in .env (vedi .env.example): non si scrivono nel codice.

import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Sviluppo sugli emulatori.
 * PC1 (2026-09-21): finché l'avviso di budget su Blaze non è impostato, si lavora così
 * e nessun SMS parte davvero (il codice da usare è quello dei numeri di test di Firebase).
 */
export const USA_EMULATORI = import.meta.env.VITE_USA_EMULATORI === '1';

if (USA_EMULATORI) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  // Sugli emulatori nessun SMS parte davvero e il reCAPTCHA si salta:
  // il codice da usare si legge nei log dell'emulatore.
  auth.settings.appVerificationDisabledForTesting = true;
}

/** La lingua dell'SMS di verifica e delle schermate di Firebase. */
auth.languageCode = 'it';
