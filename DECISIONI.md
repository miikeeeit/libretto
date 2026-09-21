# Registro delle decisioni

Le decisioni che spettano a Mike, con la data in cui le ha prese. I punti di controllo sono descritti in [`SPEC.md` §0](SPEC.md#0-istruzioni-per-lassistente-di-sviluppo-leggere-per-prime).

| Data | Punto | Decisione di Mike |
|---|---|---|
| 2026-09-21 | PC1 · Regione | **`europe-west8` (Milano)**, regione singola. Definitiva: vale per Firestore e per Storage. |
| 2026-09-21 | PC1 · Blaze + avviso budget | Piano Blaze **attivo**, avviso di budget **ancora da impostare**. Fino a quel momento si sviluppa sugli emulatori: l'accesso con telefono vero non si abilita. Vedi [`README.md`](README.md#1-avviso-di-budget-prima-di-ogni-altra-cosa). |
| 2026-09-21 | PC1 · Beta aperta o su invito | **Solo con codice di invito.** L1 chiede il codice prima di mandare l'SMS; l'apertura a tutti è un interruttore da attivare a fine novembre, dopo PC5. |
| 2026-09-21 | PC1 · Nome e dominio | **"Libretto" provvisorio**, dominio non deciso. Nome e testi centralizzati in `src/config.ts`. Da ricordare a Mike alla settimana 5. |
| 2026-09-21 | PC2 · Nome responsabile nascosto | **Confermato.** Il nome si salva solo per scrivere il messaggio WhatsApp e non compare su nessuna pagina: in pubblico si legge il ruolo («confermata dal titolare»). Nota per l'informativa: la **struttura si vede**, quindi non si promette l'anonimato, si promette che il nome non lo pubblichiamo noi. |
| 2026-09-21 | PC2 · Link legato al numero | **Confermato.** Il telefono verificato deve essere quello indicato dal lavoratore: un link inoltrato non funziona (§8.1). |
| 2026-09-21 | PC2 · Numero che non coincide | La pagina **dice come rimediare** invece di finire in un vicolo cieco: «chiedigli di rimandartelo su questo numero». Il lavoratore corregge il numero e rimanda da L5; il token vecchio viene revocato e ne nasce uno nuovo. La regola resta intera, ma una conferma non si perde per un refuso — ed è lì che si gioca il 60 % della §12. |
| 2026-09-21 | PC2 · Solo giudizi positivi | **Confermato.** «Lo riprenderei» facoltativo, nessun campo negativo, nessun testo libero. Le segnalazioni restano solo per «non ha mai lavorato qui» e arrivano all'admin. |
| 2026-09-21 | PC3 · Lista ruoli e competenze rivista | **12 ruoli, 54 competenze** (§7 aggiornata). Quattro scelte: (1) le competenze che valgono in più ruoli hanno **un id solo** (`generale.cassa`, `generale.haccp`, `generale.inglese`…), così la pagina pubblica le conta insieme; (2) **HACCP** = procedure rispettate, non l'attestato: un pezzo di carta non è osservabile in un turno; (3) aggiunti i ruoli **Spiaggia e stabilimenti**, **Pizzeria** e **Animazione**; (4) **togliere** le righe che ha chiunque faccia quel ruolo (*servizio al tavolo*, *lavaggio stoviglie*, *camere*). |
| | PC4 · Responsabili verificati a mano | |
| | PC5 · Informativa rivista da professionista | |

## Cose da ricordare a Mike

- **Settimana 1**: impostare l'avviso di budget su Blaze prima di provare l'accesso con un telefono vero.
- **Settimana 2**: gli id delle competenze si possono ancora cambiare senza perdere niente. Dopo le prime conferme vere, no.
- **Settimana 5**: nome definitivo e dominio.
- **Settimana 5 (PC5)**: informativa privacy rivista da un professionista, e avviso di budget ancora attivo.
