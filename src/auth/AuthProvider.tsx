// Chi è collegato e se ha già un libretto. Lo sa un posto solo.

import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../lib/firebase';
import { leggiWorker } from '../lib/worker';
import type { Worker } from '../lib/tipi';

type Stato = {
  /** null = non collegato. undefined = ancora non si sa. */
  utente: User | null | undefined;
  /** null = collegato ma senza profilo (va a L2). undefined = ancora non si sa. */
  worker: Worker | null | undefined;
  ricaricaWorker: () => Promise<void>;
  esci: () => Promise<void>;
};

const Contesto = createContext<Stato | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null | undefined>(undefined);
  const [worker, setWorker] = useState<Worker | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUtente(u);
      setWorker(undefined);
    });
  }, []);

  useEffect(() => {
    if (utente === undefined) return;
    if (utente === null) {
      setWorker(null);
      return;
    }
    let annullato = false;
    leggiWorker(utente.uid)
      .then((w) => {
        if (!annullato) setWorker(w);
      })
      .catch((errore) => {
        console.error('Profilo non leggibile:', errore);
        if (!annullato) setWorker(null);
      });
    return () => {
      annullato = true;
    };
  }, [utente]);

  const ricaricaWorker = useCallback(async () => {
    if (!utente) return;
    setWorker(await leggiWorker(utente.uid));
  }, [utente]);

  const esci = useCallback(async () => {
    await signOut(auth);
  }, []);

  const valore = useMemo<Stato>(
    () => ({ utente, worker, ricaricaWorker, esci }),
    [utente, worker, ricaricaWorker, esci],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useAuth(): Stato {
  const stato = useContext(Contesto);
  if (!stato) throw new Error('useAuth va usato dentro AuthProvider.');
  return stato;
}
