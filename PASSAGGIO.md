# Passaggio a un'altra sessione

Chi prende in mano Libretto dopo di me legga questo per primo, poi
[`SPEC.md`](SPEC.md) §0. Qui non c'è il *cosa* — quello è nella specifica — ma il **come si
lavora qui** e le cose che senza avvertimento si sbagliano.

---

## In tre righe

Libretto è il libretto di lavoro degli stagionali della ristorazione della provincia di
Latina: uno scrive le sue stagioni, chiede la conferma a chi l'ha visto lavorare, e quello
conferma **dal suo telefono con un codice SMS**. Poi manda un link a un datore, che vede
quali stagioni sono state confermate e quali sono solo dichiarate.

Tutto il valore del prodotto sta in una frase: **ogni conferma che si vede è vera.** Se
quella frase cade, non resta niente — è un CV con la grafica più bella.

## Dove sta il lavoro

| | |
|---|---|
| Repo | `miikeeeit/libretto`, ramo `claude/progetto-txqtrx` |
| Specifica, riferimento intoccabile | [`SPEC.md`](SPEC.md) |
| Decisioni prese, con le date | [`DECISIONI.md`](DECISIONI.md) |
| Idee rimandate, e perché | [`DOPO.md`](DOPO.md) |
| Come si lavora, come si prova, come si manda online | [`README.md`](README.md) |
| La beta chiusa, passo per passo | [`BETA.md`](BETA.md) |
| Identità visiva (canvas, non ancora nel codice) | <https://claude.ai/artifact/99eUzj74DXGWbq6CXZ3m6p> |
| Il brief per continuare il canvas, coi testi veri | [`BRIEF_DESIGN.md`](BRIEF_DESIGN.md) |

## A che punto è

Le sei settimane del piano (§11) sono fatte e provate: accesso col telefono, profilo,
stagioni, conferma del responsabile, pagina pubblica, privacy, CV, cancellazione
dell'account, anti-frode della §8, pulizia notturna. **Non è ancora mai stato messo
online**: gira solo sugli emulatori.

Restano tre cose, e nessuna è codice:

1. **L'avviso di budget su Blaze** e il limite SMS alla sola Italia. Da quando l'accesso col
   telefono è attivo, ogni SMS costa, e senza il limite di regione una notte storta si
   misura in centinaia di euro.
2. **PC5**: informativa e base giuridica riviste da un professionista. La specifica dice di
   non aprire la registrazione a tutti finché non è fatto. Servono anche due decisioni di
   Mike: chi è il titolare del trattamento, e quale email per le richieste privacy (in
   `src/config.ts` oggi c'è un segnaposto).
3. **I numeri dei due responsabili noti** in `responsabiliNoti` (PC4): Bar Somma e il datore
   di lavoro di Mike. I numeri li inserisce lui, non si chiedono in chat.

## Come si lavora qui: le regole di Mike

Sono nella §0 della specifica e vanno rispettate, non reinterpretate.

- **I punti di controllo PC1–PC5 sono decisioni sue.** Quando il lavoro arriva a uno,
  fermarsi e chiedere, prima di scrivere il codice che ne dipende. Niente valori
  predefiniti scelti al suo posto. La risposta si scrive in `DECISIONI.md` con la data.
- **Nessuna funzione fuori dalla specifica prima di dicembre.** Le idee nuove vanno in
  `DOPO.md` con una riga di motivazione, e si torna al piano.
- Il tono dei testi: **da collega a collega**, frasi corte, mai «utente», mai «candidato».
  Tutta l'interfaccia e tutti i commenti nel codice sono in italiano. Non tradurre.

## Le cose che si sbagliano senza avvertimento

Queste le ho imparate sbagliandole o trovandole con le prove. Sono il vero contenuto di
questo documento.

**Il repository non ha un ramo di confronto.** È nato vuoto e quel ramo è l'unico che
esiste, quindi `git diff origin/HEAD...` è vuoto. Una revisione basata sul diff
(`/code-review`, `/security-review`) **gira a vuoto e dice che va tutto bene**. Puntarle sui
file: `/code-review high firestore.rules functions/src/ src/lib/`. Una revisione che passa
senza aver guardato niente è peggio di nessuna revisione — questa è costata dieci difetti
scoperti tardi, due gravi.

**Le funzioni vanno compilate prima degli emulatori.** `npm run emulatori` lo fa da sé;
lanciare `firebase emulators:start` a mano serve una build vecchia, e le funzioni nuove
semplicemente non esistono. Se una funzione appena scritta «non c'è», è questo.

**Senza l'emulatore pubsub la pianificata non si carica.** `pulizia` viene ignorata con un
avviso facile da non vedere. È già in `firebase.json`, basta non togliere `pubsub` dalla
lista degli emulatori avviati.

**`VITE_USA_EMULATORI=1` in una build di produzione è l'errore peggiore possibile**: il
sito si apre, sembra funzionare e non salva niente da nessuna parte. La build si rifiuta di
partire, `npm run prontezza` lo intercetta, e `npm run deploy` passa da lì. Non aggirare
questi tre controlli.

**La conferma è difesa da tre controlli sovrapposti, e servono tutti tre.** In
`confermaStagione`: il token è quello della stagione, lo stato è ancora `in_attesa`, e i
dati coincidono con `richieste.stagioneAlMomento` — la foto di struttura, ruolo e periodo
scattata quando il link è partito. Non sono ridondanti: ognuno copre un buco che gli altri
due lasciano aperto, e li ho chiusi uno alla volta dopo che una prova mi aveva smentito una
correzione che credevo bastasse. **Se sembrano superflui, non toccarli**: leggere i commenti
sopra, che spiegano quale attacco copre ognuno.

**`verificatoAdmin` non si scrive mai a `false` in un merge.** Lo mette a mano Mike per i
responsabili che conosce (PC4): un `set(..., {verificatoAdmin: false}, {merge: true})` in
`confermaStagione` gliel'avrebbe cancellato a ogni conferma successiva.

**Una stagione confermata si può solo nascondere.** Le regole non lasciano cambiarle
nient'altro, nemmeno riportandola in bozza: senza quel vincolo si tenevano addosso le
competenze confermate e il ruolo del responsabile e si cambiava struttura e periodo.

**La cartella delle skill sincronizzate non è salvabile.** Da una sessione in cloud, una
modifica a `~/.claude/skills/synced/...` non arriva all'account di Mike e il prossimo sync
la cancella. Se serve cambiare una skill, dargli il testo da incollare e dirgli che si
gestiscono dalle impostazioni di claude.ai.

**In una sessione in cloud le skill `rezvani-*` e `design:*` non ci sono.** Sono sulla sua
macchina. Usare le equivalenti disponibili e dirlo, invece di annunciare skill non caricate.

## Le prove, e cosa guarda ognuna

```sh
npm run lint            # i tipi, anche quelli delle funzioni
npm test                # 62 prove sulle regole di sicurezza
npm run prova:rottura   # 46 casi, chiamando le funzioni a mano
npm run prova:flusso    # 24 passaggi in browser, tre finestre
```

Guardano tre cose **diverse**, e conviene sapere quale:

- **`npm test`** non dimostra che l'app funziona: dimostra che **non** può fare quello che
  non deve. Dal client non si scrive «confermata», il telefono sul profilo è solo quello
  verificato via SMS, il telefono di un responsabile non si legge, un invito non si ruba.
- **`npm run prova:rottura`** attacca le Cloud Functions **senza passare
  dall'interfaccia**, come chi si è scritto il client a mano. Se un controllo esistesse solo
  nel frontend, questa prova lo scopre. Vuole emulatori avviati e funzioni compilate.
- **`npm run prova:flusso`** fa il giro vero in browser con tre contesti separati:
  lavoratore, responsabile e un datore non collegato. Vuole anche `npm run dev`.

Se una diventa rossa, è saltato il principio della §1, non un dettaglio. E quando si
corregge un difetto, **prima si scrive la prova che lo riproduce**: le due sul buco più
grosso sono nate rosse e hanno smentito la mia prima correzione.

## Il design

L'identità visiva è progettata su un canvas Claude Design, **non ancora nel codice**:
<https://claude.ai/artifact/99eUzj74DXGWbq6CXZ3m6p>

La direzione è «timbro e penna»: un documento di lavoro italiano è credibile perché è
timbrato, e la differenza fra confermato e dichiarato è quella fra un timbro e una riga a
penna. Non si porta nel codice prima della beta: prima si guarda dove la gente si blocca.
La gerarchia della pagina pubblica è già sistemata (la prima cosa che si legge nomina chi ha
confermato); il resto — palette, caratteri, via le schede — è in `DOPO.md`.

## Se questa sessione è chiusa

Il container è effimero: tutto quello che conta è spinto sul ramo. Non c'è niente da
recuperare qui dentro. Gli screenshot delle prove e gli appunti di lavoro erano temporanei e
si rigenerano lanciando `npm run prova:flusso` con `LIBRETTO_SCHERMATE` puntato a una
cartella.
