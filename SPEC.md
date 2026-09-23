# LIBRETTO — Specifica versione 1

Documento di riferimento per costruire la prima versione pubblica. Vale come handoff: chi scrive il codice (tu o un assistente) deve poter partire da qui senza altre domande.

---

## 0. Istruzioni per l'assistente di sviluppo (leggere per prime)

Questa sezione è rivolta a Claude Code o a qualunque assistente che lavori al progetto. I **punti di controllo** qui sotto sono decisioni che spettano a Mike. Quando il lavoro arriva a uno di questi punti, **fermati e chiedi a Mike**, prima di scrivere il codice che dipende da quella decisione. Non scegliere al posto suo e non usare un valore predefinito senza chiedere. Dopo la risposta, scrivi la decisione nel registro in fondo a questa sezione, con la data.

> Il registro delle decisioni vive in [`DECISIONI.md`](DECISIONI.md), non qui: è un file che cambia spesso, la specifica no.

### Punti di controllo

**PC1 · Prima di creare il progetto Firebase (inizio settimana 1)**
- Regione di Firestore e Storage: `europe-west8` (Milano) o multi-regione `eur3`? È una scelta definitiva, dopo la creazione non si può cambiare. (§6, §13.3)
- Piano Blaze: confermare che Mike lo ha attivato e **impostato un avviso di budget basso** prima di abilitare l'accesso con telefono, perché ogni SMS ha un costo. (§10)
- Registrazione durante la beta: aperta a tutti o solo con codice di invito? (§13.4)
- Nome definitivo e dominio, se già decisi. Se non lo sono, usa "Libretto" come nome provvisorio e ricordalo a Mike alla settimana 5. (§13.2)

**PC2 · Prima di implementare la conferma del responsabile (inizio settimana 3)**
Presentare a Mike queste tre scelte della specifica e chiedere se le conferma così:
1. Il **nome del responsabile non compare mai** in pubblico: si mostra solo il ruolo (es. "confermata dal titolare"). (§4.3, §9)
2. Il link di conferma è **legato al numero indicato dal lavoratore**: se il telefono verificato è diverso, la conferma è bloccata. (§4.2 C2, §8.1)
3. Si salvano **solo giudizi positivi**: "lo riprenderei" è facoltativo, e non esiste un campo negativo. (§1, §9)

**PC3 · Prima di implementare stagioni e competenze (inizio settimana 2)**
- La lista di ruoli e competenze della §7 è una **bozza**. Chiedi a Mike di rivederla e correggerla riga per riga prima di scriverla nel codice. Criterio da ricordargli: ogni competenza deve essere osservabile in un turno.

**PC4 · Prima dei test anti-frode (settimana 5)**
- Chiedi a Mike quali responsabili segnare a mano come `verificatoAdmin` (indicativamente: Bar Somma, il suo datore di lavoro, l'Oasi di Kufra) e i loro numeri. (§8.3)

**PC5 · Prima del lancio pubblico (fine novembre)**
- Ricordare a Mike di far **rivedere l'informativa privacy e la base giuridica da un professionista**. Non aprire la registrazione a tutti finché Mike non conferma che è stato fatto. (§9)
- Verificare con Mike che l'avviso di budget su Blaze sia ancora attivo.

### Regole di lavoro

- **Nessuna funzione fuori da questa specifica prima di dicembre.** Se Mike o tu proponete un'idea nuova, scrivila in `DOPO.md` con una riga di motivazione, e torna al piano. Se Mike insiste, ricordagli questa regola una volta; la decisione finale è sua.
- La **ricerca per i datori** non si implementa nella v1, ma il modello dati (`profiliPubblici`, `geohash`, `disponibile`) deve già supportarla. (§2, §6)
- Ogni settimana termina con il criterio "Fatto quando" della §11. Non si passa alla settimana dopo finché non è soddisfatto.

---

## 1. Principio guida

Libretto è affidabile se **ogni conferma che si vede è vera** e se **il lavoratore controlla i suoi dati**. Ogni scelta di questa versione serve a una di queste due cose. Se una funzione non serve né all'una né all'altra, non entra nella v1.

Tre regole che non si toccano:

1. Una conferma vale solo se arriva da un telefono verificato con codice SMS, e quel telefono deve essere lo stesso numero indicato dal lavoratore.
2. Libretto registra solo giudizi positivi. "Lo riprenderei" è facoltativo. Se manca, non vuol dire niente, e un giudizio negativo non viene mai salvato.
3. Il lavoratore può nascondere, esportare o cancellare tutto con un tap, in qualsiasi momento.

---

## 2. Perimetro

**Dentro la v1**
- Accesso lavoratore con numero di telefono e codice SMS (niente password).
- Profilo: nome, foto, ruolo principale, comune, interruttore "disponibile per la prossima stagione".
- Stagioni: struttura, ruolo, periodo, competenze dichiarate.
- Richiesta di conferma, mandata dal WhatsApp del lavoratore con un link personale.
- Conferma del responsabile con verifica del telefono via SMS: conferma la stagione e le competenze e, se vuole, aggiunge "lo riprenderei".
- Pagina pubblica del profilo, con le cose confermate separate da quelle solo dichiarate.
- CV in PDF come allegato facoltativo.
- Privacy: visibilità, esportazione dati, cancellazione account, informativa, consensi.

**Fuori dalla v1 (già previsto nel modello dati)**
- Ricerca per i datori (si accende a gennaio, con circa 50 profili confermati in zona).
- Notifiche push o email: il canale è WhatsApp.
- Account per i datori: la verifica via SMS ne fa le veci.
- Chat interna, candidature, recensioni testuali, stelle.

---

## 3. Attori

| Attore | Chi è | Come si identifica |
|---|---|---|
| Lavoratore | chi costruisce il proprio libretto | telefono + SMS |
| Responsabile | chi ha visto lavorare la persona (titolare, capo sala, chef, direttore) | telefono + SMS, solo al momento della conferma |
| Visitatore | chiunque apra un link pubblico, di solito un datore | nessuna identificazione |
| Admin | tu | account admin su Firebase |

Requisito: il lavoratore deve essere **maggiorenne**. Lo dichiara con una casella all'accesso. È la scelta più semplice e più prudente per la v1.

---

## 4. Flussi e schermate

### 4.1 Lavoratore

**L1 · Accesso**
Campo telefono → codice SMS → casella "ho almeno 18 anni" → casella "ho letto l'informativa" (con link). Al primo accesso si passa a L2, poi sempre a L3.

**L2 · Crea il tuo profilo**
Nome e cognome, foto (facoltativa ma consigliata), ruolo principale (vedi §7), comune (autocompletamento da un elenco fisso dei comuni della provincia di Latina, poi estendibile). Pulsante "Crea il mio libretto".

**L3 · Il mio libretto (home)**
- In alto: foto, nome, ruolo e i numeri del profilo, per esempio "6 stagioni · 4 confermate · 3 lo riprenderebbero".
- Interruttore "Disponibile per la prossima stagione".
- Lista delle stagioni, dalla più recente, ognuna con uno stato:
  - **Bozza** (grigio chiaro): conferma non ancora richiesta.
  - **In attesa** (grigio): richiesta mandata, con il pulsante "Rimanda".
  - **Confermata** (verde): con l'eventuale badge "lo riprenderebbe".
  - **Non confermata** (neutro): il responsabile ha detto che non corrisponde. La vede solo il lavoratore, che può correggerla o cancellarla.
  - **Scaduta**: link non usato entro 30 giorni, con il pulsante "Rimanda".
- Pulsanti: "Aggiungi stagione", "Vedi la mia pagina pubblica", "Condividi il link".

**L4 · Aggiungi stagione**
1. Struttura: autocompletamento dalle strutture già esistenti. Se non c'è, "Aggiungi struttura" con nome + comune.
2. Ruolo in quella stagione (vedi §7).
3. Periodo: mese/anno di inizio e fine.
4. Competenze: la lista delle competenze del ruolo scelto, con le caselle da spuntare (vedi §7).
5. Salva → la stagione diventa Bozza e si passa a L5.

**L5 · Chiedi la conferma**
Campi: nome del responsabile e suo numero di telefono. Il numero non può essere quello del lavoratore.
Pulsante "Manda su WhatsApp": apre `https://wa.me/<numero>?text=<messaggio>` con il messaggio già scritto (§5). Il lavoratore lo manda dal suo WhatsApp, quindi il responsabile riceve un messaggio da una persona che conosce, non da un servizio sconosciuto.
Pulsante secondario "Copia il link", per chi vuole mandarlo in un altro modo.
La stagione passa a In attesa.

**L6 · Impostazioni e privacy**
- Visibilità del profilo: **pubblico con link** (predefinito, non indicizzato dai motori di ricerca) oppure **privato** (il link non funziona).
- Mostra il mio telefono sulla pagina pubblica: sì/no (predefinito: no; il datore contatta con il pulsante WhatsApp solo se è sì).
- Mostra le stagioni in attesa sulla pagina pubblica: sì/no (predefinito: no).
- Nascondi una singola stagione.
- CV: carica o sostituisci il PDF (max 5 MB); mostra sulla pagina pubblica: sì/no.
- Scarica i miei dati (JSON).
- Elimina il mio account: cancella profilo, stagioni, richieste, conferme ricevute, foto e CV. Chiede una conferma scritta ("ELIMINA").

### 4.2 Responsabile

**C1 · Pagina di conferma** (`/c/<token>`)
Mostra quattro righe e niente altro:

> **Mario Rossi** dice di aver lavorato da te.
> **Struttura:** Agriturismo X, Terracina
> **Ruolo:** Cameriere di sala
> **Periodo:** maggio – settembre 2025

Sotto: "Per confermare, verifica il tuo numero". Il numero è già scritto e mascherato (es. 347 •••• 21), perché è quello indicato dal lavoratore.
Se il link è scaduto, già usato o revocato, compare un messaggio chiaro e nient'altro.

**C2 · Verifica** Il codice SMS arriva a quel numero e il responsabile lo inserisce. Se il telefono verificato non coincide con il numero indicato, la conferma viene bloccata.

> PC2 (2026-09-21): al messaggio "Questo link è stato inviato a un altro numero" si aggiunge come rimediare — "se hai lavorato con {nome}, chiedigli di rimandartelo su questo numero" — perché la regola resta intera ma la conferma non si perde per una cifra sbagliata. Il lavoratore corregge il numero e rimanda da L5: il token vecchio viene revocato e ne nasce uno nuovo.

**C3 · Conferma**
- Pulsante principale: **"Confermo, ha lavorato qui"**.
- Competenze: le competenze dichiarate dal lavoratore, già spuntate. Il responsabile toglie quelle che non riconosce. Quelle che restano spuntate diventano confermate.
- Interruttore facoltativo: **"Lo riprenderei"**.
- Campo "Il tuo ruolo": titolare / direttore / responsabile di sala / chef / altro.
- Casella del consenso (vedi §9).
- Link secondario, piccolo: "Non corrisponde al vero". Apre una scelta tra "Non ha mai lavorato qui" e "I dati sono sbagliati". La stagione diventa Non confermata e la segnalazione arriva all'admin se il motivo è "mai lavorato qui".

**C4 · Grazie**
"Fatto. Mario ora ha questa stagione confermata."
Riga di crescita: "Anche i tuoi collaboratori possono avere il loro libretto" e un pulsante "Manda il link" che apre la condivisione di WhatsApp con un invito generico.
Link discreto: "Hai confermato per errore? Revoca": il responsabile può revocare entro 30 giorni.

### 4.3 Visitatore (datore)

**P1 · Pagina pubblica** (`/p/<slug>`)
- Foto, nome, ruolo principale, comune.
- Badge "Disponibile per la stagione 2027" se l'interruttore è attivo.
- Riepilogo: "4 stagioni confermate da 3 strutture · 3 lo riprenderebbero".
- Stagioni confermate (verde): struttura, comune, ruolo, periodo, "Confermata dal titolare" (si mostra **il ruolo** del responsabile, **mai il nome**), badge "Lo riprenderebbe".
- Competenze in due gruppi separati visivamente:
  - **Confermate** (con il numero di strutture che le hanno confermate, es. "Cassa · confermata da 2").
  - **Dichiarate** (testo grigio).
- CV scaricabile, se il lavoratore lo ha reso visibile.
- Pulsante "Contatta su WhatsApp", se il lavoratore mostra il telefono.
- In fondo: "Come funziona Libretto" (tre righe che spiegano cos'è una conferma verificata).
- `<meta name="robots" content="noindex">`.

---

## 5. Testi

**Messaggio WhatsApp di richiesta** (dal lavoratore al responsabile):

> Ciao {nomeResponsabile}, sono {nomeLavoratore}. Sto raccogliendo le conferme delle mie stagioni su Libretto. Mi confermi che ho lavorato da {struttura} come {ruolo} ({periodo})? Ti basta un minuto: {link}
> Grazie!

**Messaggio di invito dal responsabile** (C4):

> Ciao! Uso Libretto per confermare le stagioni di chi ha lavorato con me. Se vuoi, crea il tuo libretto qui: {linkHome}

**SMS di verifica**: è il testo predefinito di Firebase, non modificabile.

Regola di tono per tutta l'app: si scrive da collega a collega, con frasi corte e senza tecnicismi. Mai "utente", mai "candidato".

---

## 6. Modello dati (Firestore)

Regione: `europe-west8` (Milano) o multi-regione `eur3`. Da decidere prima della creazione del database, perché dopo non si cambia.

```
workers/{uid}
  nome, cognome, fotoPath
  telefono            // da Auth, solo lettura
  ruoloPrincipale     // id ruolo
  comune, provincia
  geohash             // del comune, per la ricerca futura
  disponibile: bool
  stagioneDisponibile // es. "2027"
  slug                // univoco, es. "mario-rossi-4f2a"
  privacy: { pubblico, mostraTelefono, mostraInAttesa, mostraCv }
  cvPath | null
  consensi: { maggiorenne: ts, informativa: {versione, ts} }
  createdAt, updatedAt

workers/{uid}/stagioni/{stagioneId}
  strutturaId, strutturaNome, strutturaComune   // nome e comune copiati al momento
  ruolo
  dal: "2025-05", al: "2025-09"
  competenzeDichiarate: [ids]
  competenzeConfermate: [ids]       // scritte solo dalla Cloud Function
  stato: bozza | in_attesa | confermata | non_confermata | scaduta
  nascosta: bool
  riprenderebbe: bool               // scritto solo dalla Cloud Function
  ruoloResponsabile                 // scritto solo dalla Cloud Function
  richiestaId | null

richieste/{token}          // token casuale di 32 caratteri = id del documento
  workerUid, stagioneId
  nomeResponsabile
  telefonoResponsabile     // E.164, leggibile solo dalla Cloud Function
  stato: aperta | usata | scaduta | revocata
  createdAt, scadeIl       // +30 giorni

conferme/{confermaId}
  workerUid, stagioneId, strutturaId
  responsabileUid
  competenzeConfermate: [ids]
  riprenderebbe: bool
  ruoloResponsabile
  consenso: { versione, ts }
  revocabileFinoA          // +30 giorni
  createdAt

responsabili/{uid}         // uid dell'Auth via telefono
  telefono
  strutture: [strutturaId]
  nConferme
  verificatoAdmin: bool    // "responsabile noto", vedi §8

strutture/{strutturaId}
  nome, nomeNormalizzato, comune, provincia, geohash
  nConferme
  creataDa: uid
  unitaA: strutturaId | null   // per unire i duplicati da admin

profiliPubblici/{slug}     // copia pubblica, scritta SOLO dalla Cloud Function
  nome, fotoUrl, ruoloPrincipale, comune, geohash
  disponibile, stagioneDisponibile
  telefono | null
  stagioni: [{ struttura, comune, ruolo, dal, al, stato, riprenderebbe, ruoloResponsabile }]
  competenze: { confermate: {id: nStrutture}, dichiarate: [ids] }
  riepilogo: { nStagioni, nConfermate, nStrutture, nRiprenderebbe }
  cvUrl | null
  updatedAt

segnalazioni/{id}
  tipo, richiestaId, workerUid, createdAt, gestita: bool
```

**Perché `profiliPubblici` esiste come collezione a parte.** La pagina pubblica legge un solo documento, che contiene solo dati già filtrati secondo la privacy. I dati privati non sono mai leggibili da chi non è il proprietario. Ed è anche la collezione su cui girerà la ricerca di gennaio (per ruolo, disponibilità, geohash), quindi la ricerca non richiederà di rifare niente.

---

## 7. Ruoli e competenze

> Rivista con Mike il **2026-09-21** (PC3). La bozza di partenza di questo documento è nella cronologia di git; la lista che conta è quella in `src/data/ruoli.ts`, e questa tabella la rispecchia.

Il criterio di ogni riga è che la competenza sia **osservabile in un turno**, cioè che un responsabile possa dire sì o no senza pensarci. Per questo sono fuori due tipi di righe: quelle che ha chiunque faccia quel ruolo (dicono zero su una pagina pubblica) e quelle su cui il responsabile si fermerebbe a chiedersi cosa vogliano dire.

**Trasversali** (`generale.*`), un id solo per tutti i ruoli che le usano, così la pagina pubblica le conta insieme: cassa e chiusura di cassa · procedure HACCP rispettate · apertura e chiusura in autonomia · formazione dei nuovi · inglese, tedesco, francese e spagnolo con i clienti.

| Ruolo | Competenze proprie del ruolo | Trasversali |
|---|---|---|
| Sala | palmare e comande digitali · gestione di un rango in autonomia · tiene il ritmo nel pieno del servizio · banchetti ed eventi · consiglia il vino al tavolo | inglese · apertura/chiusura · formazione nuovi |
| Bar | caffetteria · cocktail base · tiene il banco nell'affollamento · inventario e ordini | cassa · inglese · apertura/chiusura |
| Cucina | linea calda · linea fredda e antipasti · taglio e mise en place · pasticceria · tiene la linea nel pieno del servizio · ordini ai fornitori | HACCP |
| Pizzeria | impasto e lieviti · forno · banco e farcitura nel picco · pizza al taglio e in teglia | HACCP |
| Lavaggio | sta al passo nel pieno del servizio · pulizia della cucina a fine servizio · cura di macchina e attrezzature | HACCP |
| Reception | check-in/check-out · gestionale alberghiero · telefono e prenotazioni | cassa · inglese · tedesco · francese · spagnolo |
| Housekeeping | camere in partenza e riassetti · tiene il numero di camere del turno · aree comuni · lavanderia · gestione della biancheria | — |
| Spiaggia e stabilimenti | ombrelloni, lettini e assegnazione posti · servizio di salvataggio in torretta · chiosco e servizio in spiaggia · prenotazioni e abbonamenti | cassa · inglese · apertura/chiusura |
| Animazione | mini club e bambini · tornei e attività sportive · serate e spettacoli · audio e luci di base | inglese · tedesco |
| Cassa | fondo cassa e gestione dei resti | cassa · inglese |
| Commesso/a | vendita assistita · allestimento delle vetrine · magazzino e inventario | cassa · inglese |
| Responsabile | gestione dei turni · gestione dei reclami · chiusure di cassa · ordini ai fornitori | formazione nuovi |

Le competenze sono salvate con id stabili (`sala.palmare`, `generale.cassa`…), quindi i testi si possono cambiare senza rompere i dati. Cambiare un **id**, invece, significa perdere le conferme già raccolte su quella riga: si fa solo finché non ci sono conferme vere in giro.

---

## 8. Regole anti-frode

Una frode resta sempre possibile. L'obiettivo della v1 è renderla scomoda e visibile.

1. **Telefono verificato uguale al numero indicato.** Il link inoltrato a un'altra persona non funziona.
2. **Il numero del responsabile deve essere diverso da quello del lavoratore**, e un lavoratore non può usare come responsabile un numero che è registrato come lavoratore nella stessa struttura e nello stesso periodo.
3. **Responsabile noto.** Il flag `verificatoAdmin` lo metti tu a mano per i responsabili che conosci, cioè Somma, il tuo datore e l'Oasi. Diventa automatico quando un numero ha confermato almeno 3 lavoratori diversi della stessa struttura. Sulla pagina pubblica le conferme dei responsabili noti non hanno un badge diverso nella v1: il dato serve a te per i controlli e servirà alla ricerca.
4. **Limite**: al massimo 10 conferme al giorno per responsabile, e al massimo 5 richieste aperte per lavoratore.
5. **Segnalazioni** "mai lavorato qui": arrivano a te; dopo 2 segnalazioni l'account del lavoratore viene sospeso finché non lo rivedi.

---

## 9. Privacy e GDPR

> Nota: questi sono i punti che il prodotto deve coprire. Il testo dell'informativa e la base giuridica vanno fatti rivedere da un professionista prima del lancio pubblico. Non è un parere legale.

- **Titolare del trattamento**: tu, come persona fisica (o la ditta, se la apri). Indirizzo email dedicato per le richieste privacy.
- **Dati del lavoratore**: base giuridica è il consenso all'accesso. Minimizzazione: niente data di nascita, niente indirizzo, niente codice fiscale.
- **Dati del responsabile**: si salvano solo il telefono (per la verifica) e il ruolo. Il nome inserito dal lavoratore serve solo per il messaggio e **non appare mai in pubblico**. Il responsabile dà il consenso alla pubblicazione della sua conferma quando conferma, con una casella chiara: "La mia conferma, senza il mio nome, sarà visibile sul profilo di {nome}".
- **Giudizi**: si salvano solo quelli positivi. Nessun campo "non lo riprenderei".
- **Diritti**: esportazione (L6), cancellazione (L6), revoca della conferma da parte del responsabile (C4, entro 30 giorni; dopo, scrivendo all'email privacy).
- **Conservazione**: le richieste **chiuse** (usate, scadute o revocate) si cancellano dopo 90 giorni, e con loro il nome e il telefono del responsabile; lo fa la pianificata `pulizia` ogni notte. Un link non usato scade dopo 30 giorni. Gli account inattivi da 3 anni ricevono un avviso e poi vengono cancellati — non implementato: il primo caso possibile è nel 2029 e serve leggere l'ultimo accesso da Firebase Auth.
- **Tracciamento**: nessuno strumento di analytics di terze parti nella v1, quindi niente banner dei cookie. Si contano solo gli eventi essenziali (vedi §12) in Firestore.
- **Dati in UE**: la regione Firestore e Storage in Europa (§6).
- **Pagine**: `/privacy` (informativa) e `/come-funziona`.

---

## 10. Stack e architettura

- **Frontend**: React PWA, installabile. Rotte: `/` (landing + accesso), `/libretto`, `/stagione/nuova`, `/impostazioni`, `/c/:token`, `/p/:slug`, `/privacy`, `/come-funziona`.
- **Hosting**: Firebase Hosting.
- **Auth**: Firebase Authentication con telefono (reCAPTCHA invisibile). Richiede il **piano Blaze** (a consumo): imposta subito un avviso di budget basso, perché ogni SMS ha un costo.
- **Database**: Firestore.
- **File**: Cloud Storage. Foto pubbliche. CV **privati**: la pagina pubblica ottiene un URL firmato e temporaneo tramite Cloud Function.
- **Cloud Functions** (lato server, necessarie per la fiducia):
  - `creaRichiesta` (callable): genera il token, salva il telefono del responsabile, restituisce il link.
  - `leggiRichiesta` (callable, senza login): restituisce solo le quattro righe e il numero mascherato.
  - `confermaStagione` (callable, con login via telefono): controlla il token, lo stato, la scadenza e che il telefono coincida; scrive `conferme`, aggiorna la stagione, `responsabili`, `strutture`; chiude la richiesta.
  - `segnalaStagione`, `revocaConferma`.
  - `pubblicaProfilo` (trigger su ogni scrittura in `workers/{uid}` e nelle sue stagioni): ricostruisce `profiliPubblici/{slug}` rispettando la privacy.
  - `eliminaAccount`: cancella tutto, anche i file.
  - `pulizia` (pianificata ogni giorno): richieste scadute, conteggi.

### Regole di sicurezza (sintesi)

```
workers/{uid}                      lettura/scrittura: solo request.auth.uid == uid
                                   campi vietati al client: telefono, slug (dopo la creazione)
workers/{uid}/stagioni/{id}        lettura/scrittura: solo il proprietario
                                   campi vietati al client: competenzeConfermate, riprenderebbe,
                                   ruoloResponsabile, stato == "confermata"
richieste, conferme, responsabili,
segnalazioni                       nessun accesso dal client (solo Cloud Functions)
strutture                          lettura: tutti; creazione: utenti loggati con campi validati;
                                   modifica: nessuno dal client
profiliPubblici                    lettura: tutti; scrittura: nessuno dal client
```

---

## 11. Piano di lavoro

| Periodo | Obiettivo | Fatto quando |
|---|---|---|
| Settimana 1 | Progetto Firebase (Blaze + avviso budget, regione UE), accesso con telefono, profilo (L1–L2) | ti registri e vedi il tuo profilo |
| Settimana 2 | Stagioni e strutture (L3–L4), liste §7 | aggiungi le tue 5 stagioni |
| Settimana 3 | Richieste e conferma (L5, C1–C4), Cloud Functions, regole | il tuo datore conferma una tua stagione dal suo telefono |
| Settimana 4 | Pagina pubblica (P1), `pubblicaProfilo`, privacy (L6), CV | apri il tuo link dal telefono di un altro e vedi solo quello che devi vedere |
| Settimana 5 | Informativa, anti-frode §8, test di rottura (link scaduti, numero sbagliato, doppia conferma, cancellazione) | nessun caso rompe l'app |
| Settimana 6 | Beta chiusa: tu, 3 colleghi, Somma e il tuo datore come responsabili | 3 colleghi con almeno una stagione confermata |
| Fine novembre | Online | |
| Dicembre | 20 colleghi | vedi §12 |
| Gennaio | Ricerca per i datori (nuova specifica breve) | ~50 profili confermati in zona |

Regola per tutto il periodo: nessuna funzione nuova fuori da questa specifica prima di dicembre. Le idee nuove vanno in un file `DOPO.md` e restano lì.

---

## 12. Come si misura se funziona

Eventi salvati in Firestore (`eventi/{id}`: tipo, ts, uid anonimo):
`registrazione`, `stagione_creata`, `richiesta_inviata`, `conferma_aperta`, `conferma_completata`, `profilo_condiviso`, `profilo_pubblico_visto`.

**Obiettivo di dicembre (il criterio dei lavoratori):**
- almeno **10 dei 20** colleghi hanno mandato una richiesta di conferma senza che tu glielo abbia chiesto due volte;
- almeno il **60 %** delle richieste aperte dal responsabile arriva a conferma;
- almeno **3 colleghi** hanno usato il loro link per rispondere a un annuncio vero.

Se i numeri non ci sono, si capisce il perché parlando con i colleghi, prima di aggiungere qualunque funzione.

---

## 13. Decisioni aperte (tue)

1. Lista definitiva di ruoli e competenze (§7).
2. Nome definitivo e dominio.
3. Regione Firestore: Milano o multi-regione europea.
4. Se tenere aperta la registrazione a tutti da subito o solo con un codice di invito durante la beta.
