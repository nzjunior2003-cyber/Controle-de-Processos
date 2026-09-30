import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OPCOES_FONTE_PROCESSO } from '../../lib/planilhaProcessos';

const paraDataInput = (isoOuVazio?: string) => (isoOuVazio ? isoOuVazio.split('T')[0] : '');

export default function PagamentoForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { pagamentos, contratos, dotacoes, addPagamento, updatePagamento, deletePagamento, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const pagamento = id ? pagamentos.find((p) => p.id === id) : undefined;

  const [contratoId, setContratoId] = useState(pagamento?.contratoId ?? searchParams.get('contratoId') ?? '');
  const [numeroEmpenho, setNumeroEmpenho] = useState(pagamento?.numeroEmpenho ?? '');
  const [numeroOrdemPagamento, setNumeroOrdemPagamento] = useState(pagamento?.numeroOrdemPagamento ?? '');
  const [dotacaoId, setDotacaoId] = useState(pagamento?.dotacaoId ?? '');
  const [fonteRecurso, setFonteRecurso] = useState(pagamento?.fonteRecurso ?? '');
  const [valorPago, setValorPago] = useState(pagamento?.valorPago != null ? String(pagamento.valorPago) : '');
  const hoje = new Date().toISOString().split('T')[0];
  const [dataPagamento, setDataPagamento] = useState(paraDataInput(pagamento?.dataPagamento) || hoje);
  const [observacao, setObservacao] = useState(pagamento?.observacao ?? '');
  const [anexoLink, setAnexoLink] = useState(pagamento?.anexoLink ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const contratosOrdenados = [...contratos].sort((a, b) => a.numero.localeCompare(b.numero));

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoId || !numeroEmpenho || !numeroOrdemPagamento || !valorPago) return;

    setSalvando(true);
    try {
      const dadosComuns = {
        contratoId,
        numeroEmpenho,
        numeroOrdemPagamento,
        dotacaoId: dotacaoId || undefined,
        fonteRecurso,
        valorPago: Number(valorPago.replace(',', '.')),
        dataPagamento: new Date(dataPagamento).toISOString(),
        observacao,
        anexoLink,
      };

      if (emEdicao && id) {
        await updatePagamento(id, dadosComuns);
      } else {
        await addPagamento(dadosComuns);
      }

      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível salvar o pagamento: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir este pagamento? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await deletePagamento(id);
      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível excluir o pagamento: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setExcluindo(false);
    }
  };

  if (usuarioAtual?.perfil !== 'master' && usuarioAtual?.perfil !== 'financeiro') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  if (emEdicao && !pagamento) {
    return <div className="p-6">Pagamento não encontrado.</div>;
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
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? 'Editar Pagamento' : 'Novo Pagamento'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Lançamento financeiro vinculado a um contrato.</p>
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
              <select
                id="contratoId"
                required
                value={contratoId}
                onChange={(e) => setContratoId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione o contrato...</option>
                {contratosOrdenados.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero} — {c.empresa}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="numeroEmpenho" className="block text-sm font-medium text-gray-700">
                Nº do Empenho <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="numeroEmpenho"
                required
                value={numeroEmpenho}
                onChange={(e) => setNumeroEmpenho(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="numeroOrdemPagamento" className="block text-sm font-medium text-gray-700">
                Nº da Ordem de Pagamento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="numeroOrdemPagamento"
                required
                value={numeroOrdemPagamento}
                onChange={(e) => setNumeroOrdemPagamento(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="dotacaoId" className="block text-sm font-medium text-gray-700">Dotação Orçamentária</label>
              <select
                id="dotacaoId"
                value={dotacaoId}
                onChange={(e) => setDotacaoId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Nenhuma</option>
                {dotacoes.map((d) => (
                  <option key={d.id} value={d.id}>{d.codigo} — {d.descricao} ({d.exercicio})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fonteRecurso" className="block text-sm font-medium text-gray-700">Fonte do Recurso</label>
              <select
                id="fonteRecurso"
                value={fonteRecurso}
                onChange={(e) => setFonteRecurso(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione...</option>
                {OPCOES_FONTE_PROCESSO.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="valorPago" className="block text-sm font-medium text-gray-700">
                Valor Pago (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="valorPago"
                required
                step="0.01"
                min="0"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="dataPagamento" className="block text-sm font-medium text-gray-700">
                Data do Pagamento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dataPagamento"
                required
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="anexoLink" className="block text-sm font-medium text-gray-700">Comprovante (link)</label>
              <input
                type="text"
                id="anexoLink"
                value={anexoLink}
                onChange={(e) => setAnexoLink(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="observacao" className="block text-sm font-medium text-gray-700">Observação</label>
              <textarea
                id="observacao"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar Pagamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
