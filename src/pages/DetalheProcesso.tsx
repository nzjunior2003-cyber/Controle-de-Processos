import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, FileCheck2, MapPin, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { CHECKLISTS_RITOS } from '../types';
import { calcularTempoTotal, localizacaoEfetiva, montarLinhaDoTempo } from '../lib/fluxoProcesso';
import { ID_PLANILHA_PROCESSOS } from '../lib/csv';
import { getAccessToken, googleSignIn } from '../lib/googleAuth';
import { sincronizarProcessoNaPlanilha } from '../lib/sheetsService';
import { processoParaDadosPlanilha, SUBFASE_CONTRATADO_ADITIVADO } from '../lib/planilhaProcessos';

const CORES_GANTT = [
  'bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-emerald-400',
  'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-lime-400', 'bg-fuchsia-400',
];

export default function DetalheProcesso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { processos, setores, estadasProcesso, pcas, usuarioAtual, updateProcesso, deleteProcesso } = useApp();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [marcandoContratado, setMarcandoContratado] = useState(false);

  const processo = processos.find(p => p.id === id);
  if (!processo) {
    return <div className="p-6">Processo não encontrado.</div>;
  }

  const handleExcluir = async () => {
    setExcluindo(true);
    try {
      await deleteProcesso(processo.id);
      navigate('/sistema/aquisicoes');
    } catch (erro) {
      alert(erro instanceof Error ? erro.message : 'Não foi possível excluir o processo.');
      setExcluindo(false);
    }
  };

  const jaContratadoAditivado = (processo.subfase_processo ?? '').toUpperCase().includes('CONTRATADO');

  // Marca a Subfase do Processo (coluna Q da planilha) como
  // "CONTRATADO/ADITIVADO" — tanto no app quanto na planilha, na mesma
  // ação. Não tem "reverter": essa coluna também é escrita pelo RPA, e
  // não existe um valor anterior confiável pra restaurar por aqui — se
  // precisar desfazer, é direto na planilha (o app absorve na próxima
  // sincronização).
  const handleMarcarContratadoAditivado = async () => {
    setMarcandoContratado(true);
    try {
      await updateProcesso(processo.id, {
        subfase_processo: SUBFASE_CONTRATADO_ADITIVADO,
        status: 'concluido',
      });

      let googleToken = await getAccessToken();
      if (!googleToken) {
        const resultado = await googleSignIn();
        googleToken = resultado?.accessToken ?? null;
      }
      if (!googleToken) {
        alert(
          'Situação atualizada no sistema, mas não foi possível conectar ao Google para ' +
            'replicar na planilha automaticamente. Atualize a coluna Q manualmente ou tente de novo depois.',
        );
        return;
      }

      const linha = await sincronizarProcessoNaPlanilha(
        googleToken,
        ID_PLANILHA_PROCESSOS,
        { ...processoParaDadosPlanilha(processo), subfase_processo: SUBFASE_CONTRATADO_ADITIVADO },
        processo.planilha_linha,
      );
      if (linha !== processo.planilha_linha) {
        await updateProcesso(processo.id, { planilha_linha: linha });
      }
    } catch (erro) {
      alert(
        'Não foi possível atualizar a situação do processo: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setMarcandoContratado(false);
    }
  };

  const pcaVinculado = pcas.find(p => p.id === processo.pca_id);
  const localizacaoAtual = localizacaoEfetiva(processo, (setorId) => setores.find(s => s.id === setorId)?.sigla);

  const linhaDoTempo = montarLinhaDoTempo(
    estadasProcesso.filter(e => e.processo_id === processo.id),
  );
  const tempoTotalDias = calcularTempoTotal(estadasProcesso.filter(e => e.processo_id === processo.id));
  const diasNaLocalizacaoAtual = linhaDoTempo[linhaDoTempo.length - 1]?.dias;

  const checklistDisponivel = processo.rito_processual ? CHECKLISTS_RITOS[processo.rito_processual] : undefined;

  const isMasterOrApoio = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'apoio';

  const handleToggleChecklistItem = (item: string) => {
    const atual = processo.checklist_rito || [];
    const novo = atual.includes(item)
      ? atual.filter(i => i !== item)
      : [...atual, item];

    updateProcesso(processo.id, { checklist_rito: novo });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
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
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            processo.status === 'em_andamento' ? 'bg-blue-100 text-blue-800' :
            processo.status === 'concluido' ? 'bg-green-100 text-green-800' :
            processo.status === 'pendente' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {processo.status.replace('_', ' ').toUpperCase()}
          </span>
          {isMasterOrApoio && (
            <>
              {jaContratadoAditivado ? (
                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileCheck2 className="-ml-1 mr-1.5 h-4 w-4" />
                  Contratado/Aditivado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleMarcarContratadoAditivado}
                  disabled={marcandoContratado}
                  className="inline-flex items-center px-3 py-1.5 border border-emerald-200 shadow-sm text-sm font-medium rounded-md text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileCheck2 className="-ml-1 mr-1.5 h-4 w-4" />
                  {marcandoContratado ? 'Atualizando...' : 'Marcar como Contratado/Aditivado'}
                </button>
              )}
              <Link
                to={`/sistema/processos/${processo.id}/editar`}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Pencil className="-ml-1 mr-1.5 h-4 w-4" />
                Editar
              </Link>
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(true)}
                className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
              >
                <Trash2 className="-ml-1 mr-1.5 h-4 w-4" />
                Excluir
              </button>
            </>
          )}
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
                  <dt className="text-sm font-medium text-gray-500">Localização Atual</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-medium flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-gray-400 flex-shrink-0" />
                    {localizacaoAtual}
                  </dd>
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
                    <dd className="mt-0.5 text-xs text-gray-500">Tempo Total: <span className="font-semibold text-gray-900">{tempoTotalDias} dias</span></dd>
                  </div>
                )}
                {processo.ultima_tramitacao && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Última Tramitação</dt>
                    <dd className="mt-1 text-sm text-gray-900">{format(new Date(processo.ultima_tramitacao), 'dd/MM/yyyy')}</dd>
                    {diasNaLocalizacaoAtual !== undefined && (
                      <dd className="mt-0.5 text-xs text-gray-500">Dias na localização atual: <span className="font-semibold text-gray-900">{diasNaLocalizacaoAtual} dias</span></dd>
                    )}
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
            {linhaDoTempo.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sem histórico de localização registrado ainda.</p>
            ) : (
              <div className="space-y-4">
                <div className="w-full h-8 flex rounded-md overflow-hidden ring-1 ring-gray-200">
                  {(() => {
                    const totalDias = linhaDoTempo.reduce((acc, e) => acc + e.dias, 0) || 1;
                    return linhaDoTempo
                      .filter((e) => e.dias > 0)
                      .map((estada, idx) => (
                        <div
                          key={estada.id}
                          className={`${CORES_GANTT[idx % CORES_GANTT.length]} h-full group relative transition-all hover:brightness-110 flex items-center justify-center cursor-help`}
                          style={{ width: `${Math.max((estada.dias / totalDias) * 100, 5)}%` }}
                          title={`${estada.localizacao}: ${estada.dias} dias`}
                        >
                          <span className="text-[10px] font-bold text-white truncate px-1 drop-shadow-md">
                            {estada.localizacao}
                          </span>
                        </div>
                      ));
                  })()}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  {linhaDoTempo
                    .filter((e) => e.dias > 0)
                    .map((estada, idx) => (
                      <div key={estada.id} className="flex items-center text-xs">
                        <span className={`w-3 h-3 rounded-sm ${CORES_GANTT[idx % CORES_GANTT.length]} mr-1.5 flex-shrink-0 shadow-sm`}></span>
                        <span className="truncate text-gray-700" title={estada.localizacao}>
                          <span className="font-medium">{estada.localizacao}</span>
                          <span className="text-gray-500 ml-1">({estada.dias}d)</span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Real location history */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Histórico de Localizações</h2>
            {linhaDoTempo.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sem histórico de localização registrado ainda.</p>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {linhaDoTempo
                    .slice()
                    .reverse()
                    .map((estada, eventIdx, lista) => (
                      <li key={estada.id}>
                        <div className="relative pb-8">
                          {eventIdx !== lista.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                estada.data_fim === null ? 'bg-red-600' : 'bg-gray-100'
                              }`}>
                                <MapPin className={`h-4 w-4 ${estada.data_fim === null ? 'text-white' : 'text-gray-500'}`} aria-hidden="true" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className={`text-sm ${estada.data_fim === null ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                                  {estada.localizacao}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {estada.dias} dia{estada.dias === 1 ? '' : 's'}
                                  {estada.data_fim === null ? ' (atual)' : ''}
                                </p>
                              </div>
                              <div className="text-right text-xs whitespace-nowrap text-gray-500">
                                <time dateTime={estada.data_inicio}>{format(new Date(estada.data_inicio), 'dd/MM/yyyy')}</time>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir o processo {processo.numero_processo}? Esta ação não
              pode ser desfeita no sistema (a linha na planilha de controle não é removida
              automaticamente).
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmandoExclusao(false)}
                disabled={excluindo}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
