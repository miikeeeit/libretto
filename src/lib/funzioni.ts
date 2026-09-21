// Le chiamate alle Cloud Functions (§10).
//
// Tutto quello che dà valore a una conferma passa da qui, perché deve succedere su un
// server e non sul telefono di chi ha interesse a falsificarlo.

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app, USA_EMULATORI } from './firebase';

// Stessa regione dei dati (PC1: Milano).
const funzioni = getFunctions(app, 'europe-west8');

if (USA_EMULATORI) {
  connectFunctionsEmulator(funzioni, '127.0.0.1', 5001);
}

export type EsitoRichiesta = { token: string; scadeFraGiorni: number };

export const creaRichiesta = httpsCallable<
  { stagioneId: string; nomeResponsabile: string; telefonoResponsabile: string },
  EsitoRichiesta
>(funzioni, 'creaRichiesta');

/** Quello che vede chi apre il link, senza essere collegato (C1). */
export type DatiRichiesta =
  | { stato: 'inesistente' | 'usata' | 'scaduta' | 'revocata'; numeroCoincide: boolean }
  | {
      stato: 'aperta';
      /** Vero solo se chi chiama ha già verificato il numero giusto. Il numero non arriva mai. */
      numeroCoincide: boolean;
      nomeLavoratore: string;
      nomeDiBattesimo: string;
      struttura: string;
      comune: string;
      ruolo: string;
      dal: string;
      al: string;
      competenzeDichiarate: string[];
      telefonoMascherato: string;
    };

export const leggiRichiesta = httpsCallable<{ token: string }, DatiRichiesta>(
  funzioni,
  'leggiRichiesta',
);

export const confermaStagione = httpsCallable<
  {
    token: string;
    competenzeConfermate: string[];
    riprenderebbe: boolean;
    ruoloResponsabile: string;
    consenso: boolean;
  },
  { nomeLavoratore: string; competenzeConfermate: string[]; revocabileFinoA: number }
>(funzioni, 'confermaStagione');

export const segnalaStagione = httpsCallable<
  { token: string; motivo: 'mai_lavorato' | 'dati_sbagliati' },
  { ok: boolean }
>(funzioni, 'segnalaStagione');

export const revocaConferma = httpsCallable<{ token: string }, { ok: boolean }>(
  funzioni,
  'revocaConferma',
);
