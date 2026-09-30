import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, PlusCircle, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import { saldoDaDotacao } from '../../lib/financeiro';

type Aba = 'pagamentos' | 'dotacoes';

/**
 * Módulo Financeiro — alimentado pela Diretoria de Finanças: pagamentos
 * efetuados aos fornecedores (vinculados por contrato/empenho/ordem de
 * pagamento) e dotações orçamentárias (saldo sempre calculado a partir dos
 * pagamentos, nunca persistido — ver `saldoDaDotacao`).
 */
export default function Financeiro() {
  const { pagamentos, dotacoes, contratos, usuarioAtual } = useApp();
  const navigate = useNavigate();
  const isMasterOuFinanceiro = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'financeiro';

  const [aba, setAba] = useState<Aba>('pagamentos');
  const [busca, setBusca] = useState('');

  const contratoPorId = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);

  const pagamentosFiltrados = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return pagamentos
      .filter((p) => {
        if (!buscaNormalizada) return true;
        const contrato = contratoPorId.get(p.contratoId);
        return [p.numeroEmpenho, p.numeroOrdemPagamento, p.fonteRecurso, contrato?.numero, contrato?.empresa]
          .some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime());
  }, [pagamentos, busca, contratoPorId]);

  const dotacoesFiltradas = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return dotacoes
      .filter((d) => {
        if (!buscaNormalizada) return true;
        return [d.codigo, d.descricao, d.fonteRecurso].some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => b.exercicio - a.exercicio || a.codigo.localeCompare(b.codigo));
  }, [dotacoes, busca]);

  const totalPago = pagamentosFiltrados.reduce((acc, p) => acc + (p.valorPago || 0), 0);

  if (usuarioAtual?.perfil === 'demandante') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <DollarSign className="w-6 h-6 mr-2 text-red-700 flex-shrink-0" />
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Pagamentos efetuados aos fornecedores e dotações orçamentárias, alimentados pela
            Diretoria de Finanças.
          </p>
        </div>
        {isMasterOuFinanceiro && (
          <button
            onClick={() => navigate(aba === 'pagamentos' ? '/sistema/financeiro/pagamentos/novo' : '/sistema/financeiro/dotacoes/novo')}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800"
          >
            <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
            {aba === 'pagamentos' ? 'Novo Pagamento' : 'Nova Dotação'}
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 flex gap-6">
        <button
          onClick={() => setAba('pagamentos')}
          className={`pb-3 text-sm font-medium border-b-2 ${aba === 'pagamentos' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Pagamentos
        </button>
        <button
          onClick={() => setAba('dotacoes')}
          className={`pb-3 text-sm font-medium border-b-2 ${aba === 'dotacoes' ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Dotações Orçamentárias
        </button>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200">
        <div className="relative max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
            placeholder={aba === 'pagamentos' ? 'Buscar por empenho, OP, fonte ou contrato...' : 'Buscar por código, descrição ou fonte...'}
          />
        </div>
      </div>

      {aba === 'pagamentos' ? (
        <>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
            <p className="text-sm text-gray-600">{pagamentosFiltrados.length} pagamento(s) encontrado(s)</p>
            <p className="text-sm font-semibold text-gray-900">Total pago: {formatarMoeda(totalPago)}</p>
          </div>
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empenho / OP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Pago</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Pagamento</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pagamentosFiltrados.map((p) => {
                  const contrato = contratoPorId.get(p.contratoId);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => isMasterOuFinanceiro && navigate(`/sistema/financeiro/pagamentos/${p.id}/editar`)}
                      className={`hover:bg-gray-50 ${isMasterOuFinanceiro ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contrato ? `${contrato.numero} — ${contrato.empresa}` : 'Contrato não encontrado'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {p.numeroEmpenho} / {p.numeroOrdemPagamento}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{p.fonteRecurso}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatarMoeda(p.valorPago)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {new Date(p.dataPagamento).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
                {pagamentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Nenhum pagamento encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código / Exercício</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fonte</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Dotado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Saldo Disponível</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dotacoesFiltradas.map((d) => {
                const saldo = saldoDaDotacao(d, pagamentos);
                return (
                  <tr
                    key={d.id}
                    onClick={() => isMasterOuFinanceiro && navigate(`/sistema/financeiro/dotacoes/${d.id}/editar`)}
                    className={`hover:bg-gray-50 ${isMasterOuFinanceiro ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{d.codigo}</div>
                      <div className="text-xs text-gray-500">{d.exercicio}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{d.descricao}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{d.fonteRecurso}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatarMoeda(d.valorDotado)}</td>
                    <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-medium ${saldo < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {formatarMoeda(saldo)}
                    </td>
                  </tr>
                );
              })}
              {dotacoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma dotação encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
