// Le rotte della §10. Chi è collegato e ha un profilo va al suo libretto,
// chi è collegato ma non ha ancora un profilo va a crearlo, gli altri all'accesso.

import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Accesso from './pages/Accesso';
import ComeFunziona from './pages/ComeFunziona';
import CreaProfilo from './pages/CreaProfilo';
import InArrivo from './pages/InArrivo';
import Libretto from './pages/Libretto';
import Privacy from './pages/Privacy';

function Attesa() {
  return (
    <main className="schermata schermata--centrata">
      <p className="aiuto">Un momento…</p>
    </main>
  );
}

export default function App() {
  const { utente, worker } = useAuth();
  const inCaricamento = utente === undefined || (utente !== null && worker === undefined);

  return (
    <Routes>
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/come-funziona" element={<ComeFunziona />} />

      {/* Settimana 3 e 4: qui arrivano la conferma del responsabile e la pagina pubblica. */}
      <Route
        path="/c/:token"
        element={
          <InArrivo
            titolo="Questo link non è ancora attivo"
            testo="Le conferme si aprono tra poco. Riprova più avanti o chiedi a chi ti ha mandato il link."
          />
        }
      />
      <Route
        path="/p/:slug"
        element={
          <InArrivo
            titolo="Questa pagina non è ancora attiva"
            testo="I profili pubblici si aprono tra poco."
          />
        }
      />

      <Route
        path="/"
        element={
          inCaricamento ? <Attesa /> : utente ? <Navigate to="/libretto" replace /> : <Accesso />
        }
      />
      <Route
        path="/libretto"
        element={
          inCaricamento ? (
            <Attesa />
          ) : !utente ? (
            <Navigate to="/" replace />
          ) : worker ? (
            <Libretto />
          ) : (
            <Navigate to="/profilo/nuovo" replace />
          )
        }
      />
      <Route
        path="/profilo/nuovo"
        element={
          inCaricamento ? (
            <Attesa />
          ) : !utente ? (
            <Navigate to="/" replace />
          ) : worker ? (
            <Navigate to="/libretto" replace />
          ) : (
            <CreaProfilo />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
