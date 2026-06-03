import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, CheckCircle, Clock, FileText, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CHECKLISTS_RITOS } from '../types';

export default function DetalheProcesso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { processos, setores, movimentacoes, pcas, usuarioAtual, updateProcessoStatus, updateProcesso, addMovimentacao } = useApp();
  
  const [observacao, setObservacao] = useState('');

  const processo = processos.find(p => p.id === id);
  if (!processo) {
    return <div className="p-6">Processo não encontrado.</div>;
  }

  const pcaVinculado = pcas.find(p => p.id === processo.pca_id);
  const historico = movimentacoes.filter(m => m.processo_id === processo.id).sort((a, b) => new Date(a.data_movimentacao).getTime() - new Date(b.data_movimentacao).getTime());
  const setorAtual = setores.find(s => s.id === processo.fase_atual_id);

  const checklistDisponivel = processo.rito_processual ? CHECKLISTS_RITOS[processo.rito_processual] : undefined;
  
  const handleToggleChecklistItem = (item: string) => {
    const atual = processo.checklist_rito || [];
    const novo = atual.includes(item) 
      ? atual.filter(i => i !== item)
      : [...atual, item];
      
    updateProcesso(processo.id, { checklist_rito: novo });
  };
 

  const handleAprovarEncaminhar = () => {
    if (!setorAtual) return;
    
    // Find next sector based on ordem_fluxo
    const currentOrder = setorAtual.ordem_fluxo;
    const nextSector = setores.find(s => s.ordem_fluxo === currentOrder + 1);

    if (nextSector) {
      addMovimentacao({
        processo_id: processo.id,
        setor_id: setorAtual.id,
        usuario_id: usuarioAtual?.id || 'u1',
        status_movimentacao: 'aprovado',
        observacao: observacao || 'Aprovado e encaminhado',
      });
      updateProcessoStatus(processo.id, 'em_andamento', nextSector.id);
    } else {
      // Last sector, conclude
      addMovimentacao({
        processo_id: processo.id,
        setor_id: setorAtual.id,
        usuario_id: usuarioAtual?.id || 'u1',
        status_movimentacao: 'concluido',
        observacao: observacao || 'Processo concluído',
      });
      updateProcessoStatus(processo.id, 'concluido');
    }
    setObservacao('');
  };

  const handleDevolver = () => {
    if (!setorAtual || !observacao) {
      alert("A observação é obrigatória para devolver um processo.");
      return;
    }

    addMovimentacao({
      processo_id: processo.id,
      setor_id: setorAtual.id,
      usuario_id: usuarioAtual?.id || 'u1',
      status_movimentacao: 'devolvido',
      observacao,
    });
    // Voltar para o setor 1 (Demandante)
    updateProcessoStatus(processo.id, 'pendente', '1');
    setObservacao('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Processo {processo.numero_processo}</h1>
            <div className="flex items-center mt-1 space-x-4 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                Criado em {format(new Date(processo.data_abertura), 'dd/MM/yyyy')}
              </span>
              {pcaVinculado && (
                <span className="flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  PCA Vinculado: {pcaVinculado.codigo_pca}
                </span>
              )}
            </div>
          </div>
        </div>
        <div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            processo.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
            processo.status === 'concluido' ? 'bg-green-100 text-green-800' :
            processo.status === 'pendente' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {processo.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Actions */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Informações do Processo</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Objeto</dt>
                  <dd className="mt-1 text-base text-gray-900">{processo.objeto}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Descrição/Justificativa</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{processo.descricao || 'Sem descrição detalhada.'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Unidade Demandante</dt>
                  <dd className="mt-1 text-sm text-gray-900">{processo.unidade_demandante}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Fase Atual / Setor</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-medium">{setorAtual?.nome} ({setorAtual?.sigla})</dd>
                </div>
                {processo.rito_processual && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Rito Processual</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.rito_processual}</dd>
                  </div>
                )}
                {processo.fase_processo && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fase do Processo</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.fase_processo}</dd>
                  </div>
                )}
                {processo.subfase_processo && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Subfase do Processo</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.subfase_processo}</dd>
                  </div>
                )}
                {processo.andamento && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Andamento</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.andamento}</dd>
                  </div>
                )}
                {processo.data_entrada && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Data de Cadastro</dt>
                    <dd className="mt-1 text-sm text-gray-900">{format(new Date(processo.data_entrada), 'dd/MM/yyyy')}</dd>
                    <dd className="mt-0.5 text-xs text-gray-500">Tempo Total: <span className="font-semibold text-gray-900">{Math.max(0, differenceInDays(new Date(), new Date(processo.data_entrada)))} dias</span></dd>
                  </div>
                )}
                {processo.ultima_tramitacao && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Última Tramitação</dt>
                    <dd className="mt-1 text-sm text-gray-900">{format(new Date(processo.ultima_tramitacao), 'dd/MM/yyyy')}</dd>
                    <dd className="mt-0.5 text-xs text-gray-500">Dias no setor atual: <span className="font-semibold text-gray-900">{Math.max(0, differenceInDays(new Date(), new Date(processo.ultima_tramitacao)))} dias</span></dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

          {checklistDisponivel && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Checklist do Rito: {processo.rito_processual}</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {Math.round(((processo.checklist_rito?.length || 0) / checklistDisponivel.length) * 100)}% Concluído
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                  <div className="bg-red-600 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.round(((processo.checklist_rito?.length || 0) / checklistDisponivel.length) * 100)}%` }}></div>
                </div>

                <div className="space-y-3">
                  {checklistDisponivel.map((item, idx) => {
                    const isChecked = (processo.checklist_rito || []).includes(item);
                    return (
                      <div key={idx} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id={`check-${idx}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleChecklistItem(item)}
                            className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor={`check-${idx}`} className={`font-medium cursor-pointer ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {item}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Gráfico de Tarefas (Gantt)</h2>
            <div className="space-y-4">
              <div className="w-full h-8 flex rounded-md overflow-hidden ring-1 ring-gray-200">
                {(() => {
                  let dataInicio = new Date(processo.data_entrada || processo.data_abertura);
                  const timelineData = historico.map((mov, idx) => {
                    const s = setores.find(st => st.id === mov.setor_id);
                    const dataFim = new Date(mov.data_movimentacao);
                    const dias = Math.max(0, differenceInDays(dataFim, dataInicio));
                    const periodo = {
                      id: mov.id,
                      setor: s?.sigla || 'Setor Anterior',
                      setorNome: s?.nome || 'Setor Anterior',
                      dias: dias,
                      inicio: new Date(dataInicio),
                      fim: dataFim
                    };
                    dataInicio = dataFim;
                    return periodo;
                  });

                  if (processo.status !== 'concluido' && processo.status !== 'arquivado') {
                    const s = setores.find(st => st.id === processo.fase_atual_id);
                    timelineData.push({
                      id: 'atual',
                      setor: s?.sigla || 'Atual',
                      setorNome: s?.nome || 'Atual',
                      dias: Math.max(0, differenceInDays(new Date(), dataInicio)),
                      inicio: new Date(dataInicio),
                      fim: new Date()
                    });
                  }

                  const totalDias = timelineData.reduce((acc, curr) => acc + curr.dias, 0) || 1;
                  const colors = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-lime-400', 'bg-fuchsia-400'];

                  return (
                    <>
                      {timelineData.map((item, idx) => {
                        const widthPercent = (item.dias / totalDias) * 100;
                        const bgColor = colors[idx % colors.length];
                        return (
                          <div 
                            key={item.id} 
                            className={`${bgColor} h-full group relative transition-all hover:brightness-110 flex items-center justify-center cursor-help`}
                            style={{ width: `${Math.max(widthPercent, 5)}%`, opacity: item.dias === 0 ? 0 : 1, display: item.dias === 0 ? 'none' : 'flex' }}
                            title={`${item.setorNome}: ${item.dias} dias`}
                          >
                            <span className="text-[10px] font-bold text-white truncate px-1 drop-shadow-md">
                              {item.setor} 
                            </span>
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {(() => {
                  let dataInicio = new Date(processo.data_entrada || processo.data_abertura);
                  const timelineData = historico.map((mov, idx) => {
                    const s = setores.find(st => st.id === mov.setor_id);
                    const dataFim = new Date(mov.data_movimentacao);
                    const dias = Math.max(0, differenceInDays(dataFim, dataInicio));
                    const periodo = {
                      id: mov.id,
                      setor: s?.sigla || 'Setor Anterior',
                      setorNome: s?.nome || 'Setor Anterior',
                      dias: dias
                    };
                    dataInicio = dataFim;
                    return periodo;
                  });

                  if (processo.status !== 'concluido' && processo.status !== 'arquivado') {
                    const s = setores.find(st => st.id === processo.fase_atual_id);
                    timelineData.push({
                      id: 'atual',
                      setor: s?.sigla || 'Atual',
                      setorNome: s?.nome || 'Atual',
                      dias: Math.max(0, differenceInDays(new Date(), dataInicio))
                    });
                  }

                  const colors = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-lime-400', 'bg-fuchsia-400'];

                  return timelineData.filter(i => i.dias > 0).map((item, idx) => {
                    const bgColor = colors[idx % colors.length];
                    return (
                      <div key={item.id} className="flex items-center text-xs">
                        <span className={`w-3 h-3 rounded-sm ${bgColor} mr-1.5 flex-shrink-0 shadow-sm`}></span>
                        <span className="truncate text-gray-700" title={item.setorNome}>
                          <span className="font-medium">{item.setor}</span> 
                          <span className="text-gray-500 ml-1">({item.dias}d)</span>
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Ações (Only visible if the process is active and user is (conceptually) in the sector) */}
          {processo.status !== 'concluido' && processo.status !== 'arquivado' && (
            <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
              <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                <h3 className="text-base font-medium text-red-800">Ações - Setor: {setorAtual?.sigla}</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="observacao" className="block text-sm font-medium text-gray-700">Parecer ou Observação</label>
                  <textarea
                    id="observacao"
                    rows={3}
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                    placeholder="Adicione um parecer, justificativa ou despacho..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={handleDevolver}
                    className="inline-flex items-center px-4 py-2 border border-amber-300 shadow-sm text-sm font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  >
                    <AlertTriangle className="-ml-1 mr-2 h-4 w-4" />
                    Devolver (Pendência)
                  </button>
                  <button
                    onClick={handleAprovarEncaminhar}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Send className="-ml-1 mr-2 h-4 w-4" />
                    Aprovar e Encaminhar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Timeline & Flow */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Fluxo do Processo</h2>
            <div className="flow-root">
              <ul className="-mb-8">
                {setores.sort((a,b) => a.ordem_fluxo - b.ordem_fluxo).map((s, sIdx) => {
                  const isCurrent = processo.fase_atual_id === s.id && processo.status !== 'concluido';
                  const isPast = processo.status === 'concluido' || (setores.find(st => st.id === processo.fase_atual_id)?.ordem_fluxo || 0) > s.ordem_fluxo;
                  
                  return (
                    <li key={s.id}>
                      <div className="relative pb-8">
                        {sIdx !== setores.length - 1 ? (
                          <span className={`${isPast ? 'bg-red-600' : 'bg-gray-200'} absolute top-4 left-4 -ml-px h-full w-0.5`} aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              isCurrent ? 'bg-red-600' : isPast ? 'bg-red-600' : 'bg-gray-200'
                            }`}>
                              {isCurrent ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-white" />
                              ) : isPast ? (
                                <CheckCircle className="h-5 w-5 text-white" aria-hidden="true" />
                              ) : (
                                <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                              )}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className={`text-sm ${isCurrent ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>
                                {s.sigla}
                              </p>
                              <p className="text-xs text-gray-500 line-clamp-1">{s.nome}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Histórico de Movimentações</h2>
            <div className="flow-root">
              <ul className="-mb-8">
                {historico.map((mov, eventIdx) => {
                  const s = setores.find(st => st.id === mov.setor_id);
                  return (
                    <li key={mov.id}>
                      <div className="relative pb-8">
                        {eventIdx !== historico.length - 1 ? (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              mov.status_movimentacao === 'devolvido' ? 'bg-amber-400' : 'bg-gray-100'
                            }`}>
                              <FileText className={`h-4 w-4 ${mov.status_movimentacao === 'devolvido' ? 'text-white' : 'text-gray-500'}`} aria-hidden="true" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">
                                Movimentado em <span className="font-medium text-gray-900">{s?.sigla}</span>
                              </p>
                              {mov.observacao && (
                                <p className="mt-1 text-sm bg-gray-50 p-2 rounded-md text-gray-700 italic border border-gray-100">"{mov.observacao}"</p>
                              )}
                            </div>
                            <div className="text-right text-xs whitespace-nowrap text-gray-500">
                              <time dateTime={mov.data_movimentacao}>{format(new Date(mov.data_movimentacao), "dd/MM 'às' HH:mm")}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
