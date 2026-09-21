# DOPO

Idee che non entrano nella v1. Nessuna di queste si implementa prima di dicembre ([`SPEC.md` §0](SPEC.md), regole di lavoro).

Una riga per idea, con il motivo per cui è rimandata.

## Già previste dalla specifica (§2)

- **Ricerca per i datori** — si accende a gennaio, quando ci sono ~50 profili confermati in zona. Il modello dati la supporta già (`profiliPubblici`, `geohash`, `disponibile`).
- **Notifiche push o email** — nella v1 il canale è WhatsApp, e basta.
- **Account per i datori** — la verifica via SMS ne fa le veci; un account in più sarebbe una barriera in più.
- **Chat interna, candidature, recensioni testuali, stelle** — non servono né a rendere vere le conferme né a dare al lavoratore il controllo dei suoi dati (§1).

## Nate durante lo sviluppo

- **Comuni fuori dalla provincia di Latina** — l'elenco della v1 è quello della provincia (L2). Estendere quando arriva il primo collega di fuori: il file `src/data/comuni.ts` è già fatto per crescere.
- **Badge "responsabile noto" in pubblico** — la specifica (§8.3) dice esplicitamente che nella v1 il flag `verificatoAdmin` serve solo ai controlli di Mike, non alla pagina pubblica.
