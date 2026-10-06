import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ETAPAS_PAGAMENTO, SETORES_PAGAMENTO, registrarAndamento, statusDoPagamento } from '../../lib/financeiro';
import { STATUS_PAGAMENTO_LABELS, type PagamentoContrato, type StatusPagamento } from '../../types';

const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';

/**
 * Muda a etapa/situação de um pagamento sem abrir o formulário inteiro. Cada
 * mudança grava no histórico e avisa o fiscal do contrato (ver
 * `updatePagamento`); marcar como "Pago" também abate o saldo do contrato.
 */
export default function AndamentoRapidoModal({ pagamento, onFechar }: { pagamento: PagamentoContrato; onFechar: () => void }) {
  const { updatePagamento, usuarioAtual } = useApp();
  const [setorAtual, setSetorAtual] = useState(pagamento.setorAtual ?? '');
  const [etapa, setEtapa] = useState(pagamento.etapa ?? '');
  const [status, setStatus] = useState<StatusPagamento>(statusDoPagamento(pagamento));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudou = setorAtual !== (pagamento.setorAtual ?? '') || etapa !== (pagamento.etapa ?? '') || status !== statusDoPagamento(pagamento);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await updatePagamento(pagamento.id, {
        setorAtual,
        etapa,
        status,
        historico: registrarAndamento(pagamento, { setorAtual, etapa }, usuarioAtual?.nome ?? ''),
      });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar o pagamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={onFechar}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Andamento do pagamento</h3>
            <p className="text-sm text-gray-500">
              {(pagamento.documentos ?? []).map((d) => `${d.tipo} ${d.numero}`).join(', ') || 'Fatura'}
              {pagamento.paeFatura ? ` · PAE ${pagamento.paeFatura}` : ''}
            </p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="rapido-setor">Setor atual</label>
            <input id="rapido-setor" list="rapido-setores" value={setorAtual} onChange={(e) => setSetorAtual(e.target.value)} className={CLASSE_INPUT} />
            <datalist id="rapido-setores">{SETORES_PAGAMENTO.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="rapido-etapa">Etapa / o que falta</label>
            <input id="rapido-etapa" list="rapido-etapas" value={etapa} onChange={(e) => setEtapa(e.target.value)} className={CLASSE_INPUT} />
            <datalist id="rapido-etapas">{ETAPAS_PAGAMENTO.map((x) => <option key={x} value={x} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="rapido-status">Situação</label>
            <select id="rapido-status" value={status} onChange={(e) => setStatus(e.target.value as StatusPagamento)} className={`${CLASSE_INPUT} bg-white`}>
              {(Object.keys(STATUS_PAGAMENTO_LABELS) as StatusPagamento[]).map((s) => <option key={s} value={s}>{STATUS_PAGAMENTO_LABELS[s]}</option>)}
            </select>
            {status === 'pago' && statusDoPagamento(pagamento) !== 'pago' && (
              <p className="mt-1 text-xs text-amber-700">Ao marcar como Pago, o valor é descontado do saldo financeiro do contrato e o fiscal é avisado.</p>
            )}
          </div>
        </div>

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onFechar} className="bg-white py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" disabled={!mudou || salvando} onClick={salvar} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400">
            {salvando ? 'Salvando...' : 'Salvar andamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
