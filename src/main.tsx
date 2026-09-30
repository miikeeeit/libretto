import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './stili.css';

const radice = document.getElementById('root');
if (!radice) throw new Error('Manca il contenitore #root.');

// Appena apri l'app controlla se c'è una versione nuova e, se c'è, ricarica la pagina
// da sola. Senza, la versione nuova si scaricava ma si vedeva solo all'apertura dopo:
// il 30 settembre un deploy con una correzione sembrava non essere arrivato.
// Il controllo si fa solo all'apertura, così non ricarica mai mentre scrivi.
registerSW({ immediate: true });

createRoot(radice).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
