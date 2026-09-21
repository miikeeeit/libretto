// Segnaposto per le rotte già previste dalla specifica ma non ancora costruite:
// /c/:token (conferma, settimana 3) e /p/:slug (pagina pubblica, settimana 4).
// Esistono da subito perché un link aperto per sbaglio dica una cosa sensata,
// invece di mostrare la schermata di accesso.

import { Link } from 'react-router-dom';
import { NOME_APP } from '../config';

export default function InArrivo({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <main className="schermata schermata--centrata">
      <div className="scheda">
        <h1>{titolo}</h1>
        <p>{testo}</p>
        <p className="aiuto">
          <Link to="/come-funziona">Cos’è {NOME_APP}</Link>
        </p>
      </div>
    </main>
  );
}
