# LIBRETTO — Specifica post-V1

Stato: da sviluppare DOPO il lancio della V1. Non toccare il codice della V1 per queste funzioni finché la sezione "Condizioni di avvio" non è soddisfatta.
Data: ottobre 2026. Fonte: feedback dei colleghi di lavoro + documento "Incontro tra datori e lavoratori (fase 2)".

> Ricevuta da Mike il 5 ottobre 2026 e salvata così com'è. Prende il posto di
> [`FASE2_BOZZA.md`](FASE2_BOZZA.md) come riferimento per il dopo-V1. In fondo, **Note sul
> confronto con la V1**: i punti in cui contraddice decisioni già prese o il codice di oggi.

## Istruzioni per Claude Code

- Lavora una funzione alla volta, nell'ordine della sezione "Priorità".
- Ogni voce marcata **[DECISIONE APERTA]** è un checkpoint: fermati e chiedi a Mike prima di implementare.
- Principio non negoziabile: il profilo appartiene al lavoratore. Nessuna funzione può far vedere dati del lavoratore a un datore senza il consenso del lavoratore.
- GDPR: nessun documento personale (busta paga, contratto, estratto INPS) viene conservato dopo la verifica.

## Condizioni di avvio

1. La V1 è stata lanciata con i primi 10–15 utenti (colleghi, ex colleghi, manager conosciuti).
2. Si è misurato il tasso di conferma: quanti datori confermano entro 7 giorni dalla richiesta.
3. Se meno del 50% conferma entro 7 giorni → la funzione 1 (prova documentale) diventa urgente e si fa subito.
4. Le funzioni 2–5 partono intorno a gennaio 2027, quando in zona Terracina ci sono abbastanza profili.

## Priorità

| # | Funzione | Quando |
| --- | --- | --- |
| 1 | Prova documentale della stagione | Subito dopo il lancio, se i dati lo giustificano |
| 2 | Stato aziende (cessata / cambio gestione) | Insieme alla 1 |
| 3 | Disponibilità del lavoratore + profilo datore verificato | Fase 2 (gen 2027) |
| 4 | Ricerca datore + contatto su richiesta + elenco ex collaboratori | Fase 2 |
| 5 | Annunci di lavoro con filtri | Fase 2 |
| — | Matching con IA | Escluso finché gli annunci in una zona non superano le centinaia |

---

## 1. Prova documentale della stagione

### Problema
Il datore può non confermare: cattivi rapporti, ripicca, dimenticanza, attività chiusa. Il lavoratore non deve restare penalizzato.

### Soluzione
Due livelli di verifica visibili sul profilo, separati e non fusi:

| Livello | Cosa prova | Come si ottiene |
| --- | --- | --- |
| Documentata | Hai lavorato lì in quel periodo | Documento caricato e verificato |
| Confermata dal datore | Il datore garantisce per te | Tap del manager dal suo numero (flusso V1) |

Una stagione può essere: solo dichiarata, documentata, confermata, o documentata + confermata.

### Documenti accettati
1. **Estratto conto contributivo INPS** (preferito): scaricabile dal lavoratore con SPID, riporta datore e periodi, ufficiale.
2. Contratto di lavoro (riserva).
3. Busta paga (riserva; contiene dati sensibili, più facile da falsificare).

### Flusso
1. Il lavoratore carica il documento per una stagione.
2. Si estraggono solo: nome datore / partita IVA, data inizio, data fine.
3. Il lavoratore può oscurare il resto prima del caricamento.
4. Dopo la verifica il file viene eliminato; restano solo i tre campi e la data di verifica.
5. Il datore riceve un avviso neutro: "[Nome] risulta aver lavorato da te nel periodo [date]. Vuoi confermare?".
6. Se il datore conferma → livello "confermata". Se tace → resta "documentata". Il datore non può bloccare né cancellare una stagione documentata.

### Regola di presentazione
Una stagione "documentata" senza conferma NON deve apparire come un segnale negativo. Nessuna etichetta tipo "non confermata dal datore".

### [DECISIONE APERTA]
- Verifica del documento: manuale (Mike controlla) all'inizio, o estrazione automatica dal PDF?
- Il datore può contestare una stagione documentata? Se sì, con quale flusso?
- Si accettano foto di buste paga o solo PDF?

---

## 2. Stato delle aziende

### Problema
Attività chiuse o con cambio di gestione: chi conferma, e cosa vale una conferma passata?

### Soluzione
- **Attività cessata:** etichetta "attività cessata" sulla stagione, verificata dallo stato della partita IVA. La stagione resta valida. Un'attività cessata non può confermare → si usa la prova documentale (funzione 1).
- **Cambio di gestione:** la conferma è legata alla persona e alla data, non al locale per sempre. Esempio visualizzato: "Confermata da Giulia R., responsabile sala, settembre 2026". Resta vera anche se il locale cambia proprietario.
- Il nuovo gestore NON eredita il potere di modificare conferme passate.

### [DECISIONE APERTA]
- Fonte per lo stato della partita IVA: servizio a pagamento (registro imprese via API) o controllo manuale all'inizio?
- Ogni quanto ricontrollare lo stato delle aziende?

---

## 3. Disponibilità del lavoratore e profilo datore verificato

### Disponibilità
Di default il profilo è visibile solo a chi ha il link. Per comparire nelle ricerche il lavoratore attiva lo stato "disponibile".

| Campo | Esempio | Note |
| --- | --- | --- |
| Ruolo | Sala, cassa, cucina | Uno o più |
| Zona | Terracina–Sabaudia | Comune + raggio in km |
| Periodo | Giugno–settembre 2027 | Inizio e fine |
| Tipo | Stagionale, part-time, extra | Weekend ed eventi inclusi |

Lo stato scade da solo a fine periodo.

**Nota per la V1:** verificare che il modello dati possa già ospitare questi campi, anche se la UI non li mostra.

### Profilo datore verificato
Necessario per cercare e pubblicare (in V1 il datore conferma senza account).
- Verifica minima: numero di telefono + partita IVA.
- Datori che hanno già confermato stagioni: attivazione quasi automatica.
- Filtro: ristoranti, bar, hotel, piccoli negozi locali sì; grandi catene no.
- Datore segnalato da più lavoratori → sospeso e controllato a mano.

### [DECISIONE APERTA]
- Quante segnalazioni fanno scattare la sospensione?

---

## 4. Ricerca datore, contatto ed elenco ex collaboratori

### Ricerca e contatto
1. Il datore filtra per zona, periodo, ruolo, competenze confermate.
2. Vede un'anteprima: stagioni confermate/documentate, posti precedenti, competenze.
3. Invia una richiesta con ruolo, periodo e paga.
4. Il lavoratore accetta o rifiuta. Solo se accetta il datore vede il numero.
5. Se assunto, a fine stagione il datore riceve il link per confermarla.

Limite di richieste al giorno per datore (anti-spam).

### Elenco ex collaboratori
Il datore vede l'elenco di chi ha lavorato da lui (stagioni confermate o documentate) con il loro stato "disponibile", per richiamare chi vuole.
- Il lavoratore può nascondere un ex datore: in quel caso non compare nel suo elenco.

### [DECISIONE APERTA]
- Limite giornaliero di richieste di contatto: quanto?
- L'elenco ex collaboratori mostra anche chi NON è disponibile?

---

## 5. Annunci di lavoro

Annunci corti, paga obbligatoria. Il matching si fa con filtri, non con IA.

| Campo | Obbligatorio | Esempio |
| --- | --- | --- |
| Ruolo / tipo di lavoro | Sì | Cameriere di sala |
| Periodo | Sì | 1 giugno – 15 settembre |
| Zona | Sì | Terracina |
| Orari | Sì | Sera, 6 giorni su 7 |
| Paga | Sì (anche come fascia) | 1.300–1.500 € netti/mese |
| Azienda | Sì (solo datori verificati e attivi) | — |
| Vitto e alloggio | No | Pasto incluso |
| Note | No | Esperienza con vino gradita |

- **Recapiti del datore NON pubblici.** La candidatura passa dall'app (anti-spam, anti-truffa).
- Il lavoratore si candida con un tap, inviando il suo Libretto.
- Notifica ai lavoratori disponibili compatibili per zona, periodo e ruolo.
- Filtri lato lavoratore: zona, periodo, ruolo, paga minima, orari → scarta subito le offerte incompatibili.
- L'annuncio scade da solo all'inizio del periodo.

### Matching con IA — escluso per ora
Con 20–50 annunci per zona i filtri bastano. Da rivalutare solo con centinaia di annunci in una zona.

### [DECISIONE APERTA]
- Pubblicare annunci è gratuito o a pagamento per il datore?
- La paga obbligatoria scoraggia troppi datori? Misurare dopo i primi annunci.

---

## Rischi da monitorare

| Rischio | Risposta |
| --- | --- |
| Densità: poche persone per zona | Aprire una zona alla volta, partendo da Terracina |
| Documenti falsi | Preferire estratto INPS; verifica manuale all'inizio |
| Dati sensibili nei documenti | Estrarre 3 campi, eliminare il file |
| Simmetria: i lavoratori vogliono sapere com'è il datore | Non subito; valutare dopo la prima stagione |
| Diventare un portale come gli altri | Annunci corti, paga obbligatoria, contatto solo su consenso |

---

## Note sul confronto con la V1 (5 ottobre 2026)

Scritte da Claude confrontando questa specifica con `SPEC.md`, `DECISIONI.md` e il codice.
Sono domande per Mike, non decisioni: finché lui non sceglie, vale quello che è già deciso.

**1. Il nome di chi conferma (punto 2, «Confermata da Giulia R.»).** Contraddice PC2 del 21
settembre: il nome del responsabile non compare mai in pubblico. Non è solo una regola
nostra: ogni responsabile ha confermato spuntando «La mia conferma, senza il mio nome, sarà
visibile», e la pagina gli dice «il tuo nome non compare da nessuna parte». Le conferme già
date non possono mostrare il nome in nessun caso. Per quelle nuove servirebbe una decisione
nuova e un consenso nuovo. Il problema del cambio di gestione si risolve anche senza nome:
«Confermata dal responsabile di sala, settembre 2026» lega già la conferma alla persona e
alla data.

**2. L'elenco ex collaboratori (punto 4).** Così com'è scritto, un datore vede chi ha lavorato
da lui e se è disponibile, salvo che il lavoratore lo nasconda. È un consenso al contrario
(vale finché non dici di no), e il principio in cima a questo documento chiede il contrario.
Coerente con la decisione del 2 ottobre sarebbe: si compare nell'elenco solo con «Fatti
trovare» acceso, e solo per i datori che il lavoratore non ha escluso. Con questa regola la
seconda domanda aperta del punto 4 («mostra anche chi non è disponibile?») ha già risposta: no.

**3. «Attiva lo stato disponibile» (punto 3).** Il 2 ottobre si è deciso di tenere due
interruttori separati: «Disponibile per la stagione» resta il badge di oggi, e per farsi
trovare serve «Fatti trovare dai datori», spento per tutti e con consenso nuovo. La specifica
li riunisce in uno: vale la decisione del 2 ottobre, a meno che Mike non la cambi.

**4. La prova documentale (punto 1) e la privacy.** L'estratto INPS contiene il codice fiscale
e tutta la storia lavorativa, non solo la stagione. Anche se il file si cancella dopo, per il
tempo in cui c'è è un trattamento in più: va scritto nell'informativa e conviene dirlo al
professionista di PC5 adesso. «Oscurare il resto prima del caricamento» da telefono è difficile
per quasi tutti. Più realistico: il file non si salva mai, lo si guarda e si tengono i tre
campi nella stessa operazione.

**5. L'avviso al datore (punto 1, passo 5).** Dall'estratto INPS si ricavano nome e partita IVA
del datore, non il suo telefono. Per mandargli «Vuoi confermare?» serve un numero, quindi si
torna al flusso della V1: il lavoratore lo manda dal suo WhatsApp.

**6. Le strutture non hanno la partita IVA (punto 2).** Nella V1 una struttura ha nome e comune,
e la crea il lavoratore. Lo stato «cessata» dalla partita IVA richiede di aggiungerla, e di
collegare le strutture già create a una partita IVA: lavoro da Mike, a mano, almeno all'inizio.

**7. Misurare la condizione 2 si può già.** «Quanti datori confermano entro 7 giorni» non si
ricava da `eventi`, che sono anonimi e scollegati fra loro. Si ricava da `richieste` (data
d'invio) e `conferme` (data della conferma, con lo stesso `richiestaId`), ma solo finché la
pulizia non cancella le richieste chiuse dopo 90 giorni. Va misurato entro quel tempo.
Attenzione: è un numero diverso da quello della §12 della V1 (60% delle richieste *aperte* dal
responsabile arriva a conferma).

**8. Il calendario.** La regola della V1 dice: nessuna funzione fuori specifica prima di
dicembre. Questa specifica può far partire la prova documentale «subito dopo il lancio». Le due
cose non si scontrano se «lancio» vuol dire la fine di novembre (§11). Se vuol dire la beta di
adesso, è una scelta di Mike, da scrivere in `DECISIONI.md`.
