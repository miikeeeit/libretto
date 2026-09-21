// /come-funziona · le tre righe che spiegano cos'è una conferma verificata (§4.3).

import { Link } from 'react-router-dom';
import { NOME_APP } from '../config';

export default function ComeFunziona() {
  return (
    <main className="schermata schermata--testo">
      <h1>Come funziona {NOME_APP}</h1>

      <ol className="passi">
        <li>
          <strong>Scrivi le tue stagioni.</strong> Struttura, ruolo, periodo e cosa sai fare. Ci
          metti due minuti per ognuna.
        </li>
        <li>
          <strong>Chiedi la conferma a chi ti ha visto lavorare.</strong> Mandi il link dal tuo
          WhatsApp al titolare o al capo sala. Chi lo riceve verifica il proprio numero con un SMS e
          conferma con un tap.
        </li>
        <li>
          <strong>Mostri un profilo che non si può inventare.</strong> Chi apre il tuo link vede quali
          stagioni sono confermate e da quante strutture, separate da quelle che hai solo dichiarato.
        </li>
      </ol>

      <h2>Perché una conferma qui vale</h2>
      <p>
        Perché non la scrive il lavoratore. Arriva da un telefono verificato con un codice SMS, e deve
        essere lo stesso numero a cui è stata mandata la richiesta: un link girato a un amico non
        funziona.
      </p>

      <h2>Chi conferma non si espone</h2>
      <p>
        Il nome di chi conferma non compare mai. Sul profilo si legge il ruolo, per esempio «confermata
        dal titolare». E può confermare solo cose positive: un giudizio negativo su {NOME_APP} non
        esiste.
      </p>

      <h2>I dati sono tuoi</h2>
      <p>
        Puoi rendere il profilo privato, nascondere una stagione, scaricare tutto o cancellare
        l’account quando vuoi. Il tuo numero non si vede, se non lo accendi tu.
      </p>

      <p className="aiuto">
        <Link to="/">Entra in {NOME_APP}</Link> · <Link to="/privacy">Informativa privacy</Link>
      </p>
    </main>
  );
}
