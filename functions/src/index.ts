// Le funzioni lato server della v1 (§10).
//
// Settimana 3: richieste e conferme.
// Settimana 4: profilo pubblico, CV e cancellazione dell'account.
// Settimana 5: `pulizia`, la pianificata che chiude le richieste scadute.

export { creaRichiesta, leggiRichiesta } from './richieste';
export { confermaStagione, revocaConferma, segnalaStagione } from './conferme';
export { eliminaAccount, pubblicaProfilo, pubblicaProfiloStagioni, urlCv } from './profilo';
