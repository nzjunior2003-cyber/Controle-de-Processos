import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, FileCheck2, MapPin, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { STATUS_PROCESSO_LABELS } from '../types';
import { useEtapasPorRito } from '../hooks/useEtapasPorRito';
import {
  agruparLinhaDoTempoPorSetor,
  calcularProgressoChecklist,
  localizacaoEfetiva,
  montarLinhaDoTempo,
} from '../lib/fluxoProcesso';
import { ID_PLANILHA_PROCESSOS } from '../lib/csv';
import { getAccessToken, googleSignIn } from '../lib/googleAuth';
import { sincronizarProcessoNaPlanilha } from '../lib/sheetsService';
import { processoParaDadosPlanilha, SUBFASE_CONTRATADO } from '../lib/planilhaProcessos';
import { calcularEconomicidade, encontrarVinculosPorPae, formatarMoeda } from '../lib/contratos';
import { calcularDataPrevista, prazoAlvoDoRito } from '../lib/prazosProcesso';

const CORES_GANTT = [
  'bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-emerald-400',
  'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-lime-400', 'bg-fuchsia-400',
];

export default function DetalheProcesso() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { processos, setores, estadasProcesso, pcas, contratos, procedimentos, usuarioAtual, updateProcesso, deleteProcesso } = useApp();
  const etapasPorRito = useEtapasPorRito();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [marcandoContratado, setMarcandoContratado] = useState(false);
  const [modoGantt, setModoGantt] = useState<'real' | 'planejado' | 'sobreposto'>('sobreposto');

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

  // Sincroniza um valor de subfase com a planilha de controle (coluna Q) —
  // compartilhado entre marcar e desmarcar Contratado/Aditivado.
  const sincronizarSubfaseNaPlanilha = async (subfase: string) => {
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
      { ...processoParaDadosPlanilha(processo), subfase_processo: subfase },
      processo.planilha_linha,
    );
    if (linha !== processo.planilha_linha) {
      await updateProcesso(processo.id, { planilha_linha: linha });
    }
  };

  // Marca a Subfase do Processo (coluna Q da planilha) com o valor
  // "CONTRATADO" — a mesma opção já existente no menu suspenso da
  // planilha — e o status "Contratado/Aditivado" no app, na mesma ação.
  // Representa o fim da fase de Instrução (que vai da abertura até a
  // publicação do contrato) e a passagem pra fase de Gestão do
  // Contrato. Guarda o status/fase/subfase anteriores antes de
  // sobrescrever, pra permitir desmarcar restaurando exatamente esse
  // estado (ver handleDesmarcarContratadoAditivado).
  const handleMarcarContratadoAditivado = async () => {
    setMarcandoContratado(true);
    try {
      await updateProcesso(processo.id, {
        statusAnterior: processo.status,
        faseAnterior: processo.fase_processo ?? '',
        subfaseAnterior: processo.subfase_processo ?? '',
        subfase_processo: SUBFASE_CONTRATADO,
        status: 'contratado_aditivado',
      });
      await sincronizarSubfaseNaPlanilha(SUBFASE_CONTRATADO);
    } catch (erro) {
      alert(
        'Não foi possível atualizar a situação do processo: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setMarcandoContratado(false);
    }
  };

  // Restaura o status/fase/subfase que o processo tinha antes de ser
  // marcado como Contratado/Aditivado (guardados em *Anterior no momento em
  // que foi marcado) — para o caso de ter sido marcado por engano ou o
  // processo voltar de fase.
  const handleDesmarcarContratadoAditivado = async () => {
    setMarcandoContratado(true);
    try {
      // Não precisa limpar statusAnterior/faseAnterior/subfaseAnterior aqui:
      // o botão "Desmarcar" só aparece enquanto subfase_processo contém
      // "CONTRATADO" (jaContratadoAditivado), e esses três campos são
      // sempre regravados do zero da próxima vez que o processo for
      // marcado de novo.
      const subfaseRestaurada = processo.subfaseAnterior ?? '';
      await updateProcesso(processo.id, {
        status: processo.statusAnterior ?? 'em_andamento',
        fase_processo: processo.faseAnterior ?? '',
        subfase_processo: subfaseRestaurada,
      });
      await sincronizarSubfaseNaPlanilha(subfaseRestaurada);
    } catch (erro) {
      alert(
        'Não foi possível reverter a situação do processo: ' +
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
  // Tempo Total = dias entre a Data de Cadastro e a conclusão/contratação
  // (ou hoje, se ainda estiver em andamento) — não o somatório das estadas.
  const tempoTotalDias = processo.data_entrada
    ? Math.max(
        0,
        differenceInDays(
          processo.data_conclusao ? new Date(processo.data_conclusao) : new Date(),
          new Date(processo.data_entrada),
        ),
      )
    : undefined;
  const diasNaLocalizacaoAtual = linhaDoTempo[linhaDoTempo.length - 1]?.dias;

  const checklistDisponivel = processo.rito_processual ? etapasPorRito[processo.rito_processual] : undefined;
  const progressoChecklist = calcularProgressoChecklist(processo, etapasPorRito) ?? 0;

  const { contrato: contratoVinculado, procedimento: procedimentoVinculado } = encontrarVinculosPorPae(
    processo.numero_processo,
    { contratos, procedimentos },
  );
  const economicidade = contratoVinculado
    ? calcularEconomicidade(processo.valor_estimado, contratoVinculado.valorGlobal)
    : null;

  const dataPrevistaEfetivacao =
    processo.status === 'contratado_aditivado' || processo.status === 'concluido'
      ? null
      : calcularDataPrevista(processo.data_entrada, processo.rito_processual);

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
            processo.status === 'contratado_aditivado' ? 'bg-purple-100 text-purple-800' :
            processo.status === 'concluido' ? 'bg-green-100 text-green-800' :
            processo.status === 'pendente' ? 'bg-amber-100 text-amber-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {STATUS_PROCESSO_LABELS[processo.status].toUpperCase()}
          </span>
          {isMasterOrApoio && (
            <>
              {jaContratadoAditivado ? (
                <>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <FileCheck2 className="-ml-1 mr-1.5 h-4 w-4" />
                    Contratado/Aditivado
                  </span>
                  <button
                    type="button"
                    onClick={handleDesmarcarContratadoAditivado}
                    disabled={marcandoContratado}
                    title="Reverte pra situação anterior a marcar como Contratado/Aditivado"
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="-ml-1 mr-1.5 h-4 w-4" />
                    {marcandoContratado ? 'Atualizando...' : 'Desmarcar'}
                  </button>
                </>
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
                {processo.valor_estimado != null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Valor Estimado</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatarMoeda(processo.valor_estimado)}</dd>
                  </div>
                )}
                {processo.fonte && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fonte de Recurso</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.fonte}</dd>
                  </div>
                )}
                {processo.orgaoGerenciadorArp && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Órgão Gerenciador da ARP</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.orgaoGerenciadorArp}</dd>
                  </div>
                )}
                {processo.fornecedorArp && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fornecedor</dt>
                    <dd className="mt-1 text-sm text-gray-900">{processo.fornecedorArp}</dd>
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
                {dataPrevistaEfetivacao && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Previsão de Efetivação do Contrato</dt>
                    <dd className="mt-1 text-sm text-gray-900">{format(dataPrevistaEfetivacao, 'dd/MM/yyyy')}</dd>
                    <dd className="mt-0.5 text-xs text-gray-500">
                      Com base no prazo-alvo do rito ({prazoAlvoDoRito(processo.rito_processual)} dias
                      a partir da abertura)
                    </dd>
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

          {(contratoVinculado || procedimentoVinculado) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Vínculo com Contratos/ARP&apos;s</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                {contratoVinculado && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contrato Vinculado</dt>
                    <dd className="mt-1 text-sm">
                      <Link
                        to={`/sistema/gestao-contratos/${contratoVinculado.id}/editar`}
                        className="text-red-700 font-medium hover:underline"
                      >
                        Nº {contratoVinculado.numero}
                      </Link>
                      <span className="text-gray-500"> — {formatarMoeda(contratoVinculado.valorGlobal)}</span>
                    </dd>
                  </div>
                )}
                {procedimentoVinculado && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Procedimento Vinculado</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {procedimentoVinculado.modalidade} {procedimentoVinculado.numero}
                    </dd>
                  </div>
                )}
                {economicidade && (
                  <div className={`sm:col-span-2 rounded-md p-3 border ${
                    economicidade.valor >= 0
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <dt className={`text-sm font-medium ${economicidade.valor >= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {economicidade.valor >= 0 ? 'Economicidade' : 'Acima do valor estimado'}
                    </dt>
                    <dd className={`mt-1 text-base font-semibold ${economicidade.valor >= 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {formatarMoeda(Math.abs(economicidade.valor))} ({Math.abs(economicidade.percentual).toFixed(1)}%)
                    </dd>
                    <dd className={`text-xs ${economicidade.valor >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Comparado ao Valor Estimado de {formatarMoeda(processo.valor_estimado ?? 0)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {checklistDisponivel && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-900">Checklist do Rito: {processo.rito_processual}</h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {progressoChecklist}% Concluído
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                  <div className="bg-red-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressoChecklist}%` }}></div>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-medium text-gray-900">Gráfico de Tarefas (Gantt) — por Setor</h2>
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs font-medium flex-shrink-0">
                {(['real', 'planejado', 'sobreposto'] as const).map((modo) => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => setModoGantt(modo)}
                    className={`px-3 py-1.5 ${modoGantt === modo ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} ${modo !== 'real' ? 'border-l border-gray-300' : ''}`}
                  >
                    {modo === 'real' ? 'Real' : modo === 'planejado' ? 'Planejado' : 'Sobreposto'}
                  </button>
                ))}
              </div>
            </div>
            {linhaDoTempo.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Sem histórico de localização registrado ainda.</p>
            ) : !dataPrevistaEfetivacao && modoGantt !== 'real' ? (
              <p className="text-sm text-gray-500 italic">
                Este rito ({processo.rito_processual || 'não informado'}) ainda não tem prazo-alvo definido —
                mostrando só o andamento real.
              </p>
            ) : (
              (() => {
                const raias = agruparLinhaDoTempoPorSetor(linhaDoTempo);
                const inicioGlobal = new Date(linhaDoTempo[0].data_inicio).getTime();
                const hoje = new Date().getTime();
                const fimPrevisto = dataPrevistaEfetivacao?.getTime();
                const fimGlobal = Math.max(hoje, fimPrevisto ?? 0);
                const spanTotal = Math.max(fimGlobal - inicioGlobal, 1);
                const dentroDoPrazo = fimPrevisto == null || hoje <= fimPrevisto;

                const raiaPlanejada = fimPrevisto ? (
                  <div className="flex items-center gap-3">
                    <div className="w-32 sm:w-44 flex-shrink-0 text-xs font-medium text-gray-700 truncate">
                      Meta (Planejado)
                    </div>
                    <div className="relative flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                      <div
                        className={`absolute top-0 h-full rounded-sm ${dentroDoPrazo ? 'bg-emerald-400' : 'bg-red-400'} opacity-70`}
                        style={{
                          left: '0%',
                          width: `${Math.min(((fimPrevisto - inicioGlobal) / spanTotal) * 100, 100)}%`,
                        }}
                        title={`Prazo-alvo até ${format(new Date(fimPrevisto), 'dd/MM/yyyy')}`}
                      />
                      {hoje > fimPrevisto && (
                        <div
                          className="absolute top-0 h-full w-0.5 bg-red-700"
                          style={{ left: `${Math.min(((hoje - inicioGlobal) / spanTotal) * 100, 100)}%` }}
                          title="Hoje"
                        />
                      )}
                    </div>
                    <div className={`w-14 flex-shrink-0 text-xs text-right font-medium ${dentroDoPrazo ? 'text-emerald-700' : 'text-red-700'}`}>
                      {dentroDoPrazo ? 'no prazo' : 'atrasado'}
                    </div>
                  </div>
                ) : null;

                if (modoGantt === 'planejado') {
                  return <div className="space-y-3">{raiaPlanejada}</div>;
                }

                return (
                  <div className="space-y-3">
                    {modoGantt === 'sobreposto' && raiaPlanejada}
                    {raias.map((raia, idxRaia) => (
                      <div key={raia.localizacao} className="flex items-center gap-3">
                        <div className="w-32 sm:w-44 flex-shrink-0 text-xs font-medium text-gray-700 truncate" title={raia.localizacao}>
                          {raia.localizacao}
                        </div>
                        <div className="relative flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                          {raia.visitas.map((visita) => {
                            const inicioVisita = new Date(visita.data_inicio).getTime();
                            const fimVisita = visita.data_fim ? new Date(visita.data_fim).getTime() : fimGlobal;
                            const left = ((inicioVisita - inicioGlobal) / spanTotal) * 100;
                            const width = Math.max(((fimVisita - inicioVisita) / spanTotal) * 100, 1.5);
                            return (
                              <div
                                key={visita.id}
                                className={`absolute top-0 h-full ${CORES_GANTT[idxRaia % CORES_GANTT.length]} hover:brightness-110 cursor-help rounded-sm`}
                                style={{ left: `${left}%`, width: `${width}%` }}
                                title={`${raia.localizacao}: ${visita.dias} dia${visita.dias === 1 ? '' : 's'} (${format(new Date(visita.data_inicio), 'dd/MM/yyyy')}${visita.data_fim ? ` a ${format(new Date(visita.data_fim), 'dd/MM/yyyy')}` : ' — atual'})`}
                              />
                            );
                          })}
                        </div>
                        <div className="w-14 flex-shrink-0 text-xs text-gray-500 text-right">{raia.diasTotal}d</div>
                      </div>
                    ))}
                  </div>
                );
              })()
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
