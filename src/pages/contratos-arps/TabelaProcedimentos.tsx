import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import type { ProcedimentoLicitatorio } from '../../types';

const formatarData = (valor?: string) => {
  if (!valor || valor === '-') return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

interface Props {
  dados: ProcedimentoLicitatorio[];
  /** Código do PCA vinculado ao processo (PAE), quando houver. */
  getPcaTitleByProcesso: (numeroProcesso: string) => string | null;
  podeEditar: boolean;
  onEditar: (item: ProcedimentoLicitatorio) => void;
}

export default function TabelaProcedimentos({
  dados,
  getPcaTitleByProcesso,
  podeEditar,
  onEditar,
}: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processo / Modalidade</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objeto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fase Atual</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cronograma</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const pcaIdCode = getPcaTitleByProcesso(item.pae);
            const isExpanded = expandido === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-red-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setExpandido(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 flex items-center gap-1">
                        {item.modalidade} {item.numero}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">PAE: {item.pae}</span>
                    </button>
                    {pcaIdCode && (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        PCA: {pcaIdCode}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-sm">
                    <div className="text-sm text-gray-900 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.fase}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div><span className="font-medium">Publicação:</span> {formatarData(item.dataPublicacao)}</div>
                    <div className="mt-1"><span className="font-medium">Abertura:</span> {formatarData(item.previsaoAbertura)}</div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-red-50/10">
                    <td colSpan={4} className="px-6 py-4 border-b border-red-100">
                      <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Detalhes do Procedimento</span>
                            <div className="text-sm text-gray-700">{item.objeto}</div>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500 block">Modalidade</span>
                              <span className="text-gray-900">{item.modalidade}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">Número</span>
                              <span className="text-gray-900">{item.numero}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">PAE</span>
                              <span className="text-gray-900">{item.pae}</span>
                            </div>
                          </div>
                        </div>
                        {podeEditar && (
                          <button
                            onClick={() => onEditar(item)}
                            className="text-white bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                          >
                            Editar Procedimento
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
