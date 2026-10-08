import { useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getFirebaseAuth } from '../lib/firebase';
import { useStatusRobo } from '../hooks/useStatusRobo';
import { resumirStatusRobo, type NivelRobo } from '../lib/statusRobo';

const CORES: Record<NivelRobo, string> = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  atencao: 'bg-amber-50 text-amber-800 border-amber-200',
  erro: 'bg-red-50 text-red-800 border-red-200',
  desconhecido: 'bg-gray-50 text-gray-600 border-gray-200',
};

/**
 * Faixa com o estado do robô de atualização de processos (última execução,
 * erros, vigia ligado ou não) e, para master/apoio, o botão "Atualizar agora"
 * — que pede ao vigia do robô, no PC dele, para iniciar uma rodada.
 */
export default function StatusRobo() {
  const { usuarioAtual } = useApp();
  const { execucoes, vigias, carregado, recarregar } = useStatusRobo();
  const [pedindo, setPedindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const podePedir = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'apoio';

  const resumo = useMemo(() => resumirStatusRobo(execucoes, vigias), [execucoes, vigias]);

  const pedirExecucao = async () => {
    if (!window.confirm('Pedir ao robô para atualizar os processos agora? Ele inicia em até 1 minuto no computador onde está ligado.')) return;
    setPedindo(true);
    setAviso(null);
    try {
      const idToken = await getFirebaseAuth()?.currentUser?.getIdToken();
      const resposta = await fetch('/api/robo/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken ?? ''}` },
        body: JSON.stringify({ quem: usuarioAtual?.nome ?? '' }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(dados.error ?? 'Não foi possível enviar o pedido.');
      setAviso('Pedido enviado. O robô começa em até 1 minuto (se o vigia estiver ligado).');
      void recarregar();
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : 'Não foi possível enviar o pedido.');
    } finally {
      setPedindo(false);
    }
  };

  if (!carregado) return null;

  return (
    <div className={`rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${CORES[resumo.nivel]}`}>
      <div className="flex items-start gap-2">
        <Bot className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">{resumo.texto}</p>
          <p className="text-xs opacity-80">{resumo.detalhe}</p>
          {aviso && <p className="text-xs mt-1 font-medium">{aviso}</p>}
        </div>
      </div>
      {podePedir && (
        <button
          type="button"
          onClick={pedirExecucao}
          disabled={pedindo || !resumo.vigiaLigado}
          title={resumo.vigiaLigado ? 'Pede ao robô para atualizar agora' : 'O vigia do robô não está ligado em nenhum computador'}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-current bg-white/60 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${pedindo ? 'animate-spin' : ''}`} />
          Atualizar agora
        </button>
      )}
    </div>
  );
}
