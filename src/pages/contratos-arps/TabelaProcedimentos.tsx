import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import type { Contrato, ProcedimentoLicitatorio, Processo } from '../../types';
import { formatarMoeda } from '../../lib/contratos';
import { ehProcedimentoArp, saldoDaArp } from '../../lib/arp';

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
  /** Contratos, pra calcular quanto da ata já foi usado pelos contratos vinculados a ela. */
  contratos?: Contrato[];
  /** Processos, pra listar os que utilizaram a ata (rito Gerenciador) e abater o que cada um consumiu do saldo. */
  processos?: Processo[];
  /** Abre os aditivos (prorrogação) da ata — só para registros já gravados, não os automáticos. */
  onAditivos?: (item: ProcedimentoLicitatorio) => void;
}

export default function TabelaProcedimentos({
  dados,
  getPcaTitleByProcesso,
  podeEditar,
  onEditar,
  contratos = [],
  processos = [],
  onAditivos,
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
                            {item.orgaoGerenciador && (
                              <div>
                                <span className="font-medium text-gray-500 block">Órgão Gerenciador</span>
                                <span className="text-gray-900">{item.orgaoGerenciador}</span>
                              </div>
                            )}
                            {item.fornecedor && (
                              <div>
                                <span className="font-medium text-gray-500 block">Fornecedor</span>
                                <span className="text-gray-900">{item.fornecedor}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-stretch">
                          {podeEditar && (
                            <button
                              onClick={() => onEditar(item)}
                              className="text-white bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                            >
                              Editar Procedimento
                            </button>
                          )}
                          {podeEditar && onAditivos && ehProcedimentoArp(item) && !item.isAuto && (
                            <button
                              onClick={() => onAditivos(item)}
                              className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                            >
                              Aditivos
                            </button>
                          )}
                        </div>
                      </div>
                      {ehProcedimentoArp(item) && !item.isAuto && (() => {
                        const saldo = saldoDaArp(item, contratos, processos);
                        return (
                          <div className="mt-3 bg-white p-4 rounded-lg border border-red-100 shadow-sm text-sm">
                            <span className="font-semibold text-gray-900 block mb-2">Saldo da ata para compras futuras</span>
                            <div className="grid grid-cols-3 gap-4 mb-3">
                              <div><span className="block text-xs text-gray-500 uppercase">Registrado</span>{saldo.registrado > 0 ? formatarMoeda(saldo.registrado) : 'não informado'}</div>
                              <div><span className="block text-xs text-gray-500 uppercase">Utilizado (contratos e processos)</span>{formatarMoeda(saldo.utilizado)}</div>
                              <div>
                                <span className="block text-xs text-gray-500 uppercase">Saldo</span>
                                <strong className={saldo.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}>{saldo.registrado > 0 ? formatarMoeda(saldo.saldo) : '-'}</strong>
                              </div>
                            </div>
                            {saldo.itens.length > 0 && (
                              <div className="mb-3 overflow-x-auto">
                                <span className="font-semibold text-gray-900 block mb-1">Saldo por item (quantidade)</span>
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-gray-500 uppercase">
                                      <th className="py-1 pr-3 font-medium">Item</th>
                                      <th className="py-1 pr-3 font-medium">Registrada</th>
                                      <th className="py-1 pr-3 font-medium">Utilizada</th>
                                      <th className="py-1 font-medium">Saldo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {saldo.itens.map((it) => (
                                      <tr key={it.idx}>
                                        <td className="py-1 pr-3 text-gray-900">{it.descricao}</td>
                                        <td className="py-1 pr-3">{it.registrada}</td>
                                        <td className="py-1 pr-3">{it.utilizada}</td>
                                        <td className={`py-1 font-semibold ${it.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{it.saldo}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <span className="font-semibold text-gray-900 block mb-1">Processos que utilizaram esta ata</span>
                            {saldo.processos.length > 0 ? (
                              <ul className="text-xs text-gray-700 space-y-1.5 mb-3">
                                {saldo.processos.map((c) => (
                                  <li key={c.processoId} className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
                                    <Link to={`/sistema/processos/${c.processoId}`} className="font-medium text-red-700 hover:underline">PAE {c.pae}</Link>
                                    {' — '}{c.objeto}: <strong>{formatarMoeda(c.valor)}</strong>
                                    {c.itens.length > 0 && <span className="text-gray-500"> ({c.itens.map((i) => `${i.quantidade}× ${i.descricao}`).join(', ')})</span>}
                                    <div className="mt-0.5">
                                      {c.contrato ? (
                                        <>
                                          Contrato {c.contrato.numero} — {c.contrato.empresa}: {formatarMoeda(c.contrato.valorGlobal)}
                                          {!c.contrato.vinculadoAAta && <span className="ml-1 text-amber-700">(contrato ainda não ligado a esta ata)</span>}
                                          {c.divergencia !== undefined && (
                                            <span className="ml-1 font-medium text-amber-700">
                                              — valor diferente do processo ({c.divergencia > 0 ? '+' : '-'}{formatarMoeda(Math.abs(c.divergencia))})
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="text-gray-500">Contrato ainda não cadastrado.</span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-500 mb-3">Nenhum processo utilizou esta ata ainda (escolha a ata no cadastro do processo de rito Gerenciador).</p>
                            )}
                            {(() => {
                              const contratosDosProcessos = new Set(saldo.processos.map((c) => c.contrato?.id));
                              const outros = saldo.contratos.filter((c) => !contratosDosProcessos.has(c.id));
                              return outros.length > 0 ? (
                                <ul className="text-xs text-gray-600 space-y-0.5">
                                  {outros.map((c) => (
                                    <li key={c.id}>Contrato {c.numero} — {c.empresa}: {formatarMoeda(c.valorGlobal || 0)}</li>
                                  ))}
                                </ul>
                              ) : saldo.processos.length === 0 ? (
                                <p className="text-xs text-gray-500">Nenhum contrato vinculado a esta ata ainda (vincule no cadastro do contrato).</p>
                              ) : null;
                            })()}
                            {saldo.registrado === 0 && (
                              <p className="text-xs text-amber-700 mt-2">Informe o valor homologado no procedimento para calcular o saldo.</p>
                            )}
                          </div>
                        );
                      })()}
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
