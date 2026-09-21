// Nome, testi e costanti di prodotto in un posto solo.
// PC1 (2026-09-21): "Libretto" è provvisorio, il dominio non è deciso.
// Quando Mike sceglie il nome definitivo (settimana 5) si cambia qui e basta.

export const NOME_APP = 'Libretto';
export const CLAIM = 'Le tue stagioni, confermate da chi ti ha visto lavorare.';

/** Versione dell'informativa privacy accettata all'accesso. Si alza quando il testo cambia. */
export const VERSIONE_INFORMATIVA = '1';

/** Email per le richieste privacy (§9). Da sostituire con quella definitiva prima del lancio. */
export const EMAIL_PRIVACY = 'privacy@example.org';

/** La stagione per cui si dichiara la disponibilità (§4.3: "Disponibile per la stagione 2027"). */
export const STAGIONE_DISPONIBILITA = '2027';

/** Provincia coperta dalla v1 (L2: elenco fisso dei comuni, poi estendibile). */
export const PROVINCIA = 'LT';

/**
 * Beta su invito — PC1 (2026-09-21).
 * Finché è `true`, l'accesso chiede un codice prima di mandare l'SMS.
 * A fine novembre, dopo PC5, si mette `false` e la registrazione è aperta a tutti.
 */
export const BETA_SU_INVITO = true;
