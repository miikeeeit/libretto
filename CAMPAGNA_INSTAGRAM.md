# La campagna Instagram

Bozza del 13 ottobre 2026. Non è codice e non tocca l'app: è il piano per far conoscere
Libretto su Instagram, scritto dentro i vincoli che il progetto ha già. Le decisioni che
spettano a Mike sono in fondo, e finché non le prende il piano resta una bozza.

---

## Prima di tutto: non portare nessuno davanti a una porta chiusa

Oggi chi arriva su <https://libretto-3e962.web.app> da un post trova il campo **«Codice di
invito»** e non può entrare. È giusto così: la registrazione si apre a tutti solo dopo PC5,
l'informativa rivista da un professionista (§0 della specifica), e i codici valgono per un
numero solo, quindi non esiste un codice «instagram» da mettere in un post.

Ne viene la regola che regge tutto il calendario: **fino all'apertura, Instagram non chiede a
nessuno di entrare.** Può far conoscere il problema, il nome e la faccia; l'invito a entrare
parte il giorno in cui `BETA_SU_INVITO` diventa `false`. In questo documento quel giorno si
chiama **A**. La specifica lo mette a fine novembre.

Chi nel frattempo scrive in DM «come entro?» riceve «si apre a fine novembre, ti scrivo io».
Non un codice: dare inviti a sconosciuti trovati su Instagram è già aprire la registrazione,
e quello aspetta PC5.

## A chi parliamo

Le persone sono le stesse del brief di design, con un ordine diverso.

1. **Il lavoratore**, prima di tutti. 18–35 anni, sala, bar, cucina, spiaggia, provincia di
   Latina. Guarda Instagram di sera o in pausa. È l'unico che può registrarsi, quindi è
   l'unico a cui si chiede di fare qualcosa.
2. **Il responsabile.** Titolare, chef, capo sala. Non deve iscriversi a niente: un giorno gli
   arriva un link su WhatsApp da un ex dipendente. Se quel giorno ha già visto un post che
   spiega cos'è, conferma; se no, rischia di pensare a una truffa. La beta non ha ancora
   provato un responsabile esterno (`PASSAGGIO.md`), e il 60 % della §12 si gioca lì: per
   questo ha un filone tutto suo.
3. **Il datore che assume.** Per ora non gli si chiede niente: vede Libretto quando un
   lavoratore gli manda il link. La ricerca per i datori arriva a gennaio, e avrà una sua
   campagna.

## Cosa diciamo

Tutto il valore sta nella frase di sempre: **ogni conferma che si vede è vera.** Su Instagram
va detta con le parole di chi lavora.

**Il concetto: «Chiedi pure al titolare.»**

È la frase che ogni stagionale ha detto a un colloquio. Funziona finché il titolare risponde,
si ricorda di te e chi ti assume ha voglia di chiamarlo. Libretto è quella telefonata, già
fatta, in un link. La chiusura di ogni contenuto: *«Chiedi pure al titolare. Su Libretto ha già
risposto.»*

Sotto resta il claim dell'app: *«Le tue stagioni, confermate da chi ti ha visto lavorare.»*

**La frase di contrasto**, per quando serve spiegare la differenza con un CV:
*«Il CV lo scrivi tu. Il libretto lo conferma chi ti ha visto lavorare.»*

## Le regole che la campagna non può rompere

Vengono dalla specifica e da `BRIEF_DESIGN.md`. Su Instagram si sbagliano più facilmente che
nell'app, perché un post si scrive in fretta.

1. **Niente numeri inventati.** Nessun «già 100 stagionali» finché non è vero; quando lo è, il
   numero viene da Firestore, non da una stima.
2. **Niente testimonianze inventate.** Un profilo vero si mostra solo con il permesso scritto
   di chi lo possiede. Il nome di chi ha confermato **mai**, nemmeno con il suo permesso: le
   conferme sono state date con la promessa «senza il mio nome».
3. **Strutture vere solo con il loro permesso.** Bar Somma è nei dati di esempio del design,
   ma un post pubblico che lo nomina è un'altra cosa. Negli esempi si usano nomi inventati,
   controllando che in zona non esistano.
4. **Non promettere lavoro.** Libretto non trova lavoro e fino alla fase 2 nessun datore cerca
   nessuno. Si dice «manda il tuo link a chi ti assume», mai «fatti trovare».
5. **Pieno vuol dire confermato, azzurro vuol dire dichiarato**, anche nelle grafiche. Una
   stagione dichiarata non si disegna mai come una confermata, nemmeno per fare scena.
6. **Niente pixel di Meta, né altro tracciamento sul sito.** La §9 non ne vuole: servirebbero il
   banner dei cookie e un'informativa nuova. Si misura con quello che c'è già (più sotto).
7. **Il tono è quello dell'app**: da collega a collega, frasi corte, mai «utente», mai
   «candidato».

## Il calendario

Legato a due cose: il giorno A e la stagione. Le date precise dipendono da PC5.

| Quando | Cosa | Invito a entrare |
|---|---|---|
| Da ora ad A − 3 settimane | Le decisioni in fondo. Nome e profilo. Girare il materiale: i reel e le foto. | no |
| Da A − 3 settimane ad A | **Riscaldamento.** Tre post a settimana sul problema e su chi c'è dietro. Storie con domande. | no |
| Settimana di A | **Apertura.** Un post al giorno per cinque giorni, storie ogni giorno, e un DM a chi aveva chiesto. | sì |
| A + 6 settimane | **Dopo l'apertura.** Tre post a settimana. Le prime conferme vere, se chi le ha ricevute è d'accordo. | sì |
| Gennaio – aprile | **Le assunzioni per l'estate.** «Metti il link nel messaggio a chi ti assume»: è il terzo obiettivo della §12. | sì |
| Maggio – agosto | In stagione si lavora: un post a settimana, storie. | sì |
| Settembre | **Fine stagione.** «Prima di andare via, chiedi la conferma»: il titolare si ricorda di te adesso. | sì |

Settembre è il momento migliore di tutto l'anno: la stagione è appena finita e chi conferma
ha ancora la faccia in mente. Quest'anno arriviamo tardi, a stagione chiusa da mesi; dal 2027
settembre è il centro della campagna.

## Il profilo

- **Nome e handle**: dipendono dal nome definitivo (vedi le decisioni). Un handle con dei
  follower costa caro da cambiare.
- **Bio**: «Le tue stagioni, confermate da chi ti ha visto lavorare. Ristorazione e ospitalità,
  provincia di Latina.» Sotto, fino ad A: «Si apre a fine novembre». Da A: il link al sito.
- **Link**: l'indirizzo del sito, dritto. Niente pagine di raccolta link in mezzo, che sono un
  passaggio in più con la rete di agosto.
- **Tre post fissati in alto**: «Chiedi pure al titolare» (cos'è), «Per chi conferma» e «I dati
  sono tuoi». Chi apre il profilo da un link capisce tutto da quei tre.
- **Storie in evidenza**: Come funziona · Per chi conferma · Domande · I dati.
- **Le grafiche**: la direzione «Blu» del canvas (navy pieno, schede azzurrine, Poppins, angoli
  tondi). Vedi la decisione 5: oggi l'app è ancora verde.

## I quattro filoni

Ogni post appartiene a uno solo, così si vede quale funziona.

1. **Il problema, detto come lo diciamo noi.** La primavera in cui si riparte da zero, il
   colloquio in cui «quattro stagioni» non basta, il titolare che non risponde più.
2. **Come funziona.** Lo schermo del telefono, in venti secondi: scrivi la stagione, mandi il
   link su WhatsApp, il titolare conferma, il tuo profilo cambia.
3. **Per chi conferma.** Cosa succede quando ti arriva quel link: quattro righe, un codice SMS,
   un tap, il tuo nome non compare, solo cose buone. Serve a far arrivare in fondo il
   responsabile, che oggi è il punto meno provato.
4. **I dati sono tuoi.** Profilo privato con un tap, numero nascosto, tutto scaricabile e
   cancellabile. È quello che fa fidare chi non ti conosce.

## I primi nove post

L'ordine è quello di uscita, ed è anche la griglia che vede chi apre il profilo. I primi tre
escono nel riscaldamento e non chiedono di entrare; dal quarto si è al giorno A.

**1 · Carosello · «Chiedi pure al titolare.»** *(problema; fissato in alto)*

1. «Chiedi pure al titolare.» — sotto, piccolo: «L'abbiamo detto tutti, a un colloquio.»
2. «Poi il titolare non risponde. Ha cambiato numero. Non si ricorda come ti chiami.»
3. «Oppure chi ti assume non ha tempo di chiamarlo.»
4. «Quattro stagioni, e niente in mano.»
5. «Per questo c'è Libretto.»
6. «Si apre a fine novembre.» *(da A: «Ora si entra. Link in bio.»)*

Didascalia: «Quante stagioni hai fatto? E quante te ne crede chi non ti conosce?»

**2 · Reel · «Quattro stagioni, zero prove»** *(problema)* — copione A, più sotto.

**3 · Post singolo · Il CV contro il libretto** *(problema)*
Una grafica divisa a metà. A sinistra, azzurro: «Il CV lo scrivi tu.» A destra, navy pieno:
«Il libretto lo conferma chi ti ha visto lavorare.»
Didascalia: «Uno lo puoi scrivere stasera. L'altro te lo devi guadagnare in una stagione.»

**4 · Reel · Come si fa, in venti secondi** *(come funziona)* — copione B. **Giorno A.**

**5 · Carosello · Per chi conferma** *(per chi conferma; fissato in alto)*

1. «Ti è arrivato un link su WhatsApp da qualcuno che ha lavorato da te?»
2. «Ti chiede di confermare una stagione. Dove, che ruolo, quando. Quattro righe e basta.»
3. «Verifichi il tuo numero con un codice SMS. Nessun account, nessuna password.»
4. «Togli le cose che non gli hai visto fare. Il resto lo confermi con un tap.»
5. «Il tuo nome non compare da nessuna parte. Sul suo profilo si legge "confermata dal
   titolare".»
6. «E puoi dire solo cose buone. Un giudizio negativo, su Libretto, non esiste.»
7. «A te serve un minuto. A lui vale una stagione.»

Didascalia: «Se lavori con stagionali, prima o poi ti arriva. Ora sai cos'è.»

**6 · Reel · Perché l'ho fatto** *(problema)* — copione C, con Mike in camera.

**7 · Carosello · I dati sono tuoi** *(dati; fissato in alto)*

1. «Il tuo libretto lo vede solo chi ha il tuo link. Non finisce su Google.»
2. «Il tuo numero non si vede, se non lo accendi tu.»
3. «Una stagione la puoi nascondere. Il profilo lo rendi privato con un tap.»
4. «Puoi scaricare tutto, o cancellare tutto. Quando vuoi.»
5. «Chi ti conferma non si espone: in pubblico si legge il suo ruolo, mai il suo nome.»

**8 · Post singolo · «Il titolare si ricorda di te adesso.»** *(problema)*
«La stagione è finita. Il titolare si ricorda di te adesso. A marzo, quando ti serve, un po'
meno.»
Didascalia: «Chiedi la conferma finché la stagione è fresca.»

**9 · Carosello · Domande** *(come funziona)*

- «Se il titolare non risponde?» — Il link vale 30 giorni. Se non risponde, lo rimandi dal tuo
  libretto.
- «Deve essere per forza il titolare?» — No: chiunque ti abbia visto lavorare e ne
  risponda. Il capo sala, lo chef, il direttore.
- «E se il locale ha chiuso?» — Per ora serve qualcuno che c'era. Se hai ancora il numero del
  vecchio capo sala, vale lui.
- «Il titolare vede le mie altre stagioni?» — No. Vede solo la stagione che gli chiedi di
  confermare.
- «Funziona fuori dalla provincia di Latina?» — Per ora no. Si comincia da qui.
- «Quanto costa?» — *[da decidere: vedi la decisione 6]*

## Tre reel

Girati col telefono, in verticale, con le scritte a schermo: molti guardano senza audio.

**Copione A · «Quattro stagioni, zero prove»** (15–20 secondi)

| Secondi | Si vede | Scritta / voce |
|---|---|---|
| 0–3 | Un bancone, di spalle chi fa il colloquio | «Hai esperienza?» |
| 3–6 | Il lavoratore, sicuro | «Quattro stagioni.» |
| 6–9 | | «Dove?» — «Al Lido [nome inventato], poi...» |
| 9–12 | Chi fa il colloquio alza un sopracciglio | «E chi me lo dice?» |
| 12–16 | Il telefono del lavoratore: la sua pagina pubblica, stagioni confermate | — |
| 16–20 | Fine | «Chiedi pure al titolare. Su Libretto ha già risposto.» |

**Copione B · Come si fa, in venti secondi** (registrazione dello schermo)

| Secondi | Sullo schermo | Scritta |
|---|---|---|
| 0–4 | L4, si scrive una stagione | «1. Scrivi la stagione» |
| 4–9 | L5, «Manda su WhatsApp», si apre WhatsApp col messaggio | «2. Chiedi la conferma dal tuo WhatsApp» |
| 9–14 | Un secondo telefono: C1, il codice, «Confermo, ha lavorato qui» | «3. Il titolare conferma con un SMS» |
| 14–20 | P1, la stagione confermata | «4. Il tuo link mostra cosa è vero» |

**Si gira sugli emulatori, non sul sito vero.** Sul sito vero una conferma di prova è una
conferma finta in mezzo a quelle vere: finisce nei conteggi di `strutture`, `responsabili` e
`statistiche/conferme`, e rompe proprio la frase che il reel deve dimostrare. Sugli emulatori
nessun SMS parte e i dati si inventano; la barra dell'indirizzo si taglia in montaggio. Nomi
inventati, e nessun numero di telefono vero a schermo. In alternativa, una stagione vera di
Mike già confermata, se chi l'ha confermata è d'accordo.

**Copione C · Perché l'ho fatto** (30–40 secondi, Mike in camera)

Una traccia, non un testo da leggere: le parti fra parentesi le sai solo tu.

- «Sono Mike, faccio [ruolo] da [quante] stagioni, [dove].»
- «Ogni [primavera], [quello che ti succede quando cerchi la stagione dopo].»
- «Allora ho fatto Libretto. Scrivi le tue stagioni, e chi ti ha visto lavorare le conferma
  dal suo telefono.»
- «Non ti trova lavoro. Fa una cosa sola: quello che hai fatto, te lo fa confermare da chi
  c'era.»
- «È per noi della provincia di Latina. Il link è in bio.»

Funziona perché è vero: un collega che ha avuto il problema, non un'azienda. Per questo
niente parti inventate.

## A pagamento, se e quando

Non prima di A, e non prima che il profilo abbia i suoi primi nove post: chi clicca un
annuncio guarda il profilo prima di fidarsi.

- **Si spinge il reel che è andato meglio da solo**, non una grafica fatta apposta per
  l'annuncio.
- **La zona**: i comuni della provincia di Latina, con il peso sulla costa.
- **Prima di costruire il pubblico, controllare in Gestione inserzioni** se Meta classifica
  l'annuncio nella categoria speciale «Occupazione». Se sì, non si sceglie l'età e il raggio
  intorno a un comune ha un minimo: il pubblico va pensato più largo.
- **Senza pixel** (regola 6), Meta non sa chi si registra: l'annuncio si ottimizza sui tocchi
  al link o sulle visualizzazioni, e le registrazioni si contano a parte.
- **Ogni registrazione è un SMS, e ogni SMS si paga su Blaze.** Un annuncio che funziona fa
  scattare l'avviso di budget, che è basso apposta. Prima di accendere gli annunci, alzare
  l'avviso a una cifra pensata, non spegnerlo. La policy SMS sulla sola Italia resta com'è.
- **Una prova breve, con una data di fine**, e alla fine il conto: euro spesi diviso
  registrazioni di quei giorni. Il budget lo decide Mike (decisione 4).

## Come si misura

Follower e mi piace non sono l'obiettivo. L'obiettivo è quello della §12, e Instagram è solo
una delle strade per arrivarci.

| La domanda | Dove si legge |
|---|---|
| Arriviamo alle persone giuste? | Insights → Pubblico: città ed età. La maggior parte deve stare in provincia di Latina. |
| Ci capiscono? | Salvataggi e condivisioni dei caroselli, e le domande in DM. |
| Arrivano al sito? | Insights: i tocchi sul link in bio. |
| Entrano? | Firestore → `eventi`, tipo `registrazione`, settimana per settimana. |
| Usano Libretto per davvero? | `richiesta_inviata`, e `conferma_completata` diviso `conferma_aperta` (l'obiettivo è il 60 %). |

Senza pixel non si sa chi viene da Instagram e chi dal passaparola. Si confrontano le
settimane: quella di un post che è andato bene, e le registrazioni di quei giorni. Non è
preciso, e va bene così: i colleghi della beta e dei 20 di dicembre li conosci per nome.

Come si leggono i numeri, quando non tornano:

- **Tanti tocchi, poche registrazioni**: il problema è la porta (SMS, numero, informativa), non
  i post.
- **Tante registrazioni, poche richieste**: le persone entrano e non capiscono cosa fare dopo.
  Anche qui non è Instagram: è l'app, e si capisce parlando con chi si è fermato.
- **Tante richieste, poche conferme**: si spinge il filone «Per chi conferma», e si guarda la
  schermata del responsabile.

E la regola della specifica vale anche qui: se i numeri non arrivano, la risposta non è un post
in più, è capire perché.

## Le decisioni che servono a Mike

Come per i punti di controllo: finché non c'è la risposta, il piano resta bozza. Le risposte
vanno in [`DECISIONI.md`](DECISIONI.md) con la data.

1. **Nome e handle.** «Libretto» è provvisorio dal 21 settembre (PC1). Un account Instagram
   con dei follower è il posto in cui un nome si fissa, quindi si decide prima di aprirlo, e
   prima si controlla che l'handle sia libero.
2. **Quando aprire l'account.** Tre settimane prima di A, con il riscaldamento senza invito a
   entrare (la proposta di questo piano), oppure direttamente ad A.
3. **La tua faccia.** Il copione C funziona solo se ci sei tu. Senza, il filone «problema» si
   regge su grafiche e reel recitati, e perde la cosa più credibile che hai: sei un collega.
4. **Il budget degli annunci.** Zero, cioè solo contenuti, oppure una prova breve dopo A, con
   una cifra e una data di fine. Se sì, l'avviso di Blaze va rivisto prima.
5. **Il blu nell'app.** Le grafiche dei post nascono «Blu», l'app oggi è verde e il blu entra
   nel codice dopo la beta (24 e 30 settembre). Se ad A l'app è ancora verde, il reel B mostra
   un'app diversa dai post. O il blu arriva prima di A, o si gira il reel B dopo.
6. **«Quanto costa».** Oggi per il lavoratore Libretto non costa niente. Dirlo in un post è una
   promessa: si può fare?
