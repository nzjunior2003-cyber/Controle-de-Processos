import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { TipoEmpenho } from '../../types';

const ANO_ATUAL = new Date().getFullYear();
const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';
const paraDataInput = (isoOuVazio?: string) => (isoOuVazio ? isoOuVazio.split('T')[0] : '');

/**
 * Nota de Empenho (NE) de um contrato: a de **origem** (em despesa estimativa,
 * valor simbólico de R$ 1,00, com o PRD do exercício) ou um **reforço**
 * (cobre o valor de uma fatura antes do pagamento).
 */
export default function EmpenhoForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { empenhos, contratos, dotacoes, addEmpenho, updateEmpenho, deleteEmpenho, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const empenho = id ? empenhos.find((e) => e.id === id) : undefined;

  const [contratoId, setContratoId] = useState(empenho?.contratoId ?? searchParams.get('contratoId') ?? '');
  const [exercicio, setExercicio] = useState(empenho?.exercicio ?? ANO_ATUAL);
  const [tipo, setTipo] = useState<TipoEmpenho>(empenho?.tipo ?? 'origem');
  const [numero, setNumero] = useState(empenho?.numero ?? '');
  const [neOrigemId, setNeOrigemId] = useState(empenho?.neOrigemId ?? '');
  const [valor, setValor] = useState(empenho?.valor != null ? String(empenho.valor) : '');
  const [dotacaoId, setDotacaoId] = useState(empenho?.dotacaoId ?? '');
  const [estimativo, setEstimativo] = useState(empenho?.estimativo ?? true);
  const [paeOrigem, setPaeOrigem] = useState(empenho?.paeOrigem ?? '');
  const [data, setData] = useState(paraDataInput(empenho?.data));
  const [observacao, setObservacao] = useState(empenho?.observacao ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const contratosOrdenados = useMemo(() => [...contratos].sort((a, b) => a.numero.localeCompare(b.numero)), [contratos]);
  const origensDoContrato = empenhos.filter(
    (e) => e.contratoId === contratoId && e.tipo === 'origem' && e.exercicio === exercicio && e.id !== id,
  );

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoId || !numero || valor === '') return;

    setSalvando(true);
    try {
      // Texto vazio (e não `undefined`) nos campos limpáveis: o update ignora
      // `undefined`, então apagar a dotação, por exemplo, não chegaria ao banco.
      const comum = {
        contratoId,
        exercicio,
        tipo,
        numero,
        valor: Number(valor.replace(',', '.')),
        dotacaoId,
        data: data ? new Date(data).toISOString() : '',
        observacao,
      };
      const especifico =
        tipo === 'origem'
          ? {
              estimativo,
              paeOrigem,
              neOrigemId: '',
            }
          : { neOrigemId, paeOrigem: '' };

      if (emEdicao && id) {
        await updateEmpenho(id, { ...comum, ...especifico });
      } else {
        // Firestore não aceita `undefined`; só entra o que tem valor.
        const dados = Object.fromEntries(Object.entries({ ...comum, ...especifico }).filter(([, v]) => v !== undefined && v !== ''));
        await addEmpenho(dados as Parameters<typeof addEmpenho>[0]);
      }
      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível salvar a NE: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir esta NE? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await deleteEmpenho(id);
      navigate('/sistema/financeiro');
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível excluir a NE.');
    } finally {
      setExcluindo(false);
    }
  };

  if (usuarioAtual?.perfil !== 'master' && usuarioAtual?.perfil !== 'financeiro') {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar este módulo.</div>;
  }

  if (emEdicao && !empenho) {
    return <div className="p-6">NE não encontrada.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{emEdicao ? 'Editar NE' : 'Nova Nota de Empenho (NE)'}</h1>
          <p className="mt-1 text-sm text-gray-500">
            NE de origem (despesa estimativa, valor simbólico) ou NE de reforço de uma fatura.
          </p>
        </div>
        {emEdicao && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="-ml-1 mr-1.5 h-4 w-4" />
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="contratoId" className="block text-sm font-medium text-gray-700">
                Contrato <span className="text-red-500">*</span>
              </label>
              <select id="contratoId" required value={contratoId} onChange={(e) => setContratoId(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                <option value="">Selecione o contrato...</option>
                {contratosOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero} — {c.empresa}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">Tipo</label>
              <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEmpenho)} className={`${CLASSE_INPUT} bg-white`}>
                <option value="origem">NE de origem</option>
                <option value="reforco">NE de reforço</option>
              </select>
            </div>

            <div>
              <label htmlFor="exercicio" className="block text-sm font-medium text-gray-700">
                Exercício <span className="text-red-500">*</span>
              </label>
              <input type="number" id="exercicio" required value={exercicio} onChange={(e) => setExercicio(Number(e.target.value))} className={CLASSE_INPUT} />
            </div>

            <div>
              <label htmlFor="numero" className="block text-sm font-medium text-gray-700">
                Nº da NE <span className="text-red-500">*</span>
              </label>
              <input type="text" id="numero" required value={numero} onChange={(e) => setNumero(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: 73 (ou 24/25 se forem duas)" />
            </div>

            <div>
              <label htmlFor="valor" className="block text-sm font-medium text-gray-700">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input type="number" id="valor" required step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className={CLASSE_INPUT} placeholder={tipo === 'origem' ? '1,00 (simbólico, se estimativo)' : 'Valor do reforço'} />
            </div>

            <div>
              <label htmlFor="dotacaoId" className="block text-sm font-medium text-gray-700">Dotação (ficha orçamentária)</label>
              <select id="dotacaoId" value={dotacaoId} onChange={(e) => setDotacaoId(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                <option value="">Nenhuma</option>
                {dotacoes.map((d) => (
                  <option key={d.id} value={d.id}>{d.codigo} — {d.descricao} ({d.exercicio})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="data" className="block text-sm font-medium text-gray-700">Data da NE</label>
              <input type="date" id="data" value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_INPUT} />
            </div>

            {tipo === 'reforco' && (
              <div className="md:col-span-2">
                <label htmlFor="neOrigemId" className="block text-sm font-medium text-gray-700">NE de origem que este reforço reforça</label>
                <select id="neOrigemId" value={neOrigemId} onChange={(e) => setNeOrigemId(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                  <option value="">Não informada</option>
                  {origensDoContrato.map((o) => (
                    <option key={o.id} value={o.id}>NE {o.numero} ({o.exercicio})</option>
                  ))}
                </select>
              </div>
            )}

            {tipo === 'origem' && (
              <>
                <div className="md:col-span-2 flex items-center">
                  <input id="estimativo" type="checkbox" checked={estimativo} onChange={(e) => setEstimativo(e.target.checked)} className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer" />
                  <label htmlFor="estimativo" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                    Despesa estimativa (valor mensal não fixo — cada fatura exige um reforço)
                  </label>
                </div>
                <div>
                  <label htmlFor="paeOrigem" className="block text-sm font-medium text-gray-700">PAE (protocolo) da origem</label>
                  <input type="text" id="paeOrigem" value={paeOrigem} onChange={(e) => setPaeOrigem(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: 2024/837675" />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label htmlFor="observacao" className="block text-sm font-medium text-gray-700">Observação</label>
              <textarea id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={CLASSE_INPUT} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button type="button" onClick={() => navigate(-1)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
              <Save className="-ml-1 mr-2 h-5 w-5" />
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar NE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
