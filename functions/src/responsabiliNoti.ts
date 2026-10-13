// Il «responsabile noto» (§8.3): chi lo diventa, e quando smette di esserlo.
//
// Sta in un file suo perché lo usano sia le conferme sia la pulizia di una stagione
// cancellata, e così nessuno dei due deve importare l'altro.

import { CONFERME_PER_RESPONSABILE_NOTO, db, numeroNoto } from './comune';

/**
 * §8.3 · «Responsabile noto». Nella v1 il dato non si vede da nessuna parte: serve ai
 * controlli dell'admin e servirà alla ricerca di gennaio. Due strade per diventarlo.
 *
 * La prima (PC4, 2026-09-23): il numero sta nella lista che Mike carica a mano, in
 * `responsabiliNoti`. Si controlla qui e non prima perché un responsabile esiste per
 * Libretto solo dopo aver verificato il suo numero la prima volta: fino a quel momento
 * non c'è nessun documento su cui mettere il flag. Così Mike può caricare i numeri
 * in anticipo e il flag si applica da solo alla prima conferma.
 *
 * La seconda: averne confermati tre diversi nella stessa struttura.
 */
export async function aggiornaResponsabileNoto(
  responsabileUid: string,
  telefono: string,
  strutturaId: string,
): Promise<void> {
  if (await numeroNoto(telefono)) {
    await db
      .doc(`responsabili/${responsabileUid}`)
      .set({ verificatoAdmin: true, verificatoDa: 'lista' }, { merge: true });
    return;
  }

  const suoi = await db
    .collection('conferme')
    .where('responsabileUid', '==', responsabileUid)
    .where('strutturaId', '==', strutturaId)
    .get();

  const lavoratoriDiversi = new Set(suoi.docs.map((d) => (d.data() as { workerUid: string }).workerUid));
  if (lavoratoriDiversi.size >= CONFERME_PER_RESPONSABILE_NOTO) {
    // `verificatoDa` dice da dove viene il titolo: quello guadagnato con le conferme si
    // può perdere con una revoca, quello della lista di Mike no.
    await db
      .doc(`responsabili/${responsabileUid}`)
      .set({ verificatoAdmin: true, verificatoDa: 'conferme' }, { merge: true });
  }
}

/**
 * Dopo una revoca: se il titolo di «noto» era arrivato dalle conferme e ora non c'è più
 * nessuna struttura con tre lavoratori diversi confermati, si toglie. Prima restava per
 * sempre. Non tocca mai il titolo dato dalla lista di Mike, né uno messo a mano dalla
 * console (che non ha `verificatoDa`).
 */
export async function ricontrollaResponsabileNoto(responsabileUid: string): Promise<void> {
  const ref = db.doc(`responsabili/${responsabileUid}`);
  const responsabile = await ref.get();
  if (responsabile.data()?.verificatoDa !== 'conferme') return;

  const sue = await db.collection('conferme').where('responsabileUid', '==', responsabileUid).get();
  const lavoratoriPerStruttura = new Map<string, Set<string>>();
  for (const d of sue.docs) {
    const { strutturaId, workerUid } = d.data() as { strutturaId: string; workerUid: string };
    if (!lavoratoriPerStruttura.has(strutturaId)) lavoratoriPerStruttura.set(strutturaId, new Set());
    lavoratoriPerStruttura.get(strutturaId)!.add(workerUid);
  }
  const ancoraNoto = [...lavoratoriPerStruttura.values()].some(
    (lavoratori) => lavoratori.size >= CONFERME_PER_RESPONSABILE_NOTO,
  );
  if (!ancoraNoto) await ref.set({ verificatoAdmin: false, verificatoDa: null }, { merge: true });
}
