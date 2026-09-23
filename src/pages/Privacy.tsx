// /privacy · Informativa
//
// BOZZA. Copre i punti della §9, ma il testo e la base giuridica vanno fatti rivedere
// da un professionista prima del lancio pubblico (PC5). Non è un parere legale.
// I dati del titolare e l'email sono da completare (`src/config.ts`).

import { Link } from 'react-router-dom';
import { EMAIL_PRIVACY, NOME_APP, VERSIONE_INFORMATIVA } from '../config';

export default function Privacy() {
  return (
    <main className="schermata schermata--testo">
      <p className="avviso-bozza">
        Bozza di lavoro, versione {VERSIONE_INFORMATIVA}. Prima dell’apertura al pubblico questo testo
        va rivisto da un professionista.
      </p>

      <h1>Informativa privacy</h1>

      <h2>Chi tratta i tuoi dati</h2>
      <p>
        Il titolare del trattamento è la persona che gestisce {NOME_APP}. Per qualunque richiesta sui
        tuoi dati scrivi a <a href={`mailto:${EMAIL_PRIVACY}`}>{EMAIL_PRIVACY}</a>.
      </p>
      <p className="aiuto">
        Da completare prima del lancio: il nome e i riferimenti del titolare, e un indirizzo email
        vero per le richieste privacy (oggi qui c’è un segnaposto).
      </p>

      <h2>Cosa raccogliamo di te, se sei un lavoratore</h2>
      <ul>
        <li>il numero di telefono, che serve a farti entrare e a verificare che sei tu;</li>
        <li>nome, cognome, foto (se la carichi), ruolo e comune;</li>
        <li>le stagioni che scrivi, le competenze che dichiari e le conferme che ricevi;</li>
        <li>il CV in PDF, solo se lo carichi tu.</li>
      </ul>
      <p>
        Non chiediamo la data di nascita, l’indirizzo o il codice fiscale. La base giuridica è il tuo
        consenso, che dai quando entri e che puoi ritirare cancellando l’account.
      </p>

      <h2>Cosa raccogliamo del responsabile che conferma</h2>
      <p>
        Il numero di telefono, per verificare che la conferma arrivi davvero da quella persona, e il
        ruolo (titolare, chef, responsabile di sala…). Il nome, quello che scrivi tu per mandare il
        messaggio, serve solo a quello e <strong>non compare mai</strong> su nessuna pagina
        pubblica. Sul tuo profilo si legge il ruolo, per esempio «confermata dal titolare», non il
        nome.
      </p>

      <h2>Giudizi</h2>
      <p>
        {NOME_APP} registra solo giudizi positivi. Un responsabile può aggiungere «lo riprenderei», e
        può anche non aggiungerlo: se manca non vuol dire niente. Un giudizio negativo non esiste e non
        viene salvato da nessuna parte.
      </p>

      <h2>Chi vede il tuo profilo</h2>
      <p>
        Il tuo profilo è raggiungibile solo da chi ha il tuo link, e non finisce nei motori di ricerca.
        Puoi renderlo privato, nascondere una singola stagione, decidere se mostrare il telefono e se
        mostrare il CV. Il telefono non si vede, a meno che tu non lo accenda.
      </p>

      <h2>I tuoi diritti</h2>
      <ul>
        <li>scaricare tutti i tuoi dati in un file;</li>
        <li>cancellare l’account: sparisce tutto, profilo, stagioni, conferme, foto e CV;</li>
        <li>chiedere la correzione di quello che non è giusto;</li>
        <li>se sei un responsabile, revocare una conferma entro 30 giorni dal link che trovi nel
          messaggio di ringraziamento, e dopo scrivendo all’indirizzo qui sopra.</li>
      </ul>

      <h2>Per quanto tempo</h2>
      <p>
        Una richiesta di conferma chiusa — usata, scaduta o revocata — si cancella{' '}
        <strong>dopo 90 giorni</strong>, e con lei il nome e il numero del responsabile a cui era
        stata mandata. Non è una promessa sulla carta: lo fa una procedura automatica ogni notte.
      </p>
      <p>
        Un link di conferma che nessuno usa scade da solo dopo <strong>30 giorni</strong>. Un
        account che non si usa da tre anni riceve un avviso e poi viene cancellato.
      </p>

      <h2>Se qualcuno dice che una stagione non è vera</h2>
      <p>
        Un responsabile che riceve una richiesta può rispondere che quella persona non ha mai
        lavorato da lui. In quel caso la stagione non risulta più confermata e la segnalazione
        arriva a chi gestisce {NOME_APP}. Dopo due segnalazioni di questo tipo il libretto viene
        <strong> sospeso</strong>: il link pubblico smette di funzionare e non si possono chiedere
        altre conferme, finché la cosa non viene guardata da una persona. Non è un giudizio sul
        lavoro di nessuno: è un freno contro le stagioni inventate.
      </p>

      <h2>Dove stanno i dati</h2>
      <p>
        Su Google Firebase, in un data center in Italia (regione di Milano). Non usiamo strumenti di
        statistica di terze parti, quindi non c’è nessun banner dei cookie da accettare: contiamo solo
        quante registrazioni, quante richieste e quante conferme avvengono, senza sapere di chi sono.
      </p>

      <p className="aiuto">
        <Link to="/">Torna all’inizio</Link> · <Link to="/come-funziona">Come funziona {NOME_APP}</Link>
      </p>
    </main>
  );
}
