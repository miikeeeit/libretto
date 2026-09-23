import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { CLAIM, NOME_APP } from './src/config';

export default defineConfig(({ mode }) => {
  // L'errore più facile da fare, e il più difficile da accorgersene: mandare online una
  // build che punta agli emulatori. Il sito si apre, sembra funzionare, e non salva
  // niente da nessuna parte. Meglio che la build si rifiuti di partire.
  if (mode === 'production' && loadEnv(mode, process.cwd(), 'VITE_').VITE_USA_EMULATORI === '1') {
    throw new Error(
      'VITE_USA_EMULATORI=1 nel .env: questa build punterebbe agli emulatori locali.\n' +
        'Mettilo a 0 prima di mandare online, oppure: VITE_USA_EMULATORI=0 npm run build',
    );
  }

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: NOME_APP,
          short_name: NOME_APP,
          description: CLAIM,
          lang: 'it',
          start_url: '/libretto',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1a6b4f',
          icons: [
            { src: '/icona.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icona-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Le pagine pubbliche e di conferma devono mostrare sempre dati freschi:
          // non si mettono in cache, si servono dalla rete.
          navigateFallbackDenylist: [/^\/c\//, /^\/p\//],
        },
      }),
    ],
  };
});
