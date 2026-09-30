import { useMemo, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';

/**
 * Plano de Contratação Anual — listagem somente leitura dos itens
 * importados da planilha pública "GERAL PCA" (ver AppContext.tsx,
 * `importarPcas`), com filtro por exercício, unidade e prioridade, e
 * indicação de quantos processos já foram abertos para cada item
 * (mesma lógica de contagem por `pca_id` usada em NovoProcesso.tsx).
 */
export default function PlanoContratacaoAnual() {
  const { pcas, processos } = useApp();

  const exerciciosDisponiveis = useMemo(
    () => Array.from(new Set(pcas.map((p) => p.exercicio))).sort((a, b) => b - a),
    [pcas],
  );

  const [exercicio, setExercicio] = useState<number | ''>(exerciciosDisponiveis[0] ?? '');
  const [busca, setBusca] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');

  const contagemVinculos = useMemo(() => {
    return processos.reduce<Record<string, number>>((contagem, p) => {
      if (p.pca_id) contagem[p.pca_id] = (contagem[p.pca_id] ?? 0) + 1;
      return contagem;
    }, {});
  }, [processos]);

  const itensFiltrados = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return pcas
      .filter((p) => (exercicio === '' ? true : p.exercicio === exercicio))
      .filter((p) => (filtroPrioridade ? p.prioridade === filtroPrioridade : true))
      .filter((p) => {
        if (!buscaNormalizada) return true;
        return [p.codigo_pca, p.objeto_pca, p.unidade_responsavel, p.origem, p.numero_pae]
          .some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => Number(a.codigo_pca) - Number(b.codigo_pca));
  }, [pcas, exercicio, filtroPrioridade, busca]);

  const valorTotalFiltrado = itensFiltrados.reduce((acc, p) => acc + (p.valor_previsto || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <ClipboardCheck className="w-6 h-6 mr-2 text-red-700 flex-shrink-0" />
          Plano de Contratação Anual (PCA)
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Itens importados da planilha oficial do PCA, com indicação dos processos já abertos
          para cada um. Um mesmo item pode dar origem a mais de um processo.
        </p>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
            placeholder="Buscar por ordem, objeto, unidade ou PAE..."
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <select
            value={exercicio}
            onChange={(e) => setExercicio(e.target.value ? Number(e.target.value) : '')}
            className="block w-full sm:w-40 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
          >
            <option value="">Todos os exercícios</option>
            {exerciciosDisponiveis.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="block w-full sm:w-40 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
          >
            <option value="">Toda prioridade</option>
            <option value="ALTA">Alta</option>
            <option value="MÉDIA">Média</option>
            <option value="BAIXA">Baixa</option>
          </select>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {itensFiltrados.length} item(ns) encontrado(s)
        </p>
        <p className="text-sm font-semibold text-gray-900">
          Valor total estimado: {formatarMoeda(valorTotalFiltrado)}
        </p>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ordem / Origem</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modalidade</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Previsto</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Prioridade</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Processos Vinculados</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {itensFiltrados.map((item) => {
              const vinculos = contagemVinculos[item.id] ?? 0;
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">Nº {item.codigo_pca}</div>
                    <div className="text-xs text-gray-500">{item.origem || item.unidade_responsavel}</div>
                  </td>
                  <td className="px-4 py-4 max-w-md">
                    <div className="text-sm text-gray-900 line-clamp-2" title={item.objeto_pca}>{item.objeto_pca}</div>
                    {item.numero_pae && (
                      <div className="text-xs text-gray-500 mt-0.5">PAE: {item.numero_pae}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {item.modalidade_licitacao || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatarMoeda(item.valor_previsto)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {item.prioridade ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.prioridade === 'ALTA'
                            ? 'bg-red-50 text-red-700'
                            : item.prioridade === 'MÉDIA'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.prioridade}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    {vinculos > 0 ? (
                      <span className="text-xs font-medium text-red-700">{vinculos} processo(s)</span>
                    ) : (
                      <span className="text-xs text-gray-400">Nenhum</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Nenhum item do PCA encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
