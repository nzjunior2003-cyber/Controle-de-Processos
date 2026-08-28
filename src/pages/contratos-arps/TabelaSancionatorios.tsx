import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import type { ProcessoSancionatorio } from '../../types';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

interface Props {
  dados: ProcessoSancionatorio[];
  podeEditar: boolean;
  onEditar: (item: ProcessoSancionatorio) => void;
}

export default function TabelaSancionatorios({ dados, podeEditar, onEditar }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processo / Empresa</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fase</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abertura</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const isExpanded = expandido === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-orange-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setExpandido(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-gray-900 group-hover:text-orange-700 flex items-center gap-1">
                        {item.processo}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </span>
                      <span className="text-sm text-gray-500">{item.empresa}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 max-w-sm">
                    <div className="text-sm text-gray-900 line-clamp-2">{item.motivo}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      {item.fase}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatarData(item.dataAbertura)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-orange-50/10">
                    <td colSpan={4} className="px-6 py-4 border-b border-orange-100">
                      <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-orange-100 shadow-sm">
                        <div className="space-y-4 text-sm">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Motivo do Processo</span>
                            <div className="text-gray-700">{item.motivo}</div>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="font-medium text-gray-500 block">Empresa</span>
                              <span className="text-gray-900">{item.empresa}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">Processo</span>
                              <span className="text-gray-900">{item.processo}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">Fase Atual</span>
                              <span className="text-gray-900">{item.fase}</span>
                            </div>
                          </div>
                        </div>
                        {podeEditar && (
                          <button
                            onClick={() => onEditar(item)}
                            className="text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                          >
                            Editar Sancionatório
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {dados.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum registro encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
