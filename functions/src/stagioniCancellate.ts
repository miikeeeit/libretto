// Quello che una stagione cancellata si porta via.
//
// Dal libretto una stagione confermata non si cancella (si nasconde), ma le regole lo
// permettono, perché è roba del lavoratore (§1, regola 3). Finora la stagione spariva e
// tutto quello che aveva intorno restava: la conferma con il responsabile, i conteggi
// della struttura e del responsabile — che contano anche per diventare «responsabile
// noto» (§8.3) — e il link ancora aperto, se la stagione aspettava una risposta.

import { FieldValue } from 'firebase-admin/firestore';
import { db } from './comune';
import { ricontrollaResponsabileNoto } from './responsabiliNoti';

export async function dopoStagioneCancellata(workerUid: string, stagioneId: string): Promise<void> {
  // Per lavoratore e poi per stagione nel codice: sono pochi documenti, e così non serve
  // un indice in più.
  const sue = await db.collection('conferme').where('workerUid', '==', workerUid).get();
  const conferme = sue.docs.filter((d) => d.data().stagioneId === stagioneId);
  const responsabili = new Set<string>();

  for (const conferma of conferme) {
    // In transazione: il trigger può girare due volte, e i conteggi non devono scendere
    // due volte.
    await db.runTransaction(async (tx) => {
      const ancora = await tx.get(conferma.ref);
      if (!ancora.exists) return;
      const dati = ancora.data() as { strutturaId?: string; responsabileUid?: string };
      const struttura = dati.strutturaId ? db.doc(`strutture/${dati.strutturaId}`) : null;
      const responsabile = dati.responsabileUid ? db.doc(`responsabili/${dati.responsabileUid}`) : null;
      const [strutturaSnap, responsabileSnap] = await Promise.all([
        struttura ? tx.get(struttura) : Promise.resolve(null),
        responsabile ? tx.get(responsabile) : Promise.resolve(null),
      ]);

      tx.delete(conferma.ref);
      if (struttura && strutturaSnap?.exists) tx.update(struttura, { nConferme: FieldValue.increment(-1) });
      if (responsabile && responsabileSnap?.exists) {
        tx.update(responsabile, { nConferme: FieldValue.increment(-1) });
      }
      if (dati.responsabileUid) responsabili.add(dati.responsabileUid);
    });
  }

  // Il link che la stagione aspettava non porta più da nessuna parte: si chiude.
  const aperte = await db
    .collection('richieste')
    .where('workerUid', '==', workerUid)
    .where('stato', '==', 'aperta')
    .get();
  const lotto = db.batch();
  let daChiudere = 0;
  for (const richiesta of aperte.docs) {
    if (richiesta.data().stagioneId !== stagioneId) continue;
    lotto.update(richiesta.ref, { stato: 'revocata' });
    daChiudere += 1;
  }
  if (daChiudere > 0) await lotto.commit();

  for (const uid of responsabili) await ricontrollaResponsabileNoto(uid);
}
