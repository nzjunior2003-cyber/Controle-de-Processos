import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, Filter, AlertCircle, FileCheck2, FilePlus, Clock, Database, List, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, ListChecks } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import IntegracaoPCA from './IntegracaoPCA';
import { STATUS_PROCESSO_CORES as STATUS_CORES, STATUS_PROCESSO_LABELS as STATUS_LABELS, type StatusProcesso } from '../types';
import { URL_PLANILHA_PROCESSOS } from '../lib/csv';
import { calcularProgressoChecklist, ordenarPorProgresso } from '../lib/fluxoProcesso';
import { useEtapasPorRito } from '../hooks/useEtapasPorRito';

type FiltroTempo = 'todos' | 'verde' | 'amarelo' | 'vermelho' | 'contratado';
type FiltroPrevisaoPca = 'todos' | 'sim' | 'nao';

export default function Aquisicoes() {
  const { processos, setores, usuarioAtual, syncProcessosDaPlanilha } = useApp();
  const navigate = useNavigate();
  const etapasPorRito = useEtapasPorRito();
  const [sincronizando, setSincronizando] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Filtros na URL (query params), não em useState local — assim, ao entrar
  // no detalhe de um processo e voltar, a lista mantém exatamente os
  // filtros aplicados antes (useState local se perdia ao desmontar a tela).
  const [searchParams, setSearchParams] = useSearchParams();
  const definirParam = (chave: string, valor: string, valorPadrao: string) => {
    const proximos = new URLSearchParams(searchParams);
    if (valor === valorPadrao) proximos.delete(chave);
    else proximos.set(chave, valor);
    setSearchParams(proximos, { replace: true });
  };

  const busca = searchParams.get('busca') ?? '';
  const setBusca = (v: string) => definirParam('busca', v, '');
  const activeTab = (searchParams.get('tab') as 'processos' | 'pca') || 'processos';
  const setActiveTab = (v: 'processos' | 'pca') => definirParam('tab', v, 'processos');

  const filtroTempo = (searchParams.get('tempo') as FiltroTempo) || 'todos';
  const setFiltroTempo = (v: FiltroTempo) => definirParam('tempo', v, 'todos');
  const filtroRito = searchParams.get('rito') ?? '';
  const setFiltroRito = (v: string) => definirParam('rito', v, '');
  const filtroNatureza = searchParams.get('natureza') ?? '';
  const setFiltroNatureza = (v: string) => definirParam('natureza', v, '');
  const filtroSetorAtual = searchParams.get('setor') ?? '';
  const setFiltroSetorAtual = (v: string) => definirParam('setor', v, '');
  const filtroFonte = searchParams.get('fonte') ?? '';
  const setFiltroFonte = (v: string) => definirParam('fonte', v, '');
  const filtroPrevisaoPca = (searchParams.get('pca') as FiltroPrevisaoPca) || 'todos';
  const setFiltroPrevisaoPca = (v: FiltroPrevisaoPca) => definirParam('pca', v, 'todos');
  // Ordenação pelo percentual de andamento (o mesmo exibido sob o status):
  // 'asc' (menor→maior), 'desc' (maior→menor) ou vazio (ordem original da lista).
  const ordemStatus = (searchParams.get('ordem') as 'asc' | 'desc' | null) ?? '';
  const alternarOrdemStatus = () =>
    definirParam('ordem', ordemStatus === '' ? 'asc' : ordemStatus === 'asc' ? 'desc' : '', '');
  const filtroStatus = (searchParams.get('status') ?? '') as StatusProcesso | '';
  const setFiltroStatus = (v: StatusProcesso | '') => definirParam('status', v, '');
  const filtroAno = searchParams.get('ano') ?? '';
  const setFiltroAno = (v: string) => definirParam('ano', v, '');
  const filtroDemandante = searchParams.get('demandante') ?? '';
  const setFiltroDemandante = (v: string) => definirParam('demandante', v, '');

  const hoje = new Date();

  const opcoesUnicas = (valores: (string | undefined)[]) =>
    Array.from(new Set(valores.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));

  // Ano de entrada do processo (a coluna "Ano de entrada" da planilha) — da data de entrada; sem ela, da abertura/criação.
  const anoDoProcesso = (p: (typeof processos)[number]) => (p.data_entrada ?? p.data_abertura ?? p.criado_em ?? '').slice(0, 4);
  const opcoesAno = opcoesUnicas(processos.map(anoDoProcesso)).sort((a, b) => b.localeCompare(a));
  const opcoesRito = opcoesUnicas(processos.map((p) => p.rito_processual));
  const opcoesNatureza = opcoesUnicas(processos.map((p) => p.natureza_despesa));
  const opcoesSetorAtual = opcoesUnicas(
    processos.map((p) => p.localizacao_atual || setores.find((s) => s.id === p.fase_atual_id)?.sigla),
  );
  const opcoesFonte = opcoesUnicas(processos.map((p) => p.fonte));
  const opcoesDemandante = opcoesUnicas(processos.map((p) => p.unidade_demandante));
  const contagemPorStatus = processos.reduce<Partial<Record<StatusProcesso, number>>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtrosAtivos = [
    filtroRito, filtroNatureza, filtroSetorAtual, filtroFonte, filtroDemandante, filtroStatus, filtroAno,
  ].filter(Boolean).length + (filtroPrevisaoPca !== 'todos' ? 1 : 0);

  const filtradosSemOrdem = processos.filter(p => {
    const setorAtualEfetivo = p.localizacao_atual || setores.find(s => s.id === p.fase_atual_id)?.sigla || '';
    const buscaNormalizada = busca.toLowerCase();
    const matchBusca =
      !buscaNormalizada ||
      [
        p.numero_processo, p.objeto, p.rito_processual, p.natureza_despesa,
        setorAtualEfetivo, p.fonte, p.unidade_demandante,
      ].some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));

    if (!matchBusca) return false;

    if (filtroStatus && p.status !== filtroStatus) return false;
    if (filtroAno && anoDoProcesso(p) !== filtroAno) return false;
    if (filtroRito && p.rito_processual !== filtroRito) return false;
    if (filtroNatureza && p.natureza_despesa !== filtroNatureza) return false;
    if (filtroSetorAtual && setorAtualEfetivo !== filtroSetorAtual) return false;
    if (filtroFonte && p.fonte !== filtroFonte) return false;
    if (filtroDemandante && p.unidade_demandante !== filtroDemandante) return false;
    if (filtroPrevisaoPca === 'sim' && !p.pca_id) return false;
    if (filtroPrevisaoPca === 'nao' && p.pca_id) return false;

    if (filtroTempo === 'todos') return true;
    if (filtroTempo === 'contratado') return p.status === 'contratado_aditivado';

    const dias = p.ultima_tramitacao ? Math.max(0, differenceInDays(hoje, new Date(p.ultima_tramitacao))) : 0;
    if (filtroTempo === 'verde' && dias < 10) return true;
    if (filtroTempo === 'amarelo' && dias >= 10 && dias <= 20) return true;
    if (filtroTempo === 'vermelho' && dias > 20) return true;

    return false;
  });
  
  // Sem ordenação escolhida, segue a ordem da planilha (coluna A); processos sem nº de ordem vão pro fim.
  const filtrados = ordemStatus
    ? ordenarPorProgresso(filtradosSemOrdem, ordemStatus, etapasPorRito)
    : [...filtradosSemOrdem].sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER));

  const contagemTempo = processos.reduce(
    (acc, proc) => {
      const dias = proc.ultima_tramitacao ? Math.max(0, differenceInDays(hoje, new Date(proc.ultima_tramitacao))) : 0;
      if (dias < 10) acc.verde++;
      else if (dias <= 20) acc.amarelo++;
      else acc.vermelho++;
      return acc;
    },
    { verde: 0, amarelo: 0, vermelho: 0 }
  );

  const contagemContratadoAditivado = processos.filter((p) => p.status === 'contratado_aditivado').length;

  const isMasterOrApoio = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'apoio';

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await syncProcessosDaPlanilha(URL_PLANILHA_PROCESSOS);
      alert(
        `Sincronização concluída: ${resultado.criados} processo(s) novo(s), ` +
          `${resultado.atualizados} atualizado(s)` +
          (resultado.ignorados > 0 ? `, ${resultado.ignorados} linha(s) ignorada(s) (sem número).` : '.'),
      );
    } catch (erro) {
      alert(
        'Erro ao sincronizar a planilha: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apoio e Suprimento</h1>
          <p className="mt-1 text-sm text-gray-500">Gestão de aquisições e controle do PCA</p>
        </div>
        {isMasterOrApoio && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              title="Atualiza os processos com os dados mais recentes da planilha de controle"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Sincronizando...' : 'Sincronizar Planilha'}
            </button>
            {usuarioAtual?.perfil === 'master' && (
              <Link
                to="/sistema/ritos"
                title="Incluir ou excluir etapas dos checklists dos ritos"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ListChecks className="-ml-1 mr-2 h-5 w-5" />
                Checklists dos ritos
              </Link>
            )}
            <Link
              to="/sistema/processos/novo"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <FilePlus className="-ml-1 mr-2 h-5 w-5" />
              Novo Processo
            </Link>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('processos')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'processos'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List className="w-5 h-5 mr-2" />
            Acompanhamento de Processos
          </button>
          <button
            onClick={() => setActiveTab('pca')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'pca'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="w-5 h-5 mr-2" />
            Integração PCA
          </button>
        </nav>
      </div>

      {activeTab === 'processos' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
             <div
               onClick={() => setFiltroTempo('todos')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-gray-400 cursor-pointer transition-colors ${filtroTempo === 'todos' ? 'ring-2 ring-gray-400 bg-gray-50 border-gray-300' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total de Processos</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{processos.length}</h3>
                  </div>
                  <List className="w-5 h-5 text-gray-400" />
               </div>
             </div>
             <div
               onClick={() => setFiltroTempo(filtroTempo === 'verde' ? 'todos' : 'verde')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-emerald-500 cursor-pointer transition-colors ${filtroTempo === 'verde' ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Menos de 10 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.verde}</h3>
                  </div>
                  <Clock className="w-5 h-5 text-emerald-500" />
               </div>
             </div>
             <div 
               onClick={() => setFiltroTempo(filtroTempo === 'amarelo' ? 'todos' : 'amarelo')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-amber-500 cursor-pointer transition-colors ${filtroTempo === 'amarelo' ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">10 a 20 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.amarelo}</h3>
                  </div>
                  <Clock className="w-5 h-5 text-amber-500" />
               </div>
             </div>
             <div 
               onClick={() => setFiltroTempo(filtroTempo === 'vermelho' ? 'todos' : 'vermelho')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-red-600 cursor-pointer transition-colors ${filtroTempo === 'vermelho' ? 'ring-2 ring-red-500 bg-red-50 border-red-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mais de 20 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.vermelho}</h3>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-600" />
               </div>
             </div>
             <div
               onClick={() => setFiltroTempo(filtroTempo === 'contratado' ? 'todos' : 'contratado')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-purple-500 cursor-pointer transition-colors ${filtroTempo === 'contratado' ? 'ring-2 ring-purple-500 bg-purple-50 border-purple-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contratado/Aditivado</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemContratadoAditivado}</h3>
                  </div>
                  <FileCheck2 className="w-5 h-5 text-purple-500" />
               </div>
             </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative flex-1 w-full max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
                  placeholder="Buscar por número, objeto, rito, natureza, setor atual, fonte ou demandante"
                />
              </div>
              <button
                type="button"
                onClick={() => setMostrarFiltros((v) => !v)}
                className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm font-medium rounded-md whitespace-nowrap ${
                  mostrarFiltros ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
              </button>
            </div>

            {mostrarFiltros && (
              <div className="p-4 border-b border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusProcesso | '')} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todos</option>
                    {(Object.keys(STATUS_LABELS) as StatusProcesso[]).map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]} ({contagemPorStatus[status] ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Rito</label>
                  <select value={filtroRito} onChange={(e) => setFiltroRito(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todos</option>
                    {opcoesRito.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Natureza de Despesa</label>
                  <select value={filtroNatureza} onChange={(e) => setFiltroNatureza(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todas</option>
                    {opcoesNatureza.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Setor Atual</label>
                  <select value={filtroSetorAtual} onChange={(e) => setFiltroSetorAtual(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todos</option>
                    {opcoesSetorAtual.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fonte</label>
                  <select value={filtroFonte} onChange={(e) => setFiltroFonte(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todas</option>
                    {opcoesFonte.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Previsão no PCA</label>
                  <select value={filtroPrevisaoPca} onChange={(e) => setFiltroPrevisaoPca(e.target.value as 'todos' | 'sim' | 'nao')} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="todos">Todos</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
                  <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todos</option>
                    {opcoesAno.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Demandante</label>
                  <select value={filtroDemandante} onChange={(e) => setFiltroDemandante(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                    <option value="">Todos</option>
                    {opcoesDemandante.map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
                {filtrosAtivos > 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroRito('');
                        setFiltroNatureza('');
                        setFiltroSetorAtual('');
                        setFiltroFonte('');
                        setFiltroPrevisaoPca('todos');
                        setFiltroDemandante('');
                        setFiltroStatus('');
                      }}
                      className="text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="w-[6%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title="Nº de ordem na planilha de processos">
                      Nº
                    </th>
                    <th scope="col" className="w-[11%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nº PAE
                    </th>
                    <th scope="col" className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Objeto
                    </th>
                    <th scope="col" className="w-[19%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Setor Atual
                    </th>
                    <th scope="col" className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rito
                    </th>
                    <th scope="col" className="w-[8%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dias no Setor
                    </th>
                    <th
                      scope="col"
                      aria-sort={ordemStatus === 'asc' ? 'ascending' : ordemStatus === 'desc' ? 'descending' : 'none'}
                      className="w-[19%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={alternarOrdemStatus}
                        title={
                          ordemStatus === ''
                            ? 'Ordenar pelo andamento (menor → maior %)'
                            : ordemStatus === 'asc'
                              ? 'Menor → maior % — clique para inverter'
                              : 'Maior → menor % — clique para remover a ordenação'
                        }
                        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900 ${ordemStatus ? 'text-red-700' : ''}`}
                      >
                        Status
                        {ordemStatus === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : ordemStatus === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Nenhum processo encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((proc) => {
                      const diasNoSetor = proc.ultima_tramitacao
                        ? Math.max(0, differenceInDays(hoje, new Date(proc.ultima_tramitacao)))
                        : null;
                      const progresso = calcularProgressoChecklist(proc, etapasPorRito);
                      return (
                        <tr
                          key={proc.id}
                          onClick={() => navigate(`/sistema/processos/${proc.id}`)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-4 text-sm text-gray-500">{proc.ordem ?? '-'}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              {proc.possui_alerta && (
                                <AlertCircle className="h-4 w-4 text-amber-500 mr-1.5 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-gray-900 truncate" title={proc.numero_processo}>
                                {proc.numero_processo}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900 line-clamp-2" title={proc.objeto}>
                              {proc.objeto}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div
                              className="text-sm text-gray-900 line-clamp-2"
                              title={proc.localizacao_atual}
                            >
                              {proc.localizacao_atual || setores.find(s => s.id === proc.fase_atual_id)?.sigla}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-700 truncate" title={proc.rito_processual}>
                              {proc.rito_processual || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-900">
                              {diasNoSetor === null ? '-' : `${diasNoSetor}d`}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium outline outline-1 outline-offset-1 whitespace-normal text-center ${STATUS_CORES[proc.status]}`}
                            >
                              {STATUS_LABELS[proc.status]}
                            </span>
                            {progresso !== null && (
                              <div className="mt-1.5 flex items-center gap-1.5" title={`${progresso}% do checklist do rito concluído`}>
                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                  <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${progresso}%` }}></div>
                                </div>
                                <span className="text-xs text-gray-500">{progresso}%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination placeholder */}
            <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">1</span> a <span className="font-medium">{filtrados.length}</span> de <span className="font-medium">{filtrados.length}</span> resultados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <IntegracaoPCA />
      )}
    </div>
  );
}
