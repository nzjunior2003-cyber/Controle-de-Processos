import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FilePlus2, FileSignature, Pencil, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import type { Contrato, ProcedimentoLicitatorio } from '../../types';
import { formatarMoeda } from '../../lib/contratos';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

export default function TabelaContratos({
  dados,
  onEditar,
  onAditivos,
  onApostilamento,
  onFiscais,
  procedimentos = [],
}: {
  dados: Contrato[];
  onEditar?: (contrato: Contrato) => void;
  onAditivos?: (contrato: Contrato) => void;
  onApostilamento?: (contrato: Contrato) => void;
  onFiscais?: (contrato: Contrato) => void;
  /** Pra mostrar a ata de origem (ARP/adesão/partícipe) de cada contrato. */
  procedimentos?: ProcedimentoLicitatorio[];
}) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PAE / Contrato</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornecedor / Objeto</th>
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
                    <div className="text-xs text-gray-500">{item.cnpj}</div>
                    <div className="text-xs text-gray-500">{item.contatoEmail}</div>
                    <div className="text-xs text-gray-500">{item.contatoTelefone ?? item.contatosFornecedor}</div>
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
                    <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => {
                        const link = item.contratoPdfLink || item.linkContrato;
                        if (link) window.open(link, '_blank');
                      }}
                      disabled={!item.contratoPdfLink && !item.linkContrato}
                      className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Acessar Contrato
                    </button>
                    {onEditar && (
                      <button
                        onClick={() => onEditar(item)}
                        className="inline-flex items-center text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Editar Contrato
                      </button>
                    )}
                    {onAditivos && (
                      <button
                        onClick={() => onAditivos(item)}
                        className="inline-flex items-center text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors"
                      >
                        <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />
                        Aditivos
                      </button>
                    )}
                    {onFiscais && (
                      <button
                        onClick={() => onFiscais(item)}
                        className="inline-flex items-center text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors"
                      >
                        <UserCog className="w-3.5 h-3.5 mr-1.5" />
                        Alterar Fiscais
                      </button>
                    )}
                    {onApostilamento && (
                      <button
                        onClick={() => onApostilamento(item)}
                        className="inline-flex items-center text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors"
                      >
                        <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                        Apostilamento
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-emerald-50/10">
                    <td colSpan={5} className="px-6 py-4 border-b border-emerald-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
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
                          {(() => {
                            const ata = item.arpId ? procedimentos.find((p) => p.id === item.arpId) : undefined;
                            return ata ? (
                              <div className="text-gray-700 mt-2">
                                Originado da ata: <span className="font-medium">{ata.modalidade} {ata.numero}</span> (PAE {ata.pae})
                              </div>
                            ) : null;
                          })()}
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
