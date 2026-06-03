import React from 'react';
import { useApp } from '../context/AppContext';

export default function IntegracaoPCA() {
  const { pcas } = useApp();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Itens do PCA ({pcas.length} registros sincronizados)</h2>
        </div>
        <div className="overflow-x-auto">
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
              {pcas.map((pca) => (
                <tr key={pca.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 font-medium">{pca.codigo_pca}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-700">{pca.unidade_responsavel}</td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-medium text-gray-900">{pca.item_pca}</div>
                    <div className="text-xs text-gray-500">{pca.grupo_pca}</div>
                  </td>
                  <td className="px-4 py-2 text-gray-700 max-w-lg min-w-xs">{pca.objeto_pca}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-500">{pca.fonte_recurso}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-gray-900 text-right font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pca.valor_previsto)}
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
