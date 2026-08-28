import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import type { PortariaFiscal } from '../../types';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

interface Props {
  dados: PortariaFiscal[];
  podeEditar: boolean;
  onEditar: (item: PortariaFiscal) => void;
}

export default function TabelaPortarias({ dados, podeEditar, onEditar }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Portaria</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato / Empresa</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiscal Titular</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publicação</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const isExpanded = expandido === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setExpandido(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 group-hover:bg-slate-200 transition-colors">
                        Portaria {item.portaria}
                        {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">Contrato {item.contrato}</div>
                    <div className="text-sm text-gray-500">{item.empresa}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="text-sm font-medium text-gray-900">{item.fiscalTitular}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.fiscalEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatarData(item.dataPublicacao)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50">
                    <td colSpan={4} className="px-6 py-4 border-b border-slate-200">
                      <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                        <div className="space-y-4 text-sm">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Detalhes da Portaria</span>
                            <div className="text-gray-700">
                              Portaria {item.portaria} publicada em {formatarData(item.dataPublicacao)} para o Contrato {item.contrato} ({item.empresa}).
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="font-medium text-gray-500 block">Fiscal Titular</span>
                              <span className="text-gray-900">{item.fiscalTitular}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">E-mail</span>
                              <span className="text-gray-900">{item.fiscalEmail}</span>
                            </div>
                          </div>
                        </div>
                        {podeEditar && (
                          <button
                            onClick={() => onEditar(item)}
                            className="text-white bg-slate-600 hover:bg-slate-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                          >
                            Editar Portaria
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
