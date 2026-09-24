# Brief per il design

**Per Mike, prima di tutto.** Il canvas su Claude Design esiste già e l'hai tu:
<https://claude.ai/artifact/99eUzj74DXGWbq6CXZ3m6p>. Ci sono la pagina pubblica (P1), il
libretto (L3), la conferma (C3) e la tavola degli elementi. Non ripartire da zero: apri quello
e incolla nella chat di Claude Design tutto quello che sta sotto la riga. Mancano le altre
schermate, e qui ci sono tutte, coi testi veri presi dal codice.

Il design non si porta nel codice prima della beta (vedi `DOPO.md`). Questo brief serve a
disegnarlo, non a cambiare l'app.

---

## Da qui in giù si incolla

Continua questo canvas: la direzione «timbro e penna» è decisa, e le tavole P1, L3, C3 e
«Gli elementi» sono il riferimento. Aggiungi le schermate che mancano (l'elenco è più giù),
una tavola per schermata, 390 px di larghezza, con **gli stessi colori, lo stesso carattere e
le stesse regole**. Usa i testi scritti qui parola per parola: sono quelli dell'app vera.

### Cos'è Libretto

Il libretto di lavoro degli stagionali della ristorazione e dell'ospitalità della provincia di
Latina. Chi lavora scrive le sue stagioni e chiede la conferma a chi l'ha visto lavorare. Chi
conferma lo fa **dal suo telefono, con un codice SMS**. Poi il lavoratore manda un link a un
datore, che vede quali stagioni sono confermate e quali solo dichiarate.

Tutto il valore sta in una frase: **ogni conferma che si vede è vera.** Il design deve rendere
impossibile confondere una stagione confermata con una dichiarata.

### Chi guarda queste schermate

Tre persone diverse, tutte da telefono.

- **Il lavoratore.** 18–35 anni, cameriere, barista, lavapiatti, bagnino. Apre l'app di sera o
  in pausa, con una mano. Non ha pazienza per i moduli.
- **Il responsabile.** Titolare di un bar, chef, capo sala. Non conosce Libretto, non ha un
  account e sta facendo un favore. Riceve un link su WhatsApp da un ex dipendente. Ha un minuto,
  forse meno. Ogni campo in più è una conferma persa.
- **Il datore.** Apre il link del lavoratore da un annuncio, di fretta, spesso in spiaggia o in
  cucina, con la rete che va e viene. Legge la prima riga e decide.

### La direzione: timbro e penna

In Italia un documento di lavoro è credibile per una ragione sola: è timbrato. La differenza
fra una stagione confermata e una dichiarata è quella fra un timbro e una riga scritta a penna.
Un libretto non è artigianale, è **burocratico**: fotocopia, penna a sfera, timbro leggermente
storto.

**Colori**

| Nome | Valore | A cosa serve |
|---|---|---|
| Inchiostro | `#1b2434` | Blu-nero di penna a sfera. Tutto il testo che conta. |
| Timbro | `#5a2d82` | Viola d'ufficio. **Solo** per ciò che ha confermato un'altra persona. |
| Penna | `#2f4d8a` | Ciò che il lavoratore scrive di sé: dichiarato, non provato. |
| Modulo | `#e9edf0` | Il grigio freddo di una fotocopia. Il fondo di ogni schermata. |
| Foglio | `#ffffff` | Il registro. Righe separate da filetti, non schede. |
| Matita | `#5c6875` | Quello che aiuta e non dichiara. Sempre sopra 4.5:1 di contrasto. |
| Filetto | `#ccd4dc` | Le linee che separano le righe. |

Per gli errori serve un rosso: non c'è ancora nella tavola. Sceglilo scuro, che regga 4.5:1
sul bianco, e usalo solo per gli errori veri, mai per decorare.

**Carattere.** Una famiglia sola, **Archivo** (Google Fonts, con larghezza variabile). Titoli
600, corpo 16 su 1.45, spiegazioni 13.5 in matita. **Archivo stretta 80%, in maiuscolo, solo
dentro un timbro**: il maiuscolo qui è solo dei timbri, da nessun'altra parte.

**Il timbro.** Bordo doppio color timbro, testo stretto in maiuscolo («CONFERMATA / DAL
TITOLARE»), ruotato di due gradi, inchiostro non pieno (opacità 0.88). Un timbro perfettamente
dritto sembra un badge. Si usa **solo** per ciò che ha messo un'altra persona.

**Comandi.** Angoli a 2 px come un campo di un modulo, nessuna ombra, nessuna scheda. Tutto
quello che si tocca è alto almeno 44 px. Il bottone principale è pieno (inchiostro, oppure
timbro quando l'azione è confermare); il secondario è bordato; le azioni minori sono testo
sottolineato.

**Cosa evitare.** Carta crema con grazie alte e terracotta. Schede tutte uguali con la stessa
ombra. Etichette in maiuscolo. Meta-stringhe unite dai puntini. Emoji. Sfumature. Barre di
stato finte.

**Ancora aperto, da decidere con la beta:** se il viola del timbro regge su un telefono al sole
(in spiaggia a mezzogiorno), e se «Disponibile per la stagione» scritto a penna si legge come
una dichiarazione o come un errore. L'app di oggi ha anche un **tema scuro**: va deciso come si
traduce il timbro su fondo scuro, o se il tema scuro si toglie.

### Regole che il design non può rompere

Vengono dalla specifica e dalla sicurezza del prodotto, non dal gusto.

1. **Confermato e dichiarato non si mescolano mai**, né nello stesso elenco né nello stesso
   stile. Una competenza dichiarata non può somigliare a una confermata.
2. **Il nome di chi conferma non compare mai** in pubblico. Si legge solo il ruolo: «confermata
   dal titolare».
3. **Esistono solo giudizi positivi.** Non disegnare stelle, voti, pollici, campi negativi.
   «Lo riprenderei» è facoltativo: se manca, non si vede niente e non vuol dire niente.
4. **Il numero del lavoratore non si vede** se non l'ha acceso lui.
5. **Niente numeri inventati** e niente statistiche decorative. Se un dato non c'è, non c'è.
6. **Il tono è da collega a collega.** Frasi corte, italiano parlato. Mai «utente», mai
   «candidato».

### Dati di esempio da usare

Sempre questi, così le tavole si parlano:

- Lavoratore: **Mario Rossi**, Bar, Terracina
- Stagione confermata: **Bar Somma**, Terracina · Bar · maggio – settembre 2026 · confermata dal
  titolare · lo riprenderebbe
- Stagione in attesa: **Hotel Miramare**, Sabaudia · Sala · giugno – settembre 2025
- Competenze del Bar: Caffetteria · Cocktail base · Tiene il banco nell'affollamento ·
  Inventario e ordini · Cassa e chiusura di cassa · Inglese con i clienti · Apertura e chiusura
  in autonomia
- Link pubblico: `/p/mario-rossi`

I ruoli che esistono: Sala, Bar, Cucina, Pizzeria, Lavaggio, Reception, Housekeeping, Spiaggia
e stabilimenti, Animazione, Cassa, Commesso/a, Responsabile.

I ruoli di chi conferma: titolare, direttore, responsabile di sala, chef, altro.

Gli stati di una stagione: **Bozza**, **In attesa**, **Confermata**, **Non confermata**,
**Scaduta**. Solo «Confermata» prende il timbro.

---

### Le schermate da aggiungere

Già sul canvas: **P1** (pagina pubblica), **L3** (il mio libretto), **C3** (il modulo di
conferma). Rivedile solo se cambiano per coerenza con le nuove.

#### Il lavoratore

**L1 · Accesso, primo passo**

- In alto: il nome «Libretto» e la frase «Le tue stagioni, confermate da chi ti ha visto
  lavorare.»
- Titolo: «Entra col tuo numero»
- Aiuto: «Ti arriva un codice via SMS. Nessuna password da ricordare.»
- Campo «Codice di invito», esempio «somma-2026», aiuto «Libretto è in prova chiusa: per ora si
  entra su invito.»
- Campo «Il tuo numero di cellulare», esempio «347 123 4567»
- Casella «Ho almeno 18 anni.»
- Casella «Ho letto l'informativa e accetto che Libretto tratti i miei dati.» («informativa» è
  un link)
- Bottone «Mandami il codice»
- Sotto: «Prima volta qui? Come funziona Libretto»
- Un errore d'esempio: «Per usare Libretto devi avere almeno 18 anni.»

**L1 · Accesso, il codice**

- Titolo: «Scrivi il codice»
- «L'ho mandato al 347 123 4567.» e accanto «Cambia numero»
- Campo «Codice di sei cifre», grande, cifre spaziate
- Bottone «Entra»
- Testo-bottone «Rimanda il codice (24)», col conto alla rovescia, spento finché non arriva a
  zero

**L2 · Crea il tuo libretto**

- Titolo: «Crea il tuo libretto»
- Aiuto: «Quattro cose e hai finito. Le stagioni le aggiungi dopo.»
- «Nome» e «Cognome», affiancati
- «Foto»: un riquadro vuoto e il bottone «Scegli una foto». Aiuto: «Non è obbligatoria, ma un
  volto conta: chi ti cerca ti riconosce.»
- «Il ruolo che fai più spesso»: un menu
- «Il tuo comune», esempio «Terracina», con i suggerimenti sotto mentre scrivi; scelto il
  comune compare «Terracina, provincia di Latina»
- Bottone «Crea il mio libretto»

**L3 · Il mio libretto, vuoto** (la versione piena è già sul canvas)

- Nome, ruolo e comune in cima; al posto dei numeri: «Ancora nessuna stagione»
- L'interruttore «Disponibile per la stagione 2027», con l'aiuto «Chi apre il tuo link vede
  questo avviso. Puoi spegnerlo quando vuoi.»
- «Le tue stagioni» e il bottone «Aggiungi stagione»
- Al posto dell'elenco: «Comincia dall'ultima: la struttura, il ruolo, i mesi e cosa facevi.
  Poi chiederai la conferma a chi ti ha visto lavorare.»

Aggiungi anche, sulla tavola L3 piena o su una a parte, **una stagione «Non confermata»**, con
la riga che vede solo il lavoratore: «Il responsabile dice che i dati non corrispondono. Questa
riga la vedi solo tu: correggila e richiedi la conferma, oppure cancellala.» E l'avviso rosso
quando il link è spento: «Il tuo link è spento: chi lo apre non vede niente. Lo riaccendi dalle
impostazioni.»

**L4 · Aggiungi una stagione**

Quattro cose in fila.

1. «Dove hai lavorato», esempio «Agriturismo, bar, hotel…». Sotto, mentre scrivi, le strutture
   già note: nome in grassetto e comune in matita. Se non c'è: «Non c'è ancora nessuna
   struttura con questo nome.» e il bottone «Aggiungi «Bar Somma»».
2. «Che ruolo facevi»: un menu, già scelto sul ruolo principale.
3. «Da quando» e «A quando»: mese e anno affiancati, due menu per riga.
4. «Cosa facevi, di quello che sai fare», con l'aiuto «Spunta solo quello che ti hanno visto
   fare: è chi ti ha visto lavorare che dovrà confermarlo.» Le caselle sono le competenze del
   ruolo scelto.

- Bottone «Salva la stagione», poi «Torna al libretto»
- In modifica il titolo diventa «Correggi la stagione», il bottone «Salva le correzioni», e in
  fondo c'è «Cancella questa stagione» in rosso

**L4 · La struttura nuova** (variante)

- «Struttura nuova: la stai aggiungendo tu. Scrivi il nome come lo scriverebbe il titolare, così
  chi ha lavorato lì la ritrova.»
- Campo «In che comune è», coi suggerimenti

**L5 · Chiedi la conferma, primo passo**

- Titolo: «Chiedi la conferma»
- La stagione in una riga: «Bar Somma, Terracina · Bar · maggio – settembre 2026»
- «Chi ti ha visto lavorare», esempio «Nome e cognome, o come lo chiami», aiuto «Serve solo per
  scrivere il messaggio. Non finisce da nessuna parte in pubblico.»
- «Il suo numero di cellulare», aiuto: «Controllalo bene: il link funziona **solo** da questo
  numero. È quello che rende la tua conferma vera, ma vuol dire che con una cifra sbagliata non
  funziona.» Questo avviso deve farsi leggere: è l'errore più probabile di tutta l'app.
- Bottone «Prepara il messaggio»

**L5 · Chiedi la conferma, il messaggio pronto**

- «Ecco il messaggio. Mandalo **dal tuo WhatsApp**: così Giuseppe riceve un messaggio da te, non
  da un servizio che non conosce.»
- L'anteprima del messaggio, come una citazione: «Ciao Giuseppe, sono Mario Rossi. Sto
  raccogliendo le conferme delle mie stagioni su Libretto. Mi confermi che ho lavorato da Bar
  Somma come Bar (maggio – settembre 2026)? Ti basta un minuto: https://…/c/… Grazie!»
- Bottone principale «Manda su WhatsApp», secondario «Copia il link»
- «Il link vale 30 giorni. Se non risponde, puoi rimandarlo dal tuo libretto.»
- In fondo: «Ho mandato il messaggio»

**L6 · Impostazioni e privacy**

Ogni interruttore dice una cosa sola: cosa vede chi apre il tuo link.

- «Chi vede il tuo libretto»
  - «Il mio link funziona»: «Chi ha il link vede il tuo profilo. Non finisce nei motori di
    ricerca. Se lo spegni, il link smette di funzionare per tutti, subito.»
  - «Mostra il mio numero»: «Chi apre il tuo link può scriverti su WhatsApp. Se è spento, il tuo
    numero non si vede da nessuna parte.»
  - «Mostra anche le stagioni in attesa»: «Compaiono in un elenco a parte, dichiarate e non
    confermate. Conviene se stai aspettando risposte e ti serve far vedere l'esperienza
    adesso.»
  - «Il tuo indirizzo pubblico è /p/mario-rossi. Guardalo come lo vede un datore.»
- «Il tuo CV»: «Facoltativo, un PDF fino a 5 MB. Il file non è pubblico: chi apre il tuo profilo
  ne riceve un indirizzo che scade dopo pochi minuti.» Bottone «Carica un PDF».
- «Nascondi una stagione»: «Una stagione nascosta resta nel tuo libretto ma non compare sulla
  pagina pubblica.» Un interruttore per stagione, con «visibile» o «nascosta».
- «I tuoi dati»: bottone «Scarica i miei dati»
- «Elimina il mio account»: «Spariscono profilo, stagioni, richieste, conferme ricevute, foto e
  CV. Non si torna indietro.» e il testo-bottone rosso «Voglio eliminare il mio account».

**L6 · Elimina, la conferma** (variante)

- «Per essere sicuri: scrivi **ELIMINA** qui sotto. Spariscono profilo, stagioni, richieste,
  conferme ricevute, foto e CV, e il tuo link smette di funzionare.»
- Campo «Scrivi ELIMINA», bottone rosso «Elimina tutto» (spento finché non c'è la parola), e
  «Lascia stare»

#### Il responsabile

Chi arriva qui non conosce Libretto. Quattro righe, un codice, un tap.

**C1 · Le quattro righe e il numero**

- «**Mario Rossi** dice di aver lavorato da te.»
- Struttura: Bar Somma, Terracina · Ruolo: Bar · Periodo: maggio – settembre 2026 (come in C3)
- Titolo: «Per confermare, verifica il tuo numero»
- «Mario ha indicato il numero **347 •••• 67**. Scrivilo per intero: ti arriva un codice via
  SMS. Non serve nessun account.»
- Campo «Il tuo numero di cellulare», esempio «Il tuo numero, per intero»
- Bottone «Mandami il codice»
- In fondo, piccolo: «Libretto raccoglie solo conferme positive: non esiste un modo per dare un
  giudizio negativo. Del tuo numero non si vede niente in pubblico. Come funziona»

**C2 · Il codice**

- Le stesse quattro righe in alto
- «Scrivi il codice», campo «Codice di sei cifre», bottone «Continua»

**C2 · Il numero non è quello giusto**

Non è un errore di chi legge: è la regola che protegge il prodotto. Deve suonare come una
spiegazione, non come un rifiuto.

- Titolo: «Questo link è stato inviato a un altro numero»
- «Il link funziona solo dal numero che Mario ha indicato: **347 •••• 67**. È una regola che
  serve a te: vuol dire che nessuno può farsi confermare una stagione girando questo link a un
  amico.»
- «Se hai lavorato con Mario, chiedigli di rimandartelo su questo numero: gli basta un tap dal
  suo libretto.»
- Bottone secondario «Prova con un altro numero»

**C3 · Non corrisponde al vero** (variante del modulo già sul canvas)

- Titolo: «Cosa non torna?»
- Due bottoni secondari: «Non ha mai lavorato qui» e «I dati sono sbagliati»
- «Torna indietro»

**C4 · Fatto, grazie**

- Titolo: «Fatto, grazie»
- «Mario Rossi ora ha questa stagione confermata, con 3 competenze. Il tuo nome non compare da
  nessuna parte: sul suo profilo si legge «confermata dal titolare».»
- Un filetto, poi: «**Anche i tuoi collaboratori possono avere il loro libretto.** Se ti è
  sembrato utile, passa il link a chi lavora con te.» e il bottone secondario «Manda il link»
- In fondo: «Hai confermato per errore? Revoca»

**C4 · Segnalato** (variante)

- «Grazie, l'abbiamo segnato»
- «Questa stagione non risulta più confermata e Mario è stato avvisato. Non comparirà niente sul
  suo profilo.»

**C · Link non valido**

Un messaggio solo, grande, e nient'altro. Di chi fosse la richiesta non si dice niente. I
quattro testi possibili:

- «Questo link non è valido.»
- «Questa conferma è già stata data. Grazie.» (e, se chi guarda è proprio chi ha confermato:
  «Hai confermato per errore?» con il bottone «Revoca la mia conferma»)
- «Questo link è scaduto. Chiedi a chi te l'ha mandato di rimandartelo.»
- «Questo link non è più valido.»

Sotto: «Cos'è Libretto».

#### Il datore

**P1 · Nessuna stagione confermata** (variante della pagina pubblica già sul canvas)

- La frase in cima diventa: «Nessuno ha ancora confermato le stagioni di Mario.»
- Sotto «Stagioni confermate»: «Nessuna stagione confermata, per ora. Su Libretto una stagione
  compare qui solo quando la conferma chi ci ha lavorato insieme, dal suo telefono.»
- Deve sembrare onesta, non vuota e non punitiva: per un lavoratore appena arrivato è lo stato
  normale.

**P1 · Più strutture** (variante)

- «Tre strutture hanno confermato le stagioni di Mario: Bar Somma, Hotel Miramare e Lido Azzurro.»
- Seconda riga: «Due di loro lo riprenderebbero.»
- Nelle competenze confermate, accanto a una: «· confermata da 2»

**P1 · Pagina non disponibile**

- «Questa pagina non è disponibile»
- «Il link può essere sbagliato, o chi l'ha creato può aver reso privato il suo libretto.»
- «Cos'è Libretto»

Uguale per profilo inesistente, privato o sospeso: chi apre il link non deve capire quale dei
tre.

#### Per tutti

**Come funziona Libretto**

Una pagina di testo, leggibile, senza illustrazioni decorative.

1. **Scrivi le tue stagioni.** Struttura, ruolo, periodo e cosa sai fare. Ci metti due minuti
   per ognuna.
2. **Chiedi la conferma a chi ti ha visto lavorare.** Mandi il link dal tuo WhatsApp al
   titolare o al capo sala. Chi lo riceve verifica il proprio numero con un SMS e conferma con
   un tap.
3. **Mostri un profilo che non si può inventare.** Chi apre il tuo link vede quali stagioni sono
   confermate e da quante strutture, separate da quelle che hai solo dichiarato.

Poi tre paragrafi: «Perché una conferma qui vale», «Chi conferma non si espone», «I dati sono
tuoi». In fondo: «Entra in Libretto · Informativa privacy».

**Gli stati di sistema** (una tavola sola)

- Il caricamento: «Un momento…», centrato, niente spinner decorativi
- Un bottone mentre lavora: «Un momento…», «Controllo…», «Salvo…», «Preparo…»
- Un errore sotto un campo: «Il numero non mi sembra giusto. Controllalo.»
- Un avviso di riuscita: «CV caricato.»
- I cinque stati di una stagione uno sotto l'altro, per vedere che solo «Confermata» è un timbro

---

### Cosa non disegnare

Sono fuori dalla prima versione per scelta, non per dimenticanza: la ricerca per i datori (si
accende a gennaio), notifiche, account per i datori, chat, candidature, recensioni scritte,
stelle. Se viene un'idea, va annotata a parte, non disegnata.
