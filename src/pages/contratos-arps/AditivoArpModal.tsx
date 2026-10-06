import { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import type { AditivoArp, ProcedimentoLicitatorio } from '../../types';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';

interface Props {
  procedimento: ProcedimentoLicitatorio;
  aditivos: AditivoArp[];
  onAdicionar: (dados: { numero: string; data: string; novaFimVigencia: string; observacao?: string }) => Promise<void>;
  onFechar: () => void;
}

/**
 * Aditivos de uma ARP/ata (adesão, partícipe...): prorrogação da vigência da
 * ata, com o histórico de cada um. Ao registrar, a vigência da ata é atualizada.
 */
export default function AditivoArpModal({ procedimento, aditivos, onAdicionar, onFechar }: Props) {
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [novaFim, setNovaFim] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vigenciaAtual = procedimento.vigenciaArp ?? '';
  const invalido = !numero.trim() || !data || !novaFim || (!!vigenciaAtual && novaFim <= vigenciaAtual);

  const salvar = async () => {
    if (invalido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onAdicionar({ numero: numero.trim(), data, novaFimVigencia: novaFim, ...(observacao.trim() ? { observacao: observacao.trim() } : {}) });
      setNumero('');
      setNovaFim('');
      setObservacao('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={onFechar}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Aditivos da ata</h3>
            <p className="text-sm text-gray-500">{procedimento.modalidade} {procedimento.numero} — PAE {procedimento.pae}</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          Vigência atual da ata: <strong>{vigenciaAtual ? formatarData(vigenciaAtual) : 'não informada'}</strong>
        </p>

        <div className="mb-6">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Histórico</h4>
          {aditivos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum aditivo registrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
              {[...aditivos].sort((a, b) => b.data.localeCompare(a.data)).map((a) => (
                <li key={a.id} className="px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">Aditivo nº {a.numero} — {formatarData(a.data)}</span>
                    <span className="text-gray-600">{a.vigenciaAnterior ? `${formatarData(a.vigenciaAnterior)} → ` : ''}{formatarData(a.novaFimVigencia)}</span>
                  </div>
                  {a.observacao && <p className="text-xs text-gray-500">{a.observacao}</p>}
                  <p className="text-xs text-gray-400">Registrado por {a.registradoPorNome}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Novo aditivo (prorrogação de vigência)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="aditivo-numero">Nº do aditivo</label>
              <input id="aditivo-numero" type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: 1º" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="aditivo-data">Data</label>
              <input id="aditivo-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="aditivo-fim">Nova vigência até</label>
              <input id="aditivo-fim" type="date" value={novaFim} onChange={(e) => setNovaFim(e.target.value)} className={CLASSE_INPUT} />
            </div>
          </div>
          {!!vigenciaAtual && !!novaFim && novaFim <= vigenciaAtual && (
            <p className="text-xs text-amber-700">A nova vigência precisa ser depois da atual ({formatarData(vigenciaAtual)}).</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="aditivo-obs">Observação</label>
            <textarea id="aditivo-obs" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={CLASSE_INPUT} />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onFechar} className="bg-white py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Fechar</button>
            <button type="button" disabled={invalido || salvando} onClick={salvar} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400">
              {salvando ? 'Salvando...' : 'Registrar aditivo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
