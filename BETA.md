# La beta chiusa — settimana 6

Fatto quando: **tre colleghi hanno almeno una stagione confermata** (§11).

Non è una settimana di codice. È la prima volta che partono SMS veri, a pagamento, e che
delle persone che non sei tu provano a capire Libretto da sole. Quello che impari qui vale
più di qualunque funzione in più.

---

## La lista della spesa

Ordine di esecuzione, non di importanza: ogni blocco dipende dal precedente. Il resto del
documento spiega il perché di ogni riga.

### Console Firebase — una volta sola

- [ ] **Crea progetto**, piano **Blaze**
- [ ] **Budget e avvisi** (console Google Cloud → Fatturazione): budget mensile basso, avvisi
      al 50/90/100 %, email attiva
- [ ] **Authentication** → attiva **Telefono**
- [ ] **Authentication → Settings → SMS region policy**: solo **Italia**
- [ ] **Firestore Database** → crea → modalità **produzione** → regione **`europe-west8`**
      ← definitiva, non si cambia
- [ ] **Storage** → inizia → stessa regione **`europe-west8`**
- [ ] **Hosting** → inizia
- [ ] **Impostazioni progetto → Le tue app** → aggiungi app **Web** → copia la configurazione SDK

I primi due prima degli altri: da quando l'accesso col telefono è attivo, gli SMS costano.

### Sul computer

- [ ] Node **20 o più** (`node -v`)
- [ ] `git clone` del repo
- [ ] `npm install`
- [ ] `cp .env.example .env` → incolla la configurazione SDK, e **`VITE_USA_EMULATORI=0`**
- [ ] `cp .firebaserc.example .firebaserc` → metti l'id vero del progetto
- [ ] `npx firebase login`

### Il lancio

- [ ] `npm test`, `npm run prova:rottura`, `npm run prova:flusso` → tutte verdi
- [ ] `npm run prontezza` → deve passare
- [ ] `VITE_USA_EMULATORI=0 npm run deploy`

### Subito dopo

- [ ] Apri `https://<progetto>.web.app`: devi vedere la schermata di accesso
- [ ] Firestore → `inviti` → un documento, id `mike-2026`, `attivo` = `true` (boolean),
      `usatoDa` vuoto (null)
- [ ] Firestore → `responsabiliNoti` → un documento per numero, id `+39…`, campo `nota` col
      nome: **Bar Somma** e **il tuo datore** (PC4)
- [ ] Il giro vero dal tuo telefono, fino a una conferma di Somma

### Quanto costa

Firestore, Hosting, Storage e Functions per cinque persone stanno **dentro le soglie gratuite**
di Blaze: praticamente zero. L'unica voce che si paga da subito sono gli **SMS di verifica**,
pochi centesimi l'uno: con te, tre colleghi e due responsabili parliamo di qualche euro al
massimo, rilanci compresi. Il prezzo esatto per l'Italia è nella pagina prezzi di Firebase, e
poi, per davvero, nel budget — è per questo che l'avviso va messo **prima**.

L'unica cosa che potrebbe fare male è un abuso di SMS dall'estero, ed è precisamente quello che
blocca la policy del primo blocco.

---

## 1. Perché quei due passaggi vengono per primi

**L'avviso di budget su Blaze.** Da quando l'accesso col telefono è attivo, ogni SMS costa. I
passaggi nel dettaglio sono nel
[README §1](README.md#1-avviso-di-budget-prima-di-ogni-altra-cosa).

**L'invio SMS limitato alla sola Italia** è la difesa che conta davvero: quasi tutto l'abuso di
SMS arriva dall'estero, e senza quel limite una notte storta si misura in centinaia di euro.

E il **controllo di prontezza** non è pignoleria: l'errore che intercetta più spesso è una build
che punta agli emulatori. Il sito si apre, sembra funzionare, e non salva niente da nessuna
parte. Per lo stesso motivo la build di produzione si rifiuta di partire da sola se il `.env`
punta ancora in locale.

## 2. Il deploy

`npm run deploy` manda online build, hosting, regole, indici e funzioni, e passa prima dal
controllo di prontezza.

La **prima volta** Firebase chiede di attivare delle API — Cloud Build, Artifact Registry,
Cloud Run, Eventarc, Cloud Scheduler: rispondi di sì, aspetta, e rilancia il comando. Chiede
anche se impostare una **politica di pulizia** per Artifact Registry: rispondi **sì**,
altrimenti accumula immagini vecchie che paghi.

Quando finisce, stampa l'indirizzo (`https://<progetto>.web.app`).

**Solo le regole**, quando cambi solo quelle: `npm run deploy:regole`. Si può fare spesso e non
tocca niente altro. Solo le funzioni: `npm run deploy:funzioni`.

## 3. Il primo giro, dal tuo telefono

Prima dei colleghi, fallo tu per intero, sul progetto vero. Serve a sapere che gli SMS
arrivano davvero, che è l'unica cosa che gli emulatori non possono dirti.

1. Crea un invito per te: console Firebase → Firestore → collezione `inviti` → documento con
   id `mike-2026`, campo `attivo` = `true`, campo `usatoDa` vuoto (tipo *null*).
2. Carica in `responsabiliNoti` i due numeri che conosci (PC4): id uguale al numero in
   formato `+39…`, campo `nota` col nome. Vedi [README §5](README.md#5-i-responsabili-che-conosci-83).
3. Apri il sito dal telefono, entra col tuo numero, crea il profilo.
4. Aggiungi una stagione vera e chiedi la conferma **a Somma**, dal tuo WhatsApp.
5. Fatti confermare per davvero. Guarda quanto ci mette e dove esita.
6. Apri il tuo link pubblico dal telefono di qualcun altro.

Se qualcosa non torna qui, fermati: non vale la pena farlo vedere a tre persone finché non è
liscio.

## 4. Chi inviti, e cosa gli dici

Cinque persone, non venti: tu, tre colleghi, e Somma e il tuo datore come responsabili.

Un codice di invito **a testa**, così sai chi è entrato e chi no: `mario-2026`, `giulia-2026`.
Un codice usato non funziona più per nessun altro.

Sul messaggio: **non spiegare l'app**. Manda il link e una riga, tipo

> Ho fatto una cosa per tenere insieme le stagioni con le conferme dei titolari. Ci metti
> cinque minuti a provarla? Il codice è `mario-2026`.

Sembra poco, ma è la prova che conta. L'obiettivo di dicembre (§12) è che **dieci colleghi su
venti mandino una richiesta di conferma senza che tu glielo abbia chiesto due volte**: se per
usarlo serve che tu stia lì a spiegarlo, quel numero non arriverà mai, e conviene saperlo
adesso che sono in tre e non a dicembre che sono venti.

Quindi: mandi il link, e **stai zitto**. Se uno si blocca, lascialo bloccare e annota dove.
Quel punto vale più di qualunque cosa tu possa aggiungere all'app.

## 5. Cosa guardare, ogni giorno

**Le segnalazioni.** Console → Firestore → `segnalazioni`. Se ce n'è una con
`tipo: "mai_lavorato"`, qualcuno dice che una stagione non è vera: guarda chi e parla con
tutte e due le persone prima di fare qualunque cosa. Dopo due segnalazioni il libretto viene
sospeso da solo e la pagina pubblica sparisce (§8.5); per riattivarlo, cancella il documento
in `sospensioni`.

**I numeri della §12.** Console → Firestore → `eventi`. Ogni documento ha un `tipo`: filtra
per quello e guarda quanti sono.

| Cosa vuoi sapere | Conta gli eventi di tipo |
|---|---|
| quanti sono entrati | `registrazione` |
| quante stagioni hanno scritto | `stagione_creata` |
| quante richieste hanno mandato | `richiesta_inviata` |
| quanti responsabili hanno aperto il link | `conferma_aperta` |
| quante conferme sono arrivate | `conferma_completata` |
| quanti hanno condiviso il link | `profilo_condiviso` |
| quante volte un profilo è stato aperto | `profilo_pubblico_visto` |

Il rapporto che conta è **`conferma_completata` diviso `conferma_aperta`**: quanti, fra i
responsabili che hanno aperto il link, sono arrivati in fondo. L'obiettivo è il 60 %. Se è più
basso, il problema è nella schermata del responsabile, non nei colleghi.

**La spesa.** Console Google Cloud → Fatturazione. Con cinque persone deve essere praticamente
zero. Se non lo è, qualcosa sta mandando SMS che non dovrebbe.

## 6. Quando qualcosa va storto

**«Non mi arriva il codice.»** Prima cosa: il numero è italiano? La policy SMS accetta solo
l'Italia. Seconda: ha scritto il numero giusto? Terza: guarda in Authentication → Users se
l'utente è stato creato. Gli SMS possono metterci un minuto.

**«Dice che il link è stato mandato a un altro numero.»** È la regola che fa funzionare
Libretto (§8.1), e il più delle volte vuol dire che chi ha scritto il numero ha sbagliato una
cifra — oppure che il responsabile ha WhatsApp su un numero e la SIM per gli SMS su un altro.
La pagina lo dice e spiega come rimediare: il collega corregge il numero dal suo libretto e
rimanda. Il link vecchio muore da solo.

**«Ho confermato per sbaglio.»** Il responsabile ha un link per revocare, valido 30 giorni,
nella schermata di ringraziamento e riaprendo lo stesso link.

**«Non ho ricevuto risposta.»** Il link scade dopo 30 giorni; poi la stagione torna
*Scaduta* e si può rimandare. Per fare prima, il collega può rimandare quando vuole: il link
di prima smette di funzionare.

**Un collega ha fatto un pasticcio e vuole ricominciare.** Può cancellare l'account dalle
impostazioni: sparisce tutto. Attenzione, il suo codice di invito resta bruciato: per
rientrare gliene serve uno nuovo.

## 7. Prima di dicembre

Quando i tre colleghi hanno una stagione confermata, la settimana 6 è finita. Poi, prima di
aprire a venti persone:

- **PC5**: informativa rivista da un professionista, e i dati veri del titolare e dell'email
  in `src/config.ts`. Finché non è fatto, `BETA_SU_INVITO` resta `true`.
- **Nome e dominio definitivi**, se li vuoi cambiare: si cambiano in `src/config.ts`, ed è il
  momento buono per farlo, prima che i link girino.
- **Parla con i tre colleghi.** Non chiedere «ti è piaciuto»: chiedi *dove ti sei fermato*, e
  *cosa hai pensato quando hai visto la schermata del responsabile*. Se ti dicono che è tutto
  bello, non hai imparato niente.

E la regola che vale fino a dicembre: le idee nuove vanno in [`DOPO.md`](DOPO.md) e restano
lì. Se i numeri di §12 non arrivano, la risposta non è una funzione in più — è capire perché,
parlando con le persone.
