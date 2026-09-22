// La lettura del profilo pubblico (P1).
//
// Questo file non filtra niente: il documento che arriva contiene già solo ciò che il
// lavoratore ha deciso di mostrare, perché lo scrive la Cloud Function `pubblicaProfilo`
// secondo le sue impostazioni di privacy. È il motivo per cui `profiliPubblici` esiste
// come collezione separata (§6).

import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from './firebase';
import type { StatoStagione } from './tipi';

export type StagionePubblica = {
  struttura: string;
  comune: string;
  ruolo: string;
  dal: string;
  al: string;
  stato: StatoStagione;
  riprenderebbe: boolean;
  ruoloResponsabile: string | null;
};

export type ProfiloPubblico = {
  nome: string;
  fotoPath: string | null;
  ruoloPrincipale: string;
  comune: string;
  geohash: string;
  disponibile: boolean;
  stagioneDisponibile: string | null;
  /** C'è solo se il lavoratore ha acceso «mostra il mio telefono». */
  telefono: string | null;
  stagioni: StagionePubblica[];
  competenze: {
    /** id competenza → da quante strutture diverse è confermata. */
    confermate: Record<string, number>;
    dichiarate: string[];
  };
  riepilogo: {
    nStagioni: number;
    nConfermate: number;
    nStrutture: number;
    nRiprenderebbe: number;
  };
  haCv: boolean;
};

export async function leggiProfiloPubblico(slug: string): Promise<ProfiloPubblico | null> {
  const snap = await getDoc(doc(db, 'profiliPubblici', slug));
  return snap.exists() ? (snap.data() as ProfiloPubblico) : null;
}

/** La foto è pubblica (§10): l'indirizzo si risolve qui, così non finisce nel database. */
export async function urlFotoPubblica(fotoPath: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(storage, fotoPath));
  } catch {
    return null;
  }
}
