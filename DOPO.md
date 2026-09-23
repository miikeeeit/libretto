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
- **Identità visiva vera** — oggi l'app è pulita ma anonima: caratteri di sistema, un verde, schede tutte con lo stesso raggio e la stessa ombra. È il vestito predefinito di qualunque app. La direzione giusta esiste ed è nel nome: un libretto di lavoro è credibile perché è **timbrato**, e la differenza fra una stagione confermata e una dichiarata è la stessa che c'è fra un timbro e una riga scritta a penna. Rimandato di proposito: rifare palette, caratteri e schede vuol dire toccare ogni schermata, e farlo prima della beta è spendere il budget alla cieca. Prima si guarda dove la gente si blocca, poi si decide dove valga la pena essere memorabili. La gerarchia della pagina pubblica, che è l'unica cosa che un datore legge, è già stata sistemata.
- **Alleggerire il pacchetto JavaScript** — oggi sono 705 kB (184 kB compressi), quasi tutti SDK Firebase: su una 3G di fine agosto si sente, e chi apre un profilo da un annuncio è proprio chi ha la rete peggiore. Si può caricare Firestore e Storage solo quando servono e tenere leggera la pagina pubblica, che è quella che deve aprirsi in fretta. Rimandato perché non è nella specifica e perché prima va misurato sul telefono vero, non stimato.
