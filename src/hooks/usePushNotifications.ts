import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';

/** Converte a chave pública VAPID (base64url) pro formato Uint8Array exigido pelo `pushManager.subscribe`. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Pede permissão de notificação do navegador, assina o `pushManager` do
 * Service Worker (VAPID) e grava a inscrição no Firestore
 * (`registrarPushSubscription`, AppContext.tsx) pra que outros usuários
 * consigam achá-la e disparar push pra este usuário/dispositivo.
 */
export function usePushNotifications() {
  const { usuarioAtual, registrarPushSubscription } = useApp();
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const suportado =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  const ativar = useCallback(async () => {
    if (!suportado || !usuarioAtual) return;
    const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!chavePublica) {
      setErro('Push não está configurado neste ambiente.');
      return;
    }

    setAtivando(true);
    setErro(null);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setErro('Permissão de notificação negada.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(chavePublica),
        });
      }

      const dados = subscription.toJSON();
      if (!dados.endpoint || !dados.keys?.p256dh || !dados.keys?.auth) {
        throw new Error('Inscrição de push inválida.');
      }

      await registrarPushSubscription({
        usuarioId: usuarioAtual.id,
        endpoint: dados.endpoint,
        keys: { p256dh: dados.keys.p256dh, auth: dados.keys.auth },
      });
    } catch (e) {
      console.error('Erro ao ativar notificações push:', e);
      setErro('Não foi possível ativar as notificações push.');
    } finally {
      setAtivando(false);
    }
  }, [suportado, usuarioAtual, registrarPushSubscription]);

  return { suportado, ativando, erro, ativar };
}
