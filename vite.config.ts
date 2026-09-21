import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { CLAIM, NOME_APP } from './src/config';

export default defineConfig({
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
});
