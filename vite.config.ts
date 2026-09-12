import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Só o app shell (JS/CSS/ícones) é pré-cacheado, pra abrir rápido
        // e ser instalável — dados (Firestore/API) continuam sempre
        // buscados da rede, sem cache offline, pra nunca mostrar
        // processos/contratos desatualizados.
        workbox: {
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          // logo-qcg.png é usado só na tela pública/login (não é crítico
          // pra abrir o app offline) e passa do limite padrão de 2 MiB —
          // fica de fora do pré-cache do service worker, só carregado
          // normalmente pela rede quando a tela que o usa é aberta.
          globIgnores: ['**/logo-qcg.png'],
        },
        manifest: {
          name: 'Controle de Processos — CBMPA',
          short_name: 'Controle de Processos',
          description: 'Sistema de Controle de Processos do Corpo de Bombeiros Militar do Pará',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#f9fafb',
          theme_color: '#7f1d1d',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
