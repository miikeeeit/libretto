# Libretto

Le tue stagioni, confermate da chi ti ha visto lavorare.

La specifica è in [`SPEC.md`](SPEC.md) e vale come riferimento: quello che non c'è lì non si
costruisce prima di dicembre. Le decisioni prese stanno in [`DECISIONI.md`](DECISIONI.md), le idee
rimandate in [`DOPO.md`](DOPO.md).

**Stato: settimana 1 fatta** — accesso col telefono e profilo (L1–L2), più l'intestazione del
libretto (L3). Criterio della §11 soddisfatto: ti registri e vedi il tuo profilo.

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
npm run emulatori    # Auth, Firestore, Storage e la loro interfaccia su :4000
npm run dev          # l'app su :5173
```

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

## 5. Provare che non si rompe

```sh
npm run lint            # i tipi
npm test                # le regole di sicurezza: 50 prove, sull'emulatore
npm run prova:flusso    # il flusso vero in un browser (vuole emulatori + dev avviati)
```

`npm test` è la prova più importante del progetto: non dimostra che l'app funziona, dimostra che
**non** può fare quello che non deve. Che dal client non si può scrivere «confermata», che il
telefono sul profilo è solo quello verificato via SMS, che il telefono di un responsabile non si
legge, che un invito non si ruba. Se un giorno una di queste prove diventa rossa, è saltato il
principio della §1, non un dettaglio.

La prima volta, per `prova:flusso`, serve il browser: `npx playwright install chromium`.

## 6. Mandare online

```sh
npm run deploy:regole   # solo le regole di sicurezza: si può fare da subito e spesso
npm run deploy          # build + hosting + regole
```

## 7. Com'è fatto

```
src/
  config.ts          nome, testi e interruttori di prodotto (anche BETA_SU_INVITO)
  App.tsx            le rotte della §10
  auth/              chi è collegato e se ha già un libretto
  data/comuni.ts     i 33 comuni della provincia di Latina, con le coordinate per il geohash
  data/ruoli.ts      BOZZA §7: da rivedere con Mike prima della settimana 2 (PC3)
  lib/               Firebase, telefono, geohash, inviti, profilo, eventi, errori
  pages/             L1 accesso, L2 crea profilo, L3 libretto, privacy, come funziona
firestore.rules      chi può scrivere cosa: è qui che vive la fiducia
storage.rules        foto pubbliche, CV privati
test/regole.test.mjs le prove delle regole
strumenti/           inviti per l'emulatore, prova del flusso in browser
```

Due scelte che vale la pena sapere prima di leggere il codice:

- **L'indirizzo pubblico si prenota prima del profilo.** `slugs/{slug}` si può creare ma non
  modificare: chi arriva secondo su `mario-rossi-4f2a` viene fermato dalle regole. È così che due
  omonimi non finiscono sullo stesso indirizzo, e che le regole di `workers` possono controllare
  che l'indirizzo sia davvero suo.
- **Il codice di invito si controlla prima di mandare l'SMS.** I documenti `inviti` si leggono
  solo conoscendo il codice per intero (elencarli è vietato dalle regole), così il controllo si
  può fare senza essere collegati e senza spendere un SMS per scoprire che il codice era finto.

## 8. Cosa manca (§11)

| Settimana | Cosa | Stato |
|---|---|---|
| 1 | Accesso col telefono, profilo (L1–L2) | fatto |
| 2 | Stagioni e strutture (L3–L4), liste §7 | **da fare — prima serve PC3** |
| 3 | Richieste e conferma (L5, C1–C4), Cloud Functions | da fare — prima serve PC2 |
| 4 | Pagina pubblica (P1), `pubblicaProfilo`, privacy (L6), CV | da fare |
| 5 | Informativa, anti-frode §8, test di rottura | da fare — PC4 e PC5 |
| 6 | Beta chiusa con 3 colleghi | da fare |
