import { useState } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import DotacaoOrcamentariaEditor from '../../components/processo/DotacaoOrcamentariaEditor';
import { OPCOES_FONTE_PROCESSO } from '../../lib/planilhaProcessos';
import { limparClassificacoes } from '../../lib/orcamento';
import {
  TIPO_APOSTILAMENTO_LABELS,
  type Apostilamento,
  type ClassificacaoOrcamentaria,
  type Contrato,
  type TipoApostilamento,
} from '../../types';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';

interface Props {
  contrato: Contrato;
  apostilamentos: Apostilamento[];
  /** Dotação em vigor no contrato (a do próprio contrato ou, se não houver, a do processo de origem). */
  dotacoesAtuais: ClassificacaoOrcamentaria[];
  onAdicionar: (dados: {
    tipo: TipoApostilamento;
    numero: string;
    data: string;
    descricao: string;
    fonteNova?: string;
    dotacoesNovas?: ClassificacaoOrcamentaria[];
  }) => Promise<void>;
  onFechar: () => void;
}

/**
 * Apostilamentos de um contrato: alteração de dados contratuais, da fonte de
 * pagamento ou da dotação orçamentária. Não mexem em valor nem em prazo (isso
 * é aditivo); fonte e dotação, uma vez apostiladas, passam a valer no contrato.
 */
export default function ApostilamentoModal({ contrato, apostilamentos, dotacoesAtuais, onAdicionar, onFechar }: Props) {
  const [tipo, setTipo] = useState<TipoApostilamento>('DADOS_CONTRATUAIS');
  const [numero, setNumero] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [fonteNova, setFonteNova] = useState('');
  const [dotacoes, setDotacoes] = useState<ClassificacaoOrcamentaria[]>(dotacoesAtuais.length > 0 ? dotacoesAtuais : [{}]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dotacoesLimpas = limparClassificacoes(dotacoes);
  const invalido =
    !numero.trim() ||
    !data ||
    !descricao.trim() ||
    (tipo === 'FONTE_PAGAMENTO' && (!fonteNova || fonteNova === contrato.fonteRecurso)) ||
    (tipo === 'DOTACAO_ORCAMENTARIA' && dotacoesLimpas.length === 0);

  const salvar = async () => {
    if (invalido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onAdicionar({
        tipo,
        numero: numero.trim(),
        data,
        descricao: descricao.trim(),
        ...(tipo === 'FONTE_PAGAMENTO' ? { fonteNova } : {}),
        ...(tipo === 'DOTACAO_ORCAMENTARIA' ? { dotacoesNovas: dotacoesLimpas } : {}),
      });
      setNumero('');
      setDescricao('');
      setFonteNova('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={onFechar}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Apostilamentos</h3>
            <p className="text-sm text-gray-500">Contrato {contrato.numero} — {contrato.empresa}</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Histórico</h4>
          {apostilamentos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum apostilamento registrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
              {[...apostilamentos].sort((a, b) => b.data.localeCompare(a.data)).map((a) => (
                <li key={a.id} className="px-3 py-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-gray-900">Apostilamento nº {a.numero} — {formatarData(a.data)}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{TIPO_APOSTILAMENTO_LABELS[a.tipo]}</span>
                  </div>
                  <p className="text-gray-700">{a.descricao}</p>
                  {a.tipo === 'FONTE_PAGAMENTO' && (
                    <p className="text-xs text-gray-500">Fonte: {a.fonteAnterior || '-'} → {a.fonteNova}</p>
                  )}
                  <p className="text-xs text-gray-400">Registrado por {a.registradoPorNome}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-900">Novo apostilamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700" htmlFor="apost-tipo">O que foi alterado</label>
              <select id="apost-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoApostilamento)} className={`${CLASSE_INPUT} bg-white`}>
                {(Object.keys(TIPO_APOSTILAMENTO_LABELS) as TipoApostilamento[]).map((t) => (
                  <option key={t} value={t}>{TIPO_APOSTILAMENTO_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="apost-numero">Nº do apostilamento</label>
              <input id="apost-numero" type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: 1º" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="apost-data">Data</label>
              <input id="apost-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_INPUT} />
            </div>
            {tipo === 'FONTE_PAGAMENTO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="apost-fonte">Nova fonte (atual: {contrato.fonteRecurso || '-'})</label>
                <select id="apost-fonte" value={fonteNova} onChange={(e) => setFonteNova(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                  <option value="">Selecione...</option>
                  {OPCOES_FONTE_PROCESSO.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
          </div>
          {tipo === 'DOTACAO_ORCAMENTARIA' && (
            <div>
              <p className="text-sm font-medium text-gray-700">Nova dotação orçamentária</p>
              <DotacaoOrcamentariaEditor linhas={dotacoes} onChange={setDotacoes} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="apost-descricao">Descrição da alteração</label>
            <textarea id="apost-descricao" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: Alteração da razão social/representante; troca da fonte de TESOURO para FEBOM..." />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onFechar} className="bg-white py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Fechar</button>
            <button type="button" disabled={invalido || salvando} onClick={salvar} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400">
              {salvando ? 'Salvando...' : 'Registrar apostilamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
