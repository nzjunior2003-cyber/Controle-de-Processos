import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowDownAZ, ArrowUpAZ, BellRing, Clock, FileText, Filter, Mail, PlusCircle,
  RefreshCw, Search, ShieldAlert, UserPlus, UserX,
} from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import type { Contrato } from '../../types';
import { ID_PLANILHA_CONTRATOS, URL_PLANILHA_CONTRATOS } from '../../lib/csv';
import { getAccessToken, initAuth } from '../../lib/googleAuth';
import { sincronizarContratoNaPlanilha } from '../../lib/sheetsService';
import { contratoParaDadosPlanilha } from '../../lib/planilhaContratos';
import { enviarEmail } from '../../lib/emailService';
import { AlertasModal } from '../../components/AlertasModal';
import KpisContratos, { type FiltroKpi } from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import {
  buscarContratos,
  calcularStatusContrato,
  filtrarContratosPorGestor,
  ordenarContratosPorNumero,
  OPCOES_FONTE_RECURSO_CONTRATO,
  OPCOES_NATUREZA_DESPESA_CONTRATO,
  type ContratoComStatus,
} from '../../lib/contratos';

/**
 * Depois de uma execução (NF) ou aditivo lançado no app mudar o saldo/
 * valor global do contrato, empurra esses campos de volta pra planilha —
 * só se já houver uma sessão Google autenticada (não força um popup de
 * login no meio do lançamento); falha aqui não deve travar o fluxo.
 */
async function pushSaldoNaPlanilha(
  contrato: ContratoComStatus,
  atualizacao: Partial<Pick<Contrato, 'valorGlobal' | 'saldoAtualFinanceiro'>>,
): Promise<void> {
  try {
    const googleToken = await getAccessToken();
    if (!googleToken) return;
    await sincronizarContratoNaPlanilha(
      googleToken,
      ID_PLANILHA_CONTRATOS,
      contratoParaDadosPlanilha({ ...contrato, ...atualizacao }),
      contrato.planilha_linha,
    );
  } catch (erro) {
    console.error('Erro ao sincronizar saldo do contrato com a planilha:', erro);
  }
}

export default function GestaoContratos() {
  const {
    processos,
    pcas,
    usuarioAtual,
    usuarios,
    contratos,
    updateContrato,
    syncContratosDaPlanilha,
    execucoes,
    addExecucao,
    ocorrencias,
    addOcorrencia,
    aditivos,
    addAditivo,
  } = useApp();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'alertas' | 'vinculos'>('geral');
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoComStatus | null>(null);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpi>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroNatureza, setFiltroNatureza] = useState('');
  const [filtroFonte, setFiltroFonte] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState<'todos' | 'ativos' | 'concluidos'>('todos');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc'>('asc');
  const [enviandoEmailId, setEnviandoEmailId] = useState<string | null>(null);

  useEffect(() => {
    const cancelar = initAuth();
    return () => cancelar();
  }, []);

  const getPcaTitleByProcesso = (numeroProcesso: string) => {
    const processo = processos.find((p) => p.numero_processo === numeroProcesso);
    if (processo?.pca_id) {
      return pcas.find((p) => p.id === processo.pca_id)?.codigo_pca ?? null;
    }
    return null;
  };

  /** Qualquer usuário do perfil Gestão de Contratos (Gestor "raiz" ou Auxiliar) vê todos os contratos. */
  const contratosDoEscopo = useMemo(
    () => filtrarContratosPorGestor(contratos, usuarioAtual),
    [contratos, usuarioAtual],
  );

  const contratosComStatus = useMemo(
    () => contratosDoEscopo.map((contrato) => calcularStatusContrato(contrato)),
    [contratosDoEscopo],
  );

  const filtrados = useMemo(() => {
    let lista = buscarContratos(contratosComStatus, busca);
    // Os cards de KPI (Vigentes/Atenção/Vencidos) só contam contratos em
    // andamento — um concluído não entra em nenhum dos três, então filtrar
    // por eles aqui também exclui concluídos, senão a lista da tabela não
    // bateria com o número mostrado no card.
    if (filtroKpi === 'vigentes') lista = lista.filter((c) => c.diasRestantes > 90 && !c.concluido);
    else if (filtroKpi === 'atencao') {
      lista = lista.filter((c) => c.diasRestantes >= 0 && c.diasRestantes <= 90 && !c.concluido);
    } else if (filtroKpi === 'vencidos') lista = lista.filter((c) => c.diasRestantes < 0 && !c.concluido);
    if (filtroNatureza) lista = lista.filter((c) => c.naturezaDespesa === filtroNatureza);
    if (filtroFonte) lista = lista.filter((c) => c.fonteRecurso === filtroFonte);
    if (filtroSituacao === 'concluidos') lista = lista.filter((c) => c.concluido);
    else if (filtroSituacao === 'ativos') lista = lista.filter((c) => !c.concluido);
    return ordenarContratosPorNumero(lista, direcaoOrdenacao);
  }, [contratosComStatus, busca, filtroKpi, filtroNatureza, filtroFonte, filtroSituacao, direcaoOrdenacao]);

  const filtrosAtivos =
    [filtroNatureza, filtroFonte].filter(Boolean).length + (filtroSituacao !== 'todos' ? 1 : 0);

  const isMasterOrGestao =
    usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'gestao';

  const handleToggleConcluido = async (contrato: ContratoComStatus) => {
    try {
      await updateContrato(contrato.id, { concluido: !contrato.concluido });
    } catch (erro) {
      alert('Não foi possível atualizar a situação do contrato: ' + (erro instanceof Error ? erro.message : String(erro)));
    }
  };

  // Contratos já concluídos não entram no painel de alertas — não há mais
  // nada a fazer, mesmo com vigência vencida ou saldo baixo. A janela
  // (180 dias) bate com os marcos de alerta automático (ver
  // marcoAlertaVencimento), mais os já vencidos.
  const contratosEmAlerta = useMemo(
    () => filtrados.filter((c) => c.diasRestantes <= 180 && !c.concluido),
    [filtrados],
  );

  // Contratos com Fiscal Titular/Suplente cadastrado (nome ou e-mail
  // preenchido) mas sem nenhum usuário Fiscal ativo com esse e-mail —
  // sinal de que a pessoa não vai enxergar o contrato mesmo depois de
  // ter acesso aprovado, geralmente por erro de digitação no e-mail.
  const emailsFiscaisAtivos = useMemo(
    () =>
      new Set(
        usuarios.filter((u) => u.perfil === 'fiscal' && u.ativo).map((u) => u.email.trim().toLowerCase()),
      ),
    [usuarios],
  );
  const contratosComFiscalSemUsuario = useMemo(() => {
    const temUsuario = (email?: string) => !!email && emailsFiscaisAtivos.has(email.trim().toLowerCase());
    return contratosComStatus
      .filter((c) => !c.concluido)
      .map((c) => ({
        contrato: c,
        titularSemUsuario: !!(c.fiscalTitular || c.fiscalEmail) && !temUsuario(c.fiscalEmail),
        suplenteSemUsuario: !!(c.fiscalSuplente || c.fiscalSuplenteEmail) && !temUsuario(c.fiscalSuplenteEmail),
      }))
      .filter((item) => item.titularSemUsuario || item.suplenteSemUsuario);
  }, [contratosComStatus, emailsFiscaisAtivos]);

  // O sentido inverso: usuários Fiscal já ativados pelo master mas que
  // ainda não foram digitados em nenhum contrato (Titular ou Suplente) —
  // "novo fiscal cadastrado, aguardando vínculo".
  const emailsVinculadosAContrato = useMemo(() => {
    const set = new Set<string>();
    contratos.forEach((c) => {
      if (c.fiscalEmail) set.add(c.fiscalEmail.trim().toLowerCase());
      if (c.fiscalSuplenteEmail) set.add(c.fiscalSuplenteEmail.trim().toLowerCase());
    });
    return set;
  }, [contratos]);
  const fiscaisSemContrato = useMemo(
    () =>
      usuarios.filter(
        (u) => u.perfil === 'fiscal' && u.ativo && !emailsVinculadosAContrato.has(u.email.trim().toLowerCase()),
      ),
    [usuarios, emailsVinculadosAContrato],
  );

  const handleReenviarEmailFiscal = async (contrato: ContratoComStatus) => {
    const destinatario = contrato.fiscalEmail || contrato.contatoEmail;
    if (!destinatario) return;
    setEnviandoEmailId(contrato.id);
    try {
      await enviarEmail({
        to: destinatario,
        subject: `[ALERTA] Contrato ${contrato.numero} - Ações Necessárias`,
        html: `
          <h2>Alerta de Contrato - ${contrato.numero}</h2>
          <p>Prezado Fiscal,</p>
          <p>Este é um lembrete sobre o contrato <b>${contrato.numero}</b> (${contrato.empresa}):</p>
          <p>Fim da Vigência: ${contrato.fimVigencia}<br/>
          ${contrato.diasRestantes < 0
            ? `Vencido há ${Math.abs(contrato.diasRestantes)} dias.`
            : `Faltam ${contrato.diasRestantes} dias para o fim da vigência.`}</p>
        `,
      });
      alert(`E-mail reenviado para ${destinatario}.`);
    } catch (erro) {
      alert('Não foi possível enviar o e-mail: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setEnviandoEmailId(null);
    }
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await syncContratosDaPlanilha(URL_PLANILHA_CONTRATOS);
      alert(
        `Sincronização concluída: ${resultado.criados} contrato(s) novo(s), ` +
          `${resultado.atualizados} atualizado(s)` +
          (resultado.ignorados > 0 ? `, ${resultado.ignorados} linha(s) ignorada(s) (sem N° do Contrato).` : '.'),
      );
    } catch (erro) {
      alert('Erro ao sincronizar a planilha: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSincronizando(false);
    }
  };

  // Sempre a versão mais atual do contrato selecionado (não a foto tirada
  // no clique) — essencial pra refletir na hora um aditivo/execução recém
  // lançados sem precisar fechar e reabrir o modal.
  const contratoModalAtivo = contratoSelecionado
    ? (contratosComStatus.find((c) => c.id === contratoSelecionado.id) ?? contratoSelecionado)
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Contratos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acompanhamento e fiscalização dos contratos em vigor e vigências.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMasterOrGestao && (
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              title="Atualiza os contratos com os dados mais recentes da planilha de Gestão de Contratos"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Sincronizando...' : 'Sincronizar Planilha'}
            </button>
          )}
          {isMasterOrGestao && (
            <button
              onClick={() => navigate('/sistema/gestao-contratos/novo')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800"
            >
              <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
              Novo Contrato
            </button>
          )}
          <button
            onClick={() => setAlertasModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <BellRing className="-ml-1 mr-2 h-5 w-5" />
            Painel de Alertas
          </button>
        </div>
      </div>

      <AlertasModal
        isOpen={alertasModalOpen}
        onClose={() => setAlertasModalOpen(false)}
        contratos={contratosComStatus}
        execucoes={execucoes}
      />

      {isMasterOrGestao && fiscaisSemContrato.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <UserPlus className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {fiscaisSemContrato.length === 1
                  ? '1 novo fiscal cadastrado, aguardando vínculo a um contrato'
                  : `${fiscaisSemContrato.length} novos fiscais cadastrados, aguardando vínculo a um contrato`}
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                {fiscaisSemContrato.map((f) => f.nome).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAbaAtiva('vinculos')}
            className="inline-flex items-center px-3 py-1.5 border border-amber-300 rounded-md text-sm font-medium text-amber-800 bg-white hover:bg-amber-100 whitespace-nowrap"
          >
            Ver detalhes
          </button>
        </div>
      )}

      <KpisContratos contratos={contratosComStatus} filtro={filtroKpi} onFiltrar={setFiltroKpi} />

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setAbaAtiva('geral')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              abaAtiva === 'geral'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Controle de Contratos
          </button>
          <button
            onClick={() => setAbaAtiva('alertas')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              abaAtiva === 'alertas'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            Notificações e Alertas
          </button>
          {isMasterOrGestao && (
            <button
              onClick={() => setAbaAtiva('vinculos')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                abaAtiva === 'vinculos'
                  ? 'border-red-700 text-red-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserX className="w-4 h-4 mr-2" />
              Vínculo de Fiscais
              {contratosComFiscalSemUsuario.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                  {contratosComFiscalSemUsuario.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
            placeholder="Buscar por PAE, Contrato, Empresa ou Objeto..."
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setDirecaoOrdenacao((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title="Ordenar por Nº do Contrato"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap"
          >
            {direcaoOrdenacao === 'asc' ? (
              <ArrowUpAZ className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
            ) : (
              <ArrowDownAZ className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
            )}
            Nº {direcaoOrdenacao === 'asc' ? 'Crescente' : 'Decrescente'}
          </button>
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
      </div>

      {mostrarFiltros && (
        <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Natureza de Despesa</label>
            <select
              value={filtroNatureza}
              onChange={(e) => setFiltroNatureza(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
            >
              <option value="">Todas</option>
              {OPCOES_NATUREZA_DESPESA_CONTRATO.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fonte de Recurso</label>
            <select
              value={filtroFonte}
              onChange={(e) => setFiltroFonte(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
            >
              <option value="">Todas</option>
              {OPCOES_FONTE_RECURSO_CONTRATO.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Situação</label>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value as 'todos' | 'ativos' | 'concluidos')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
            >
              <option value="todos">Todas</option>
              <option value="ativos">Em andamento</option>
              <option value="concluidos">Concluídos</option>
            </select>
          </div>
          {filtrosAtivos > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="button"
                onClick={() => {
                  setFiltroNatureza('');
                  setFiltroFonte('');
                  setFiltroSituacao('todos');
                }}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {abaAtiva === 'geral' && (
          <TabelaContratosVigencia
            dados={filtrados}
            execucoes={execucoes}
            ocorrencias={ocorrencias}
            podeGerenciar={isMasterOrGestao}
            onGerenciar={setContratoSelecionado}
            onEditar={
              isMasterOrGestao
                ? (contrato) => navigate(`/sistema/gestao-contratos/${contrato.id}/editar`)
                : undefined
            }
            onToggleConcluido={isMasterOrGestao ? handleToggleConcluido : undefined}
            getPcaTitleByProcesso={getPcaTitleByProcesso}
          />
        )}

        {abaAtiva === 'alertas' && (
          <div className="p-6 bg-slate-50">
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">
                Notificações Disparadas para Fiscais
              </h3>
            </div>
            <div className="space-y-4">
              {contratosEmAlerta.map((item) => {
                const destinatario = item.fiscalEmail || item.contatoEmail;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${item.diasRestantes < 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} flex justify-between items-center`}
                  >
                    <div>
                      <h4 className={`text-sm font-bold ${item.diasRestantes < 0 ? 'text-red-800' : 'text-orange-800'}`}>
                        Contrato {item.numero} - {item.empresa}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        PAE: {item.pae} | Fiscal: {item.fiscalTitular}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Vencimento: {format(new Date(item.fimVigencia), 'dd/MM/yyyy')} (
                        {item.diasRestantes < 0
                          ? `Vencido há ${Math.abs(item.diasRestantes)} dias`
                          : `Faltam ${item.diasRestantes} dias`}
                        )
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => handleReenviarEmailFiscal(item)}
                        disabled={!destinatario || enviandoEmailId === item.id}
                        title={destinatario ? undefined : 'Contrato sem e-mail de fiscal cadastrado'}
                        className={`px-4 py-2 rounded text-sm font-medium border disabled:opacity-50 disabled:cursor-not-allowed ${
                          item.diasRestantes < 0
                            ? 'bg-red-600 text-white hover:bg-red-700 border-transparent'
                            : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                        }`}
                      >
                        <Mail className="w-4 h-4 inline mr-2" />
                        {enviandoEmailId === item.id ? 'Enviando...' : 'Reenviar E-mail ao Fiscal'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {contratosEmAlerta.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum contrato em período crítico de alerta.
                </div>
              )}
            </div>
          </div>
        )}

        {abaAtiva === 'vinculos' && (
          <div className="p-6 bg-slate-50 space-y-8">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Fiscais Aguardando Vínculo a um Contrato
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Usuários com perfil Fiscal já ativados, mas cujo e-mail ainda não foi digitado em
                nenhum contrato (Titular ou Suplente) — edite o contrato correspondente e selecione
                esse fiscal em Fiscalização.
              </p>
              <div className="space-y-3">
                {fiscaisSemContrato.map((f) => (
                  <div key={f.id} className="p-4 rounded-lg border bg-white border-gray-200">
                    <h4 className="text-sm font-bold text-gray-900">{f.nome}</h4>
                    <p className="text-xs text-gray-600 mt-1">{f.email}{f.cargo ? ` — ${f.cargo}` : ''}</p>
                  </div>
                ))}
                {fiscaisSemContrato.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum fiscal ativo aguardando vínculo no momento.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Contratos com Fiscal sem Usuário Correspondente
                </h3>
              </div>
            <p className="text-sm text-gray-500 mb-4">
              Estes contratos têm Fiscal Titular/Suplente cadastrado, mas o e-mail não bate com
              nenhum usuário Fiscal já aprovado no sistema — a pessoa não vai ver este contrato em
              "Fiscal do Contrato" até o e-mail ser corrigido (ou até ela solicitar/ter o acesso
              aprovado).
            </p>
            <div className="space-y-3">
              {contratosComFiscalSemUsuario.map(({ contrato, titularSemUsuario, suplenteSemUsuario }) => (
                <div key={contrato.id} className="p-4 rounded-lg border bg-white border-gray-200 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Contrato {contrato.numero} — {contrato.empresa}
                    </h4>
                    {titularSemUsuario && (
                      <p className="text-xs text-red-700 mt-1">
                        Fiscal Titular: {contrato.fiscalTitular || '(sem nome)'} — {contrato.fiscalEmail || 'sem e-mail cadastrado'}
                      </p>
                    )}
                    {suplenteSemUsuario && (
                      <p className="text-xs text-red-700 mt-1">
                        Fiscal Suplente: {contrato.fiscalSuplente || '(sem nome)'} — {contrato.fiscalSuplenteEmail || 'sem e-mail cadastrado'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/sistema/gestao-contratos/${contrato.id}/editar`)}
                    className="px-4 py-2 rounded text-sm font-medium border bg-white text-red-700 border-red-300 hover:bg-red-50 whitespace-nowrap"
                  >
                    Corrigir Contrato
                  </button>
                </div>
              ))}
              {contratosComFiscalSemUsuario.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Todos os fiscais cadastrados nos contratos correspondem a um usuário ativo.
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>

      {contratoModalAtivo && (
        <ExecucaoModal
          contrato={contratoModalAtivo}
          execucoes={execucoes.filter((e) => e.contratoId === contratoModalAtivo.id)}
          ocorrencias={ocorrencias.filter((o) => o.contratoId === contratoModalAtivo.id)}
          aditivos={aditivos.filter((a) => a.contratoId === contratoModalAtivo.id)}
          comOcorrencias
          comAditivos={isMasterOrGestao}
          onAddExecucao={async (execucao) => {
            const novoSaldo = await addExecucao(execucao);
            await pushSaldoNaPlanilha(contratoModalAtivo, novoSaldo);
          }}
          onAddOcorrencia={({ descricao, tipo }) =>
            addOcorrencia({
              contratoId: contratoModalAtivo.id,
              descricao,
              tipo,
              data: new Date().toISOString(),
              registradoPorId: usuarioAtual?.id ?? '',
              registradoPorNome: usuarioAtual?.nome ?? '',
            })
          }
          onAddAditivo={async (dados) => {
            const atualizacao = await addAditivo({
              ...dados,
              contratoId: contratoModalAtivo.id,
              registradoPorId: usuarioAtual?.id ?? '',
              registradoPorNome: usuarioAtual?.nome ?? '',
            });
            if (Object.keys(atualizacao).length > 0) {
              await pushSaldoNaPlanilha(contratoModalAtivo, atualizacao);
            }
          }}
          onFechar={() => setContratoSelecionado(null)}
        />
      )}
    </div>
  );
}
