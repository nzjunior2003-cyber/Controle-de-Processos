import React from 'react';
import { useApp } from '../context/AppContext';

const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export default function IntegracaoPCA() {
  const { pcas } = useApp();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Itens do PCA ({pcas.length} registros sincronizados)</h2>
        </div>
        {/* Celular/tablet: cartões com cores alternadas (a tabela de 6 colunas não cabe) */}
        <div className="lg:hidden -mx-6 border-t border-gray-200" aria-label="Itens do PCA (celular e tablet)">
          {pcas.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500">Nenhum item do PCA integrado ainda. Em sincronização...</p>
          ) : (
            pcas.map((pca, indice) => (
              <div key={pca.id} className={`px-4 py-3 ${indice % 2 === 1 ? 'bg-gray-100' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">Ordem {pca.codigo_pca}</p>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{moeda(pca.valor_previsto)}</p>
                </div>
                <p className="mt-1 text-sm text-gray-800 break-words">{pca.objeto_pca}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-gray-500 uppercase">Demandante</dt>
                    <dd className="text-gray-900 break-words">{pca.unidade_responsavel || '-'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium text-gray-500 uppercase">Fonte</dt>
                    <dd className="text-gray-900 break-words">{pca.fonte_recurso || '-'}</dd>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <dt className="text-[10px] font-medium text-gray-500 uppercase">Item / Grupo</dt>
                    <dd className="text-gray-900 break-words">{pca.item_pca}{pca.grupo_pca ? ` · ${pca.grupo_pca}` : ''}</dd>
                  </div>
                </dl>
              </div>
            ))
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Ordem</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Demandante</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Item/Grupo</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Descrição (Objeto)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Fonte</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Valor do Recurso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pcas.map((pca, indice) => (
                <tr key={pca.id} className={`hover:bg-gray-200/70 ${indice % 2 === 1 ? 'bg-gray-100' : 'bg-white'}`}>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">{pca.codigo_pca}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{pca.unidade_responsavel}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-medium text-gray-900">{pca.item_pca}</div>
                    <div className="text-xs text-gray-500">{pca.grupo_pca}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-700 max-w-lg min-w-xs">{pca.objeto_pca}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-500">{pca.fonte_recurso}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right font-medium">
                    {moeda(pca.valor_previsto)}
                  </td>
                </tr>
              ))}
              {pcas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum item do PCA integrado ainda. Em sincronização...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
