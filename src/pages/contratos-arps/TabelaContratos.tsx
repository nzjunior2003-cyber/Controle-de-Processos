import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import type { Contrato } from '../../types';
import { formatarMoeda } from '../../lib/contratos';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

export default function TabelaContratos({ dados }: { dados: Contrato[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PAE / Contrato</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa / Objeto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vigência</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Global</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acesso ao Contrato</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const isExpanded = expandido === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-emerald-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setExpandido(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-emerald-700 group-hover:text-emerald-900 flex items-center gap-1">
                        Nº {item.numero}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">PAE: {item.pae}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-medium text-gray-900 truncate" title={item.empresa}>{item.empresa}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{formatarData(item.inicioVigencia)} a</div>
                    <div>{formatarData(item.fimVigencia)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {formatarMoeda(item.valorGlobal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                    <button
                      onClick={() => item.linkContrato && window.open(item.linkContrato, '_blank')}
                      disabled={!item.linkContrato}
                      className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Acessar Contrato
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-emerald-50/10">
                    <td colSpan={5} className="px-6 py-4 border-b border-emerald-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Fornecedor / CNPJ</span>
                            <div className="text-gray-700">{item.empresa}</div>
                            <div className="text-gray-500 text-xs">{item.cnpj}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Contatos Fornecedor</span>
                            <div className="text-gray-700">{item.contatoEmail}</div>
                            <div className="text-gray-700">{item.contatoTelefone ?? item.contatosFornecedor}</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Fiscalização</span>
                            <div className="text-gray-700 block mb-2">
                              Titular: <span className="font-medium">{item.fiscalTitular}</span>
                              <br />
                              <span className="text-xs text-gray-500">{item.fiscalTitularContato ?? item.fiscalEmail}</span>
                            </div>
                            <div className="text-gray-700">
                              Suplente: <span className="font-medium">{item.fiscalSuplente}</span>
                              <br />
                              <span className="text-xs text-gray-500">{item.fiscalSuplenteContato ?? item.fiscalSuplenteEmail}</span>
                            </div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Dados Orçamentários</span>
                            <div className="text-gray-700">Fonte: {item.fonteRecurso}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {dados.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum contrato encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
