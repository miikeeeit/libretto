// Tutte le funzioni lato server della v1 (§10).
//
// Qui dentro sta quello che rende vera una conferma: il telefono del responsabile, il
// confronto con quello che ha verificato, lo stato «confermata», la copia pubblica del
// profilo. Dal client non si raggiunge niente di tutto questo.

export { creaRichiesta, leggiRichiesta } from './richieste';
export { confermaStagione, revocaConferma, segnalaStagione } from './conferme';
export { eliminaAccount, pubblicaProfilo, pubblicaProfiloStagioni, urlCv } from './profilo';
export { pulizia } from './pulizia';
