# Fase 2 · Incontro tra datori e lavoratori — BOZZA

> **Superata il 5 ottobre 2026** da [`SPEC_POST_V1.md`](SPEC_POST_V1.md), che la riprende e la
> allarga. Resta qui per le note del 1° ottobre.

> **Non è una specifica.** È un'idea scritta da un altro agente il 1° ottobre 2026, dopo una
> domanda di un lavoratore sul rapporto fra lavoratore e datore. Mike l'ha portata qui per non
> perderla. La specifica vera della ricerca si scrive a gennaio (`SPEC.md` §11). Fino ad allora
> niente di questo si costruisce (`SPEC.md` §0). In fondo ci sono le note scritte confrontandola
> con il codice di oggi.

---

## Contesto e principio guida

La ricerca di personale e gli annunci sono la fase 2 di Libretto, prevista intorno a gennaio
2027, e non entrano nella V1. Il principio resta lo stesso della V1: il profilo appartiene al
lavoratore, che decide se, quando e da chi farsi trovare.

Il valore per il datore è vedere stagioni confermate da altri datori, non dichiarazioni. Il
valore per il lavoratore è ricevere proposte chiare da attività vicine, non da aziende con
requisiti pesanti come su Indeed o LinkedIn.

## Disponibilità del lavoratore

Di default il profilo è visibile solo a chi ha il link. Per comparire nelle ricerche il
lavoratore attiva uno stato "disponibile" e lo spegne quando ha trovato.

| Campo | Esempio | Note |
|---|---|---|
| Ruolo | Sala, cassa, cucina | Uno o più |
| Zona | Terracina–Sabaudia | Comune + raggio in km |
| Periodo | Giugno–settembre 2027 | Date di inizio e fine |
| Tipo | Stagionale, part-time, extra | Weekend ed eventi inclusi |

Lo stato scade da solo a fine periodo, così le ricerche non mostrano persone che non cercano più.

## Ricerca lato datore e contatto

Il datore cerca tra i lavoratori disponibili e li contatta solo con il loro consenso. Il numero
di telefono non è mai visibile prima.

1. Il datore filtra per zona, periodo, ruolo e competenze confermate.
2. Vede un'anteprima: stagioni confermate, posti precedenti, competenze confermate.
3. Manda una richiesta di contatto con ruolo, periodo e paga.
4. Il lavoratore accetta o rifiuta; solo se accetta il datore vede il numero.
5. Se il lavoratore viene assunto, a fine stagione il datore riceve il link per confermarla.

Il passo 5 chiude il cerchio: ogni assunzione fatta tramite Libretto produce una nuova stagione
confermata.

## Annunci di lavoro

Gli annunci sono corti e con la paga obbligatoria, almeno come fascia: è ciò che i lavoratori non
trovano sui grandi portali.

| Campo | Obbligatorio | Esempio |
|---|---|---|
| Ruolo | Sì | Cameriere di sala |
| Periodo | Sì | 1 giugno – 15 settembre |
| Zona | Sì | Terracina |
| Orari | Sì | Sera, 6 giorni su 7 |
| Paga | Sì | 1.300–1.500 € netti/mese |
| Vitto e alloggio | No | Pasto incluso |
| Note | No | Esperienza con vino gradita |

Il lavoratore si candida con un tap, inviando il suo Libretto. Quando l'annuncio esce, ricevono
una notifica i lavoratori disponibili compatibili per zona, periodo e ruolo. L'annuncio scade da
solo all'inizio del periodo.

## Verifica del datore

Per cercare e pubblicare serve un profilo datore verificato: è il cambiamento principale
rispetto alla V1, dove il datore conferma senza account.

- Verifica minima: numero di telefono più partita IVA.
- I datori che hanno già confermato stagioni sono già noti al sistema: per loro l'attivazione è
  quasi automatica.
- Qui si applica il filtro deciso: ristoranti, bar, hotel e piccoli negozi locali sì, grandi
  catene no.
- Un datore segnalato da più lavoratori viene sospeso e controllato a mano.

## Rischi e domande aperte

| Rischio | Perché conta | Risposta proposta |
|---|---|---|
| Densità | Una ricerca che restituisce 3 profili fa perdere il datore | Aprire una zona alla volta, partendo da Terracina |
| Simmetria | I lavoratori vorranno sapere com'è il datore | Non subito; da valutare dopo la prima stagione |
| Diventare un portale | Annunci lunghi e requisiti pesanti tolgono il vantaggio | Annuncio corto, paga obbligatoria |
| Spam | Datori che contattano tutti | Contatto solo su richiesta accettata, limite di richieste al giorno |

Domande aperte:

- [ ] Chi paga e quanto: il datore per pubblicare, per contattare, o niente all'inizio?
- [ ] Quanti profili disponibili servono in una zona prima di aprire la ricerca?
- [ ] La paga obbligatoria scoraggia troppi datori?

## Cosa fare ora vs dopo

Ora si fa solo ciò che evita di rifare la V1 a gennaio; il resto aspetta.

Ora (dentro la V1):

- [ ] Verificare che il modello dati regga la disponibilità (ruolo, zona, periodo, tipo) anche se
  la UI non la mostra.
- [ ] Tenere separati i permessi "chi ha il link" e "chi può cercare".
- [ ] Chiedere a chi ha fatto la domanda quanto spende oggi per trovare personale e dove lo cerca.

Dopo (fase 2, circa gennaio 2027):

- [ ] Stato "disponibile" e profilo datore verificato.
- [ ] Ricerca con contatto su richiesta.
- [ ] Annunci corti con notifica ai lavoratori compatibili.

---

## Note sul confronto con il codice (1° ottobre 2026)

**«Tenere separati i permessi».** Qui c'era un buco vero, già in V1: le regole lasciavano a
chiunque *elencare* tutti i profili pubblici, senza conoscere il link. La promessa
dell'informativa, «raggiungibile solo da chi ha il tuo link», era falsa. Chiuso il 1° ottobre
(`firestore.rules`, `get` al posto di `read`), con una prova che lo dimostra. Da qui in poi la
ricerca non potrà passare da `profiliPubblici` per sbaglio: dovrà avere un permesso suo.

**«Il modello dati regge la disponibilità?»** Non serve toccare la V1. `profiliPubblici` lo
ricostruisce `pubblicaProfilo` partendo da `workers`, quindi aggiungere ruoli, raggio, periodo e
tipo a gennaio costa una modifica alla funzione e una ricostruzione, non un trasloco. Oggi ci sono
già `disponibile`, `stagioneDisponibile`, `ruoloPrincipale` e il `geohash` del comune.

**Attenzione al significato di `disponibile`.** Oggi vuol dire solo «mostra il badge sulla mia
pagina». Non è un consenso a comparire nelle ricerche, e non va riusato come tale: chi l'ha
acceso in V1 non ha accettato di farsi trovare da sconosciuti. La fase 2 vuole un interruttore
nuovo, una versione nuova dell'informativa e un consenso nuovo (deciso il 2 ottobre: vedi
`DECISIONI.md`).

**Densità.** La specifica risponde già: la ricerca si accende con circa 50 profili confermati in
zona (§2, §11).

**«Il filtro deciso: grandi catene no».** Deciso il 2 ottobre, con criteri precisi: vedi
`DECISIONI.md`.

**Le notifiche.** La V1 non ne ha: il canale è WhatsApp. Le notifiche web su iPhone arrivano solo
con l'app installata sulla schermata Home, e i messaggi WhatsApp automatici si pagano uno per uno.
Canale deciso il 2 ottobre: vedi `DECISIONI.md`.

**Il passo 5** è l'idea più forte: ogni assunzione produce una conferma. Vale con le stesse
regole di oggi: il link arriva al numero verificato del datore, e conferma solo lui.

**Il datore segnalato** è il primo dato negativo su una persona che Libretto terrebbe. Serve la
stessa prudenza delle segnalazioni sui lavoratori: sospende e si guarda a mano, non si pubblica.

**Privacy.** La ricerca cambia la frase «raggiungibile solo da chi ha il tuo link». Conviene
dirlo già al professionista di PC5, così rivede l'informativa una volta sola.
