import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, PlusCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import {
  formatarMoeda,
  type ContratoComStatus,
  type ExecucaoContrato,
  type NotificacaoContrato,
} from '../../lib/contratos';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

interface Props {
  dados: ContratoComStatus[];
  execucoes: ExecucaoContrato[];
  notificacoes: NotificacaoContrato[];
  podeGerenciar: boolean;
  onGerenciar: (contrato: ContratoComStatus) => void;
  getPcaTitleByProcesso: (numeroProcesso: string) => string | null;
}

/**
 * Tabela de contratos com vigência, execução e detalhe expandido.
 * Compartilhada por Gestão de Contratos e Fiscal do Contrato (antes o mesmo
 * bloco existia duplicado nas duas páginas).
 */
export default function TabelaContratosVigencia({
  dados,
  execucoes,
  notificacoes,
  podeGerenciar,
  onGerenciar,
  getPcaTitleByProcesso,
}: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PAE / Contrato</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa / Objeto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vigência</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Global</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Situação</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const pcaIdCode = getPcaTitleByProcesso(item.pae);
            const execucoesDoContrato = execucoes.filter((e) => e.contratoId === item.id);
            const valorExecutado = execucoesDoContrato.reduce((acc, atual) => acc + atual.valor, 0);
            const percExec = item.valorGlobal
              ? ((valorExecutado / item.valorGlobal) * 100).toFixed(1)
              : '0.0';
            const notificacoesDoContrato = notificacoes.filter((n) => n.contratoId === item.id);
            const isExpanded = expandido === item.id;

            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => setExpandido(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 flex items-center gap-1">
                        Nº {item.numero}
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
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-medium text-gray-900 truncate" title={item.empresa}>{item.empresa}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatarData(item.fimVigencia)}</div>
                    <div className={`text-xs font-medium mt-1 ${item.diasRestantes < 0 ? 'text-red-600' : item.diasRestantes <= 90 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {item.diasRestantes < 0
                        ? `Vencido há ${Math.abs(item.diasRestantes)} dias`
                        : `Faltam ${item.diasRestantes} dias`}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">{formatarMoeda(item.valorGlobal)}</div>
                    <div className="text-xs text-gray-500 mt-1">Executado: {percExec}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${item.cor}`}>
                      {item.badge}
                    </span>
                  </td>
                </tr>

                {isExpanded && (
                  <tr className="bg-blue-50/10">
                    <td colSpan={5} className="px-6 py-4 border-b border-blue-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 flex items-center justify-between mb-1">Ações</span>
                            <button
                              onClick={() => item.linkContrato && window.open(item.linkContrato, '_blank')}
                              disabled={!item.linkContrato}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed mb-2"
                            >
                              <FileText className="w-4 h-4 mr-1.5" />
                              Visualizar Contrato
                            </button>
                            {podeGerenciar && (
                              <button
                                onClick={() => onGerenciar(item)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                              >
                                <PlusCircle className="w-4 h-4 mr-1.5" />
                                Gerenciar Execução / Notificações
                              </button>
                            )}
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Contatos Fornecedor</span>
                            <div className="text-gray-700 text-xs">{item.contatosFornecedor}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Fiscalização</span>
                            <div className="text-gray-700 block mb-2">
                              Titular: <span className="font-medium">{item.fiscalTitular}</span>
                              <br />
                              <span className="text-xs text-gray-500">{item.fiscalEmail}</span>
                            </div>
                            <div className="text-gray-700">
                              Suplente: <span className="font-medium">{item.fiscalSuplente}</span>
                              <br />
                              <span className="text-xs text-gray-500">{item.fiscalSuplenteEmail}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Dados Orçamentários</span>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="font-medium text-gray-500">Fonte:</span> {item.fonteRecurso}</div>
                              <div><span className="font-medium text-gray-500">PRD:</span> {item.prd}</div>
                              <div><span className="font-medium text-gray-500">Empenho:</span> {item.empenho}</div>
                              <div><span className="font-medium text-gray-500">Dotação:</span> {item.dotacao}</div>
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-gray-900">Saldo Atual</span>
                              <span className="text-emerald-600 font-bold">
                                {formatarMoeda(item.valorGlobal - valorExecutado)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full mt-2 mb-1 overflow-hidden pointer-events-none">
                              <div
                                className={`h-full ${Number(percExec) > 90 ? 'bg-red-500' : Number(percExec) > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, Number(percExec))}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-500 text-right">Executado: {percExec}%</div>
                          </div>
                        </div>

                        <div className="space-y-2 lg:col-span-1 md:col-span-2">
                          <span className="font-semibold text-gray-900 block mb-1">Linha do Tempo (Últimos Eventos)</span>
                          <div className="relative pl-4 border-l-2 border-gray-200 space-y-4 mt-2">
                            {notificacoesDoContrato.length > 0 || execucoesDoContrato.length > 0 ? (
                              <>
                                {execucoesDoContrato.slice(0, 2).map((exec) => (
                                  <div key={exec.id} className="relative">
                                    <div className="absolute -left-[21px] bg-blue-500 h-2 w-2 rounded-full border-2 border-white"></div>
                                    <div className="text-xs font-medium text-gray-900">
                                      Inclusão de {exec.tipo || 'NF/Fatura'}: {exec.nf}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {formatarData(exec.data)} - {formatarMoeda(exec.valor)}{' '}
                                      {exec.quantidade ? `(Qtd: ${exec.quantidade})` : ''}
                                    </div>
                                  </div>
                                ))}
                                {notificacoesDoContrato.slice(0, 2).map((noti) => (
                                  <div key={`not-${noti.id}`} className="relative">
                                    <div className="absolute -left-[21px] bg-amber-500 h-2 w-2 rounded-full border-2 border-white"></div>
                                    <div className="text-xs font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                                      Ocorrência
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                      {noti.texto} ({formatarData(noti.data)})
                                    </div>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p className="text-xs text-gray-500 mt-2">Nenhum evento recente.</p>
                            )}
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
              <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                Nenhum contrato encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
