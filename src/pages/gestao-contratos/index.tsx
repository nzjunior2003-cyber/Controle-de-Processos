import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BellRing, Clock, FileText, Filter, Mail, PlusCircle, Search, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { initAuth } from '../../lib/googleAuth';
import { AlertasModal } from '../../components/AlertasModal';
import KpisContratos, { type FiltroKpi } from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import {
  buscarContratos,
  calcularStatusContrato,
  filtrarContratosPorGestor,
  type ContratoComStatus,
} from '../../lib/contratos';

export default function GestaoContratos() {
  const { processos, pcas, usuarioAtual, contratos, execucoes, addExecucao, ocorrencias, addOcorrencia } =
    useApp();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'alertas'>('geral');
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoComStatus | null>(null);
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpi>(null);

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

  /** Um Auxiliar só vê os contratos do seu Gestor responsável; um Gestor "raiz" vê todos. */
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
    if (filtroKpi === 'vigentes') lista = lista.filter((c) => c.diasRestantes > 90);
    else if (filtroKpi === 'atencao') lista = lista.filter((c) => c.diasRestantes >= 0 && c.diasRestantes <= 90);
    else if (filtroKpi === 'vencidos') lista = lista.filter((c) => c.diasRestantes < 0);
    return lista;
  }, [contratosComStatus, busca, filtroKpi]);

  const isMasterOrGestao =
    usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'gestao';

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
        <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
          Filtros Avançados
        </button>
      </div>

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
              {filtrados
                .filter((c) => c.diasRestantes <= 90)
                .map((item) => (
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
                        className={`px-4 py-2 rounded text-sm font-medium border ${
                          item.diasRestantes < 0
                            ? 'bg-red-600 text-white hover:bg-red-700 border-transparent'
                            : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                        }`}
                      >
                        <Mail className="w-4 h-4 inline mr-2" />
                        Reenviar E-mail ao Fiscal
                      </button>
                    </div>
                  </div>
                ))}
              {filtrados.filter((c) => c.diasRestantes <= 90).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum contrato em período crítico de alerta.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {contratoSelecionado && (
        <ExecucaoModal
          contrato={contratoSelecionado}
          execucoes={execucoes.filter((e) => e.contratoId === contratoSelecionado.id)}
          ocorrencias={ocorrencias.filter((o) => o.contratoId === contratoSelecionado.id)}
          comOcorrencias
          onAddExecucao={(execucao) => addExecucao(execucao)}
          onAddOcorrencia={({ descricao, tipo }) =>
            addOcorrencia({
              contratoId: contratoSelecionado.id,
              descricao,
              tipo,
              data: new Date().toISOString(),
              registradoPorId: usuarioAtual?.id ?? '',
              registradoPorNome: usuarioAtual?.nome ?? '',
            })
          }
          onFechar={() => setContratoSelecionado(null)}
        />
      )}
    </div>
  );
}
