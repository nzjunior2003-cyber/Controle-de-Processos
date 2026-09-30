/// <reference lib="webworker" />
/**
 * Service Worker customizado (estratégia `injectManifest` do
 * vite-plugin-pwa — ver vite.config.ts) — a única razão de não usar o
 * `generateSW` padrão é precisar de um listener de `push` pras
 * notificações push (VAPID), que o SW 100% auto-gerado não suporta.
 * `precacheAndRoute` abaixo reproduz o mesmo comportamento de cache que o
 * `generateSW` fazia sozinho antes desta migração.
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

interface PayloadNotificacao {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let dados: PayloadNotificacao = {};
  try {
    dados = event.data?.json() ?? {};
  } catch {
    dados = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(dados.title || 'Controle de Processos', {
      body: dados.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url || '/sistema' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/sistema';

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existente = clientsList[0] as WindowClient | undefined;
      if (existente) {
        await existente.navigate(url);
        await existente.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
