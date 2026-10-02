import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

const formatarQuando = (iso: string) => {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

/**
 * Central de notificações do sistema (o sino do cabeçalho) — mostra as
 * últimas notificações do usuário logado (`notificacoes`, ver
 * `useNotificacoesDoUsuario` em AppContext.tsx), com contagem de não
 * lidas. Clicar marca como lida e navega pra `url`, quando houver.
 */
export default function NotificacaoSino() {
  const { notificacoes, marcarNotificacaoLida, excluirNotificacao, marcarTodasNotificacoesLidas, limparNotificacoes } = useApp();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { suportado, ativando, erro, ativar } = usePushNotifications();

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const podeAtivarPush =
    suportado && typeof Notification !== 'undefined' && Notification.permission === 'default';

  useEffect(() => {
    if (!aberto) return;
    const handleClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [aberto]);

  const handleClicarNotificacao = async (id: string, lida: boolean, url?: string) => {
    if (!lida) {
      try {
        await marcarNotificacaoLida(id);
      } catch (erro) {
        console.error('Erro ao marcar notificação como lida:', erro);
      }
    }
    setAberto(false);
    if (url) navigate(url);
  };

  const handleExcluir = async (id: string) => {
    try {
      await excluirNotificacao(id);
    } catch (erro) {
      console.error('Erro ao excluir notificação:', erro);
      alert('Não foi possível excluir a notificação.');
    }
  };

  const handleMarcarTodasLidas = async () => {
    try {
      await marcarTodasNotificacoesLidas();
    } catch (erro) {
      console.error('Erro ao marcar notificações como lidas:', erro);
      alert('Não foi possível marcar as notificações como lidas.');
    }
  };

  const handleLimparTodas = async () => {
    if (!window.confirm('Apagar todas as suas notificações? Esta ação não pode ser desfeita.')) return;
    try {
      await limparNotificacoes();
    } catch (erro) {
      console.error('Erro ao limpar notificações:', erro);
      alert('Não foi possível limpar as notificações.');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setAberto((prev) => !prev)}
        className="relative p-1 rounded-full text-red-200 hover:text-white hover:bg-red-700 focus:outline-none transition-colors border border-transparent mx-4"
      >
        <span className="sr-only">Notificações</span>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold bg-amber-400 text-red-900">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-md shadow-lg border border-gray-200 z-50 text-gray-900">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold">Notificações</span>
          </div>
          {notificacoes.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between text-xs">
              {naoLidas > 0 ? (
                <button onClick={handleMarcarTodasLidas} className="font-medium text-gray-600 hover:underline">
                  Marcar todas como lidas ({naoLidas})
                </button>
              ) : (
                <span className="text-gray-400">Tudo lido</span>
              )}
              <button onClick={handleLimparTodas} className="font-medium text-red-700 hover:underline">
                Limpar todas
              </button>
            </div>
          )}
          {podeAtivarPush && (
            <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
              <button
                onClick={ativar}
                disabled={ativando}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                <BellRing className="h-3.5 w-3.5" />
                {ativando ? 'Ativando...' : 'Ativar notificações push'}
              </button>
              {erro && <p className="mt-1.5 text-[11px] text-red-600">{erro}</p>}
            </div>
          )}
          {notificacoes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma notificação ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notificacoes.map((n) => (
                <li key={n.id} className={`flex items-start ${n.lida ? '' : 'bg-red-50'}`}>
                  <button
                    onClick={() => handleClicarNotificacao(n.id, n.lida, n.url)}
                    className="block flex-1 text-left px-4 py-3 hover:bg-gray-50"
                  >
                    <p className={`text-sm ${n.lida ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.corpo}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{formatarQuando(n.criado_em)}</p>
                  </button>
                  <button
                    onClick={() => handleExcluir(n.id)}
                    className="p-3 text-gray-400 hover:text-red-600"
                    title="Excluir notificação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
