// Il periodo di una stagione: mese e anno di inizio e fine, niente giorni.
//
// Si salva come "2025-05" perché così le stagioni si ordinano confrontando due stringhe,
// e si mostra come "maggio – settembre 2025", che è il modo in cui la gente ne parla.
//
// Non si usa `<input type="month">`: su iPhone non esiste e diventa un campo di testo
// libero, che è il modo più sicuro di raccogliere date scritte in dieci formati diversi.

export const MESI = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

/** Dall'anno in corso indietro di vent'anni: le stagioni si raccontano, non si prevedono. */
export function anniPossibili(oggi = new Date()): number[] {
  const corrente = oggi.getFullYear();
  return Array.from({ length: 21 }, (_, i) => corrente - i);
}

/** (2025, 5) → "2025-05" */
export function componiPeriodo(anno: number, mese: number): string {
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

/** "2025-05" → { anno: 2025, mese: 5 } */
export function scomponiPeriodo(periodo: string): { anno: number; mese: number } | null {
  const pezzi = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!pezzi) return null;
  const anno = Number(pezzi[1]);
  const mese = Number(pezzi[2]);
  if (mese < 1 || mese > 12) return null;
  return { anno, mese };
}

export function nomeMese(mese: number): string {
  return MESI[mese - 1] ?? '';
}

/**
 * "maggio – settembre 2025" se la stagione sta in un anno,
 * "ottobre 2024 – marzo 2025" se ne scavalca due.
 */
export function formattaPeriodo(dal: string, al: string): string {
  const inizio = scomponiPeriodo(dal);
  const fine = scomponiPeriodo(al);
  if (!inizio || !fine) return `${dal} – ${al}`;

  if (inizio.anno === fine.anno) {
    if (inizio.mese === fine.mese) return `${nomeMese(inizio.mese)} ${inizio.anno}`;
    return `${nomeMese(inizio.mese)} – ${nomeMese(fine.mese)} ${fine.anno}`;
  }
  return `${nomeMese(inizio.mese)} ${inizio.anno} – ${nomeMese(fine.mese)} ${fine.anno}`;
}

/** La fine non può venire prima dell'inizio. */
export function periodoValido(dal: string, al: string): boolean {
  return scomponiPeriodo(dal) !== null && scomponiPeriodo(al) !== null && dal <= al;
}
