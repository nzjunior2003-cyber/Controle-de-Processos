import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
  const { notificacoes, marcarNotificacaoLida } = useApp();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

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
            {naoLidas > 0 && <span className="text-xs text-gray-500">{naoLidas} não lida(s)</span>}
          </div>
          {notificacoes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma notificação ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notificacoes.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClicarNotificacao(n.id, n.lida, n.url)}
                    className={`block w-full text-left px-4 py-3 hover:bg-gray-50 ${n.lida ? '' : 'bg-red-50'}`}
                  >
                    <p className={`text-sm ${n.lida ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.corpo}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{formatarQuando(n.criado_em)}</p>
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
