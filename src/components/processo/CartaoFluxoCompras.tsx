import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, CheckCircle2, ListChecks, Workflow } from 'lucide-react';
import {
  ETAPAS,
  PERGUNTAS,
  ROTULO_RITO,
  type CampoDecisao,
  type RitoCompras,
} from '../../config/fluxoCompras';
import { calcularFluxo, type ProcessoFluxo, type TramitacaoFluxo } from '../../lib/fluxoCompras';
import { camposConfirmacao, camposRito, camposResposta } from '../../lib/confirmacaoFluxo';
import type { Processo } from '../../types';

interface Props {
  processo: ProcessoFluxo & Pick<Processo, 'id'>;
  tramitacoes: TramitacaoFluxo[];
  /** master, apoio ou contratos; os demais só veem. */
  podeEditar: boolean;
  usuarioId: string;
  /** Nome de quem confirmou a etapa (a partir de `etapaConfirmadaPor`). */
  nomeConfirmador?: string;
  onSalvar: (campos: Partial<Processo>) => Promise<void>;
}

const GRUPOS = Array.from(new Set(ETAPAS.map((e) => e.grupo)));

/** Cartão "Fluxo de compras": onde o processo está, o próximo passo e as perguntas em aberto. */
export default function CartaoFluxoCompras({ processo, tramitacoes, podeEditar, usuarioId, nomeConfirmador, onSalvar }: Props) {
  const fluxo = useMemo(() => calcularFluxo(processo, tramitacoes), [processo, tramitacoes]);
  const [salvando, setSalvando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [escolhida, setEscolhida] = useState('');

  const salvar = async (campos: Partial<Processo>) => {
    setSalvando(true);
    try {
      await onSalvar(campos);
      setCorrigindo(false);
    } catch (erro) {
      alert('Não foi possível salvar: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  if (fluxo.foraDoFluxo) {
    return (
      <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="flex items-center text-base font-medium text-gray-900"><Workflow className="h-5 w-5 mr-2 text-gray-400" />Fluxo de compras</h2>
        <p className="mt-2 text-sm text-gray-500">Este tipo de processo não segue o fluxo de compras.</p>
      </section>
    );
  }

  const confirmar = (etapaId: string) => salvar(camposConfirmacao(etapaId, fluxo.sugestao?.etapaId, usuarioId));
  const bloqueio = fluxo.decisoesPendentes.find((d) => d.bloqueiaProximo);
  const outrasPerguntas = fluxo.decisoesPendentes.filter((d) => !d.bloqueiaProximo);
  const dataConfirmacao = processo.etapaConfirmadaEm ? new Date(processo.etapaConfirmadaEm) : null;
  const mostrarConfirmar = podeEditar && !!fluxo.sugestao && !fluxo.confirmada;

  const pergunta = (campo: CampoDecisao, texto: string, destaque: boolean) => (
    <div key={campo} className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 ${destaque ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <span className="text-sm text-gray-800">{texto}</span>
      {podeEditar && (
        <span className="flex gap-2">
          {[true, false].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              disabled={salvando}
              onClick={() => salvar(camposResposta(campo, valor))}
              className="px-3 py-1 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50"
            >
              {valor ? 'Sim' : 'Não'}
            </button>
          ))}
        </span>
      )}
    </div>
  );

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4" aria-label="Fluxo de compras">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center text-base font-medium text-gray-900">
          <Workflow className="h-5 w-5 mr-2 text-red-700" />Fluxo de compras
          {fluxo.rito && <span className="ml-2 text-xs font-normal text-gray-500">({ROTULO_RITO[fluxo.rito]})</span>}
        </h2>
        {fluxo.etapaAtual && (
          fluxo.confirmada ? (
            <span className="inline-flex items-center text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Confirmada{nomeConfirmador ? ` por ${nomeConfirmador}` : ''}
              {dataConfirmacao && !Number.isNaN(dataConfirmacao.getTime()) ? ` em ${format(dataConfirmacao, 'dd/MM/yyyy')}` : ''}
              {fluxo.etapaOrigem ? ` (${fluxo.etapaOrigem === 'auto' ? 'automática' : 'manual'})` : ''}
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Sugerida pelo sistema</span>
          )
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase">Etapa atual</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {fluxo.etapaAtual ? (<><strong>{fluxo.etapaAtual.id}</strong> — {fluxo.etapaAtual.nome}</>) : 'Ainda não identificada'}
          </dd>
          {fluxo.setorAgora && <dd className="text-xs text-gray-500">Age agora: {fluxo.setorAgora}</dd>}
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase">Próximo passo</dt>
          <dd className="mt-1 text-sm font-semibold text-red-800">
            {fluxo.concluido
              ? 'Fluxo concluído'
              : fluxo.proxima
                ? (<>{fluxo.proxima.nome}{fluxo.proximaOpcional ? ' (se necessário)' : ''}</>)
                : bloqueio ? 'Responda a pergunta abaixo' : '—'}
          </dd>
          {fluxo.setorProxima && !fluxo.concluido && <dd className="text-xs text-gray-500">Quem age: {fluxo.setorProxima}</dd>}
        </div>
      </dl>

      {fluxo.sugestaoDiferente && fluxo.sugestao && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-900">
          <span>O andamento indica a etapa <strong>{fluxo.sugestao.etapaId}</strong> ({ETAPAS.find((e) => e.id === fluxo.sugestao?.etapaId)?.nome}).</span>
          {podeEditar && (
            <button type="button" disabled={salvando} onClick={() => confirmar(fluxo.sugestao!.etapaId)} className="font-medium underline disabled:opacity-50">
              Atualizar para {fluxo.sugestao.etapaId}
            </button>
          )}
        </div>
      )}

      {!fluxo.rito && podeEditar && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
          Definir o rito processual:
          <select
            defaultValue=""
            disabled={salvando}
            onChange={(e) => e.target.value && salvar(camposRito(e.target.value as RitoCompras, processo))}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Escolha…</option>
            {(Object.keys(ROTULO_RITO) as RitoCompras[]).map((r) => <option key={r} value={r}>{ROTULO_RITO[r]}</option>)}
          </select>
        </label>
      )}

      {bloqueio && pergunta(bloqueio.campo, bloqueio.texto, true)}
      {outrasPerguntas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Perguntas em aberto</p>
          {outrasPerguntas.map((p) => pergunta(p.campo, PERGUNTAS[p.campo].texto, false))}
        </div>
      )}

      {fluxo.rito && !fluxo.e07.completo && fluxo.e07.faltando.length > 0 && (
        <div className="text-sm">
          <p className="flex items-center text-xs font-medium text-gray-500 uppercase"><ListChecks className="h-4 w-4 mr-1" />Falta nos artefatos (E07)</p>
          <ul className="mt-1 list-disc list-inside text-gray-800">
            {fluxo.e07.faltando.map((item) => <li key={item.id}>{item.rotulo}</li>)}
          </ul>
          {fluxo.e07.provisorio && <p className="text-xs text-gray-500 mt-1">Lista provisória: responda a pergunta sobre o valor da dispensa.</p>}
        </div>
      )}

      {podeEditar && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {mostrarConfirmar && (
            <button type="button" disabled={salvando} onClick={() => confirmar(fluxo.sugestao!.etapaId)} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4 mr-1" />Confirmar etapa atual
            </button>
          )}
          {fluxo.confirmada && fluxo.proxima && !fluxo.concluido && (
            <button type="button" disabled={salvando} onClick={() => confirmar(fluxo.proxima!.id)} className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50">
              <ArrowRight className="h-4 w-4 mr-1" />{fluxo.proximaOpcional ? 'Pular (não necessário)' : 'Avançar para a próxima etapa'}
            </button>
          )}
          <button type="button" onClick={() => setCorrigindo((v) => !v)} className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50">
            Corrigir etapa
          </button>
        </div>
      )}

      {podeEditar && corrigindo && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={escolhida} onChange={(e) => setEscolhida(e.target.value)} aria-label="Etapa correta" className="rounded-md border-gray-300 text-sm max-w-full">
            <option value="">Escolha a etapa correta…</option>
            {GRUPOS.map((grupo) => (
              <optgroup key={grupo} label={grupo}>
                {ETAPAS.filter((e) => e.grupo === grupo).map((e) => <option key={e.id} value={e.id}>{e.id} — {e.nome}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" disabled={!escolhida || salvando} onClick={() => confirmar(escolhida)} className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
            Salvar etapa
          </button>
        </div>
      )}
    </section>
  );
}
