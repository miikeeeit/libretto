// Quanti datori confermano entro 7 giorni dalla richiesta.
//
// È la condizione 2 di `SPEC_POST_V1.md`: se meno della metà conferma entro una
// settimana, la prova documentale diventa urgente. Il numero non si ricava da `eventi`,
// che sono anonimi e scollegati fra loro: si ricava dalle richieste (quando sono
// partite) e dalle conferme (quando sono arrivate, con lo stesso `richiestaId`).
//
// Lo calcola la pulizia di ogni notte, prima di cancellare qualcosa, e lo scrive in
// `statistiche/conferme`: Mike lo legge dalla console, senza chiavi da amministratore
// sul suo computer. Solo numeri, nessun nome né telefono. Il client non lo legge.
//
// Limite da sapere: la pulizia cancella le richieste chiuse dopo 90 giorni, quindi il
// conto guarda le richieste degli ultimi 90 giorni circa. Per la decisione di fine
// novembre basta: le prime richieste vere sono del 30 settembre.

import { Timestamp } from 'firebase-admin/firestore';
import { db } from './comune';

const GIORNI_PER_CONFERMARE = 7;
const GIORNO = 24 * 60 * 60 * 1000;

export type StatisticheConferme = {
  /** Richieste partite da almeno 7 giorni, senza quelle sostituite da un invio nuovo. */
  richiesteConsiderate: number;
  confermateEntro7Giorni: number;
  confermateDopo: number;
  /** Il responsabile ha risposto «non corrisponde». */
  segnalate: number;
  /** Nessuno ha usato il link entro 30 giorni. */
  scadute: number;
  /** Ancora senza risposta, ma partite da più di 7 giorni. */
  ancoraAperte: number;
  /** Percentuale intera, o null se non c'è ancora niente da contare. */
  percentualeEntro7Giorni: number | null;
};

export async function calcolaStatisticheConferme(adesso = Timestamp.now()): Promise<StatisticheConferme> {
  const limite = adesso.toMillis() - GIORNI_PER_CONFERMARE * GIORNO;

  // Per la beta sono decine di documenti: si leggono tutti. Se un giorno fossero
  // migliaia, si conterà per settimana invece che tutto insieme.
  const [richieste, conferme] = await Promise.all([
    db.collection('richieste').get(),
    db.collection('conferme').get(),
  ]);

  const confermaPerRichiesta = new Map<string, number>();
  for (const c of conferme.docs) {
    const dati = c.data() as { richiestaId?: string; createdAt?: Timestamp };
    if (dati.richiestaId && dati.createdAt) confermaPerRichiesta.set(dati.richiestaId, dati.createdAt.toMillis());
  }

  const conti: StatisticheConferme = {
    richiesteConsiderate: 0,
    confermateEntro7Giorni: 0,
    confermateDopo: 0,
    segnalate: 0,
    scadute: 0,
    ancoraAperte: 0,
    percentualeEntro7Giorni: null,
  };

  for (const r of richieste.docs) {
    const dati = r.data() as { stato: string; createdAt?: Timestamp };
    if (!dati.createdAt) continue;
    const partita = dati.createdAt.toMillis();
    // Non ha ancora avuto la sua settimana: contarla abbasserebbe il numero per niente.
    if (partita > limite) continue;

    const confermataIl = confermaPerRichiesta.get(r.id);
    if (confermataIl !== undefined) {
      conti.richiesteConsiderate += 1;
      if (confermataIl - partita <= GIORNI_PER_CONFERMARE * GIORNO) conti.confermateEntro7Giorni += 1;
      else conti.confermateDopo += 1;
      continue;
    }

    // «Revocata» senza conferma vuol dire sostituita da un invio nuovo (il lavoratore
    // ha corretto il numero o la stagione): non è un datore che non ha risposto, e la
    // richiesta nuova si conta per conto suo. Una conferma revocata dal responsabile
    // finisce qui anche lei, perché la revoca cancella la conferma: è un caso raro, e
    // fuori dal conto pesa meno che dentro come «non confermata».
    if (dati.stato === 'revocata') continue;

    conti.richiesteConsiderate += 1;
    if (dati.stato === 'usata') conti.segnalate += 1;
    else if (dati.stato === 'scaduta') conti.scadute += 1;
    else conti.ancoraAperte += 1;
  }

  if (conti.richiesteConsiderate > 0) {
    conti.percentualeEntro7Giorni = Math.round((conti.confermateEntro7Giorni / conti.richiesteConsiderate) * 100);
  }
  return conti;
}

export async function aggiornaStatisticheConferme(adesso = Timestamp.now()): Promise<StatisticheConferme> {
  const conti = await calcolaStatisticheConferme(adesso);
  await db.doc('statistiche/conferme').set({
    ...conti,
    calcolateIl: adesso,
    comeSiLegge:
      'Delle richieste partite da almeno 7 giorni, quante sono state confermate entro 7 giorni. ' +
      'Sotto il 50% la prova documentale diventa urgente (SPEC_POST_V1.md, condizioni di avvio).',
  });
  return conti;
}
