// Le forme dei documenti Firestore (§6). Una sola definizione, usata da tutta l'app.

import type { Timestamp } from 'firebase/firestore';

export type Privacy = {
  /** Pubblico con link (predefinito) oppure privato: il link non funziona. */
  pubblico: boolean;
  mostraTelefono: boolean;
  mostraInAttesa: boolean;
  mostraCv: boolean;
};

export const PRIVACY_PREDEFINITA: Privacy = {
  pubblico: true,
  mostraTelefono: false,
  mostraInAttesa: false,
  mostraCv: false,
};

export type Consensi = {
  maggiorenne: Timestamp;
  informativa: { versione: string; ts: Timestamp };
};

export type Worker = {
  nome: string;
  cognome: string;
  fotoPath: string | null;
  /** Da Auth: il client non lo scrive mai dopo la creazione (regole di sicurezza). */
  telefono: string;
  ruoloPrincipale: string;
  comune: string;
  provincia: string;
  /** Del comune, per la ricerca di gennaio (§6). */
  geohash: string;
  disponibile: boolean;
  stagioneDisponibile: string;
  /** Univoco, es. "mario-rossi-4f2a". Immutabile dopo la creazione. */
  slug: string;
  privacy: Privacy;
  cvPath: string | null;
  consensi: Consensi;
  /**
   * Codice di invito usato per registrarsi, o null quando la registrazione è aperta.
   * Non è nella §6: serve alla decisione PC1 (beta su invito), perché le regole di
   * sicurezza possano verificare che il codice è stato davvero assegnato a questo uid.
   */
  invito: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type StatoStagione = 'bozza' | 'in_attesa' | 'confermata' | 'non_confermata' | 'scaduta';

export type Stagione = {
  strutturaId: string;
  strutturaNome: string;
  strutturaComune: string;
  ruolo: string;
  /** "2025-05" */
  dal: string;
  /** "2025-09" */
  al: string;
  competenzeDichiarate: string[];
  /** Scritte solo dalla Cloud Function. */
  competenzeConfermate: string[];
  stato: StatoStagione;
  nascosta: boolean;
  /** Scritto solo dalla Cloud Function. */
  riprenderebbe: boolean;
  /** Scritto solo dalla Cloud Function. */
  ruoloResponsabile: string | null;
  richiestaId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Una stagione con il suo id, come la si legge da Firestore. */
export type StagioneConId = Stagione & { id: string };

/** §6: i nomi delle strutture si copiano sulla stagione al momento in cui si salva. */
export type Struttura = {
  nome: string;
  nomeNormalizzato: string;
  /** Le parole del nome, per trovare "Bar Somma" scrivendo "somma". */
  parole: string[];
  comune: string;
  provincia: string;
  geohash: string;
  nConferme: number;
  creataDa: string;
  /** Per unire i duplicati da admin. */
  unitaA: string | null;
  createdAt: Timestamp;
};

export type StrutturaConId = Struttura & { id: string };

/** Eventi essenziali contati in Firestore (§12). Nessun analytics di terze parti. */
export type TipoEvento =
  | 'registrazione'
  | 'stagione_creata'
  | 'richiesta_inviata'
  | 'conferma_aperta'
  | 'conferma_completata'
  | 'profilo_condiviso'
  | 'profilo_pubblico_visto';
