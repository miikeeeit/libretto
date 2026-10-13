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
  /** La lettura del profilo non è riuscita (rete): non vuol dire che il profilo manchi. */
  erroreProfilo: boolean;
  riprovaProfilo: () => void;
};

const Contesto = createContext<Stato | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utente, setUtente] = useState<User | null | undefined>(undefined);
  const [worker, setWorker] = useState<Worker | null | undefined>(undefined);
  const [erroreProfilo, setErroreProfilo] = useState(false);
  const [tentativo, setTentativo] = useState(0);

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
    setErroreProfilo(false);
    leggiWorker(utente.uid)
      .then((w) => {
        if (!annullato) setWorker(w);
      })
      .catch((errore) => {
        // Prima un errore qui valeva «non hai un profilo»: con la rete che va e viene,
        // chi aveva già il suo libretto si ritrovava davanti «Crea il tuo libretto».
        // Ora si resta in attesa e si offre di riprovare.
        console.error('Profilo non leggibile:', errore);
        if (!annullato) setErroreProfilo(true);
      });
    return () => {
      annullato = true;
    };
  }, [utente, tentativo]);

  const riprovaProfilo = useCallback(() => setTentativo((t) => t + 1), []);

  const ricaricaWorker = useCallback(async () => {
    if (!utente) return;
    setWorker(await leggiWorker(utente.uid));
  }, [utente]);

  const esci = useCallback(async () => {
    await signOut(auth);
  }, []);

  const valore = useMemo<Stato>(
    () => ({ utente, worker, ricaricaWorker, esci, erroreProfilo, riprovaProfilo }),
    [utente, worker, ricaricaWorker, esci, erroreProfilo, riprovaProfilo],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useAuth(): Stato {
  const stato = useContext(Contesto);
  if (!stato) throw new Error('useAuth va usato dentro AuthProvider.');
  return stato;
}
