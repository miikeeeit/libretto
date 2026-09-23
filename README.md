# Libretto

Le tue stagioni, confermate da chi ti ha visto lavorare.

La specifica è in [`SPEC.md`](SPEC.md) e vale come riferimento: quello che non c'è lì non si
costruisce prima di dicembre. Le decisioni prese stanno in [`DECISIONI.md`](DECISIONI.md), le idee
rimandate in [`DOPO.md`](DOPO.md).

**Stato: la v1 è costruita** (settimane 1–5) e si sta per mandare online: la beta chiusa della
settimana 6 ha il suo manuale in [`BETA.md`](BETA.md).

**Settimane 1–5 fatte.** Accesso col telefono, profilo, stagioni,
conferma del responsabile, pagina pubblica, privacy, CV, cancellazione dell'account, anti-frode
della §8 e pulizia notturna (L1–L6, C1–C4, P1). Criteri della §11 soddisfatti, compreso quello
della settimana 5: nessun caso rompe l'app.

Restano due cose, e nessuna delle due è codice: l'**avviso di budget su Blaze** (§1 qui sotto) e
**PC5**, l'informativa rivista da un professionista. La specifica dice di non aprire la
registrazione a tutti finché PC5 non è fatto.

---

## 1. Avviso di budget, prima di ogni altra cosa

L'accesso col telefono richiede il piano Blaze e **ogni SMS ha un costo**. Prima di provare
l'accesso con un telefono vero (decisione PC1: l'avviso non è ancora impostato):

1. [console.cloud.google.com/billing](https://console.cloud.google.com/billing) → il progetto →
   **Budget e avvisi** → **Crea budget**.
2. Importo mensile basso, per esempio **5 €**, e avvisi al 50 %, 90 % e 100 %.
3. Spunta l'invio dell'avviso via email.
4. Console Firebase → **Authentication** → **Settings** → **SMS region policy**: lascia attiva
   **solo l'Italia**. È la difesa che conta davvero, perché quasi tutto l'abuso di SMS arriva
   dall'estero.

Finché non hai fatto questi quattro passaggi, lavora sugli emulatori (`VITE_USA_EMULATORI=1`):
in locale nessun SMS parte e non si spende niente.

## 2. Il progetto Firebase

Una volta sola, dalla [console Firebase](https://console.firebase.google.com):

1. **Crea progetto**, piano **Blaze**.
2. **Firestore Database** → crea → **modalità di produzione** → regione **`europe-west8`
   (Milano)**. Questa scelta è definitiva (PC1).
3. **Storage** → inizia → stessa regione, **`europe-west8`**.
4. **Authentication** → inizia → attiva **Telefono**.
5. **Impostazioni progetto** → **Le tue app** → aggiungi un'app **Web** → copia la
   configurazione SDK.
6. **Hosting** → inizia (serve solo al primo deploy).

Poi in locale:

```sh
cp .env.example .env            # e incolla dentro i valori della configurazione SDK
cp .firebaserc.example .firebaserc   # e metti l'id del progetto
npm install
```

## 3. Lavorare in locale

Due terminali:

```sh
npm run emulatori    # Auth, Firestore, Storage, Functions e l'interfaccia su :4000
npm run dev          # l'app su :5173
```

`npm run emulatori` compila le funzioni prima di partire, quindi dopo una modifica in
`functions/` basta riavviarlo (o tenere aperto `npm --prefix functions run watch`).

Con `VITE_USA_EMULATORI=1` nel `.env`, l'app parla con gli emulatori: nessun SMS parte davvero e
il codice di verifica si legge nei log dell'emulatore Auth (o nell'interfaccia su
<http://127.0.0.1:4000>).

Serve un codice di invito per entrare (vedi sotto):

```sh
node strumenti/inviti-emulatore.mjs mike-2026
```

## 4. I codici di invito

Durante la beta si entra solo su invito (PC1). Un codice serve a un numero solo: quando qualcuno
lo usa, si intesta a lui e non funziona più per nessun altro.

**Sul progetto vero**, dalla console Firebase → Firestore → collezione `inviti` → aggiungi un
documento con l'**id uguale al codice** (minuscolo, senza spazi):

| Campo | Tipo | Valore |
|---|---|---|
| `attivo` | boolean | `true` |
| `usatoDa` | null | *(vuoto)* |

Per ritirare un invito non ancora usato basta mettere `attivo` a `false`.

**Sugli emulatori**: `node strumenti/inviti-emulatore.mjs <codice> [<altro>…]`.

Quando la registrazione si aprirà a tutti (fine novembre, dopo PC5) si cambiano due cose:
`BETA_SU_INVITO` in `src/config.ts` e la funzione `invitoSuo` in `firestore.rules`, che ha già il
commento su cosa aggiungere.

## 5. I responsabili che conosci (§8.3)

Un numero in questa lista diventa **«responsabile noto»** alla sua prima conferma. Il dato non
si vede da nessuna parte nella v1: serve ai tuoi controlli e servirà alla ricerca di gennaio.
Serve caricarlo prima, perché un responsabile per Libretto esiste solo dopo che ha verificato
il suo numero la prima volta.

**Sul progetto vero**, console Firebase → Firestore → collezione `responsabiliNoti` → un
documento con l'**id uguale al numero in formato internazionale** (`+393471234567`) e un campo
`nota` con il nome, per ricordarti di chi è. Sono due o tre numeri: si fanno a mano, e così non
serve scaricare una chiave di amministratore sul computer.

**Sugli emulatori**:

```sh
node strumenti/responsabili-noti-emulatore.mjs "347 123 4567=Bar Somma"
```

Da caricare prima della beta (PC4): **Bar Somma** e **il tuo datore di lavoro**.

## 6. Provare che non si rompe

```sh
npm run lint            # i tipi, anche quelli delle funzioni
npm test                # le regole di sicurezza: 57 prove, sull'emulatore
npm run prova:rottura   # i 36 casi di rottura, chiamando le funzioni a mano
npm run prova:flusso    # i 24 passaggi del flusso vero in un browser
npm run prova           # rottura + flusso di seguito
```

Le prove servono a tre cose diverse, e vale la pena sapere quale:

- **`npm test`** guarda le **regole di sicurezza**. Non dimostra che l'app funziona: dimostra che
  **non** può fare quello che non deve. Che dal client non si scrive «confermata», che il telefono
  sul profilo è solo quello verificato via SMS, che il telefono di un responsabile non si legge,
  che un invito non si ruba, che una stagione confermata si può solo nascondere.
- **`npm run prova:rottura`** attacca le **Cloud Functions** senza passare dall'interfaccia, come
  farebbe qualcuno che si è scritto il client a mano: confermarsi da soli, un link scaduto, una
  doppia conferma, i limiti della §8.4, le segnalazioni, la revoca. Se un controllo esistesse solo
  nell'interfaccia, questa prova lo scoprirebbe.
- **`npm run prova:flusso`** fa il **giro vero in un browser**, con tre finestre separate:
  il lavoratore, il responsabile e un datore che non è collegato.

Se una di queste diventa rossa, è saltato il principio della §1, non un dettaglio.

`prova:rottura` vuole gli emulatori avviati e le funzioni compilate. `prova:flusso` vuole anche
`npm run dev`, e la prima volta il browser: `npx playwright install chromium`.

## 7. Mandare online

```sh
npm run prontezza        # i controlli prima del deploy: config, progetto, scelte di prodotto
VITE_USA_EMULATORI=0 npm run deploy
```

`npm run prontezza` guarda le cose che si sbagliano quando si è di fretta. La build stessa si
rifiuta di partire se il `.env` punta ancora agli emulatori: è l'errore più facile da fare e il
più difficile da vedere, perché il sito si apre lo stesso e non salva niente.

Per gli aggiornamenti mirati:

```sh
npm run deploy:regole    # solo le regole di sicurezza: si può fare da subito e spesso
npm run deploy:funzioni  # solo le Cloud Functions
```

Le funzioni girano in `europe-west8`, come i dati: niente esce dall'Italia.

Il giro completo della prima volta — deploy, invito, primo giro dal telefono, cosa dire ai
colleghi, cosa guardare ogni giorno — è in [`BETA.md`](BETA.md).

## 8. Com'è fatto

```
src/
  config.ts          nome, testi e interruttori di prodotto (anche BETA_SU_INVITO)
  App.tsx            le rotte della §10
  auth/              chi è collegato e se ha già un libretto
  data/comuni.ts     i 33 comuni della provincia di Latina, con le coordinate per il geohash
  data/ruoli.ts      i 12 ruoli e le 54 competenze della §7, riviste il 2026-09-21 (PC3)
  lib/               Firebase, telefono, geohash, inviti, profilo, stagioni, strutture,
                     periodo, funzioni, eventi, errori
  pages/             L1 accesso, L2 crea profilo, L3 libretto, L4 stagione,
                     L5 chiedi conferma, L6 impostazioni, C1-C4 conferma,
                     P1 pagina pubblica, privacy, come funziona
functions/src/       le funzioni lato server: richieste.ts, conferme.ts, profilo.ts,
                     pulizia.ts (la pianificata di ogni notte)
firestore.rules      chi può scrivere cosa: è qui che vive la fiducia
storage.rules        foto pubbliche, CV privati
test/regole.test.mjs le prove delle regole
strumenti/           inviti e responsabili noti per l'emulatore, prova di rottura,
                     prova del flusso, controllo di prontezza
```

Sei scelte che vale la pena sapere prima di leggere il codice:

- **L'indirizzo pubblico si prenota prima del profilo.** `slugs/{slug}` si può creare ma non
  modificare: chi arriva secondo su `mario-rossi-4f2a` viene fermato dalle regole. È così che due
  omonimi non finiscono sullo stesso indirizzo, e che le regole di `workers` possono controllare
  che l'indirizzo sia davvero suo.
- **Il codice di invito si controlla prima di mandare l'SMS.** I documenti `inviti` si leggono
  solo conoscendo il codice per intero (elencarli è vietato dalle regole), così il controllo si
  può fare senza essere collegati e senza spendere un SMS per scoprire che il codice era finto.
- **Nessun controllo che dà fiducia sta nel frontend.** Il telefono del responsabile, il
  confronto con quello che ha verificato e lo stato «confermata» vivono solo dentro le Cloud
  Functions, e le regole chiudono `richieste`, `conferme`, `responsabili` e `segnalazioni` al
  client. Quello che si vede in `src/pages/Conferma.tsx` è solo l'interfaccia: se qualcuno la
  aggira, il server rifiuta comunque.
- **L'autocompletamento delle strutture cerca in due modi**: dall'inizio del nome e per parola
  intera, perché chi ha lavorato al Bar Somma scrive «somma», non «bar». Se la stessa struttura
  finisce nel database tre volte scritta in tre modi, «confermata da 3 strutture» diventa una
  bugia, e quel numero è metà del valore di Libretto.
- **La pagina pubblica non filtra niente.** Legge un documento, `profiliPubblici/{slug}`, che una
  Cloud Function ha già scritto secondo le impostazioni di privacy. Se un domani si sbaglia una
  riga in quella pagina, il peggio che può succedere è che non si veda qualcosa: mai che si veda
  qualcosa di privato, perché quel dato nel documento non c'è. Due piccole differenze dalla §6,
  volute: si salva `fotoPath` invece di `fotoUrl` (l'indirizzo lo risolve la pagina, così vale
  uguale in locale e online) e `haCv` invece di `cvUrl`, perché l'indirizzo del CV deve essere
  temporaneo e lo dà la funzione `urlCv` al momento della richiesta.
- **Una stagione confermata si può solo nascondere.** Le regole non lasciano cambiarle nient'altro,
  nemmeno riportandola in bozza: i dati di una conferma devono restare attaccati alla stagione per
  cui quella conferma è arrivata.

## 9. Cosa manca (§11)

| Settimana | Cosa | Stato |
|---|---|---|
| 1 | Accesso col telefono, profilo (L1–L2) | fatto |
| 2 | Stagioni e strutture (L3–L4), liste §7 | fatto |
| 3 | Richieste e conferma (L5, C1–C4), Cloud Functions | fatto |
| 4 | Pagina pubblica (P1), `pubblicaProfilo`, privacy (L6), CV | fatto |
| 5 | Informativa, anti-frode §8, test di rottura | fatto — resta **PC5** |
| 6 | Beta chiusa con 3 colleghi | **in corso** — vedi [`BETA.md`](BETA.md) |
