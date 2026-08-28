import { useEffect, useMemo, useState } from 'react';
import { FileCheck, Filter, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { initAuth } from '../../lib/googleAuth';
import KpisContratos from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import {
  buscarContratos,
  calcularStatusContrato,
  filtrarContratosDoFiscal,
  type ContratoComStatus,
  type ExecucaoContrato,
  type NotificacaoContrato,
} from '../../lib/contratos';

export default function FiscalContrato() {
  const { processos, pcas, usuarioAtual, contratos } = useApp();

  const [busca, setBusca] = useState('');
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoComStatus | null>(null);
  const [execucoes, setExecucoes] = useState<ExecucaoContrato[]>([]);
  const [notificacoes] = useState<NotificacaoContrato[]>([]);

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

  const contratosComStatus = useMemo(
    () => contratos.map((contrato) => calcularStatusContrato(contrato)),
    [contratos],
  );

  /** O fiscal só enxerga os contratos sob sua responsabilidade. */
  const contratosPermitidos = useMemo(
    () =>
      usuarioAtual?.perfil === 'fiscal'
        ? filtrarContratosDoFiscal(contratosComStatus, usuarioAtual)
        : contratosComStatus,
    [contratosComStatus, usuarioAtual],
  );

  const filtrados = useMemo(
    () => buscarContratos(contratosPermitidos, busca),
    [contratosPermitidos, busca],
  );

  const isMasterOrFiscal =
    usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'fiscal';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileCheck className="w-6 h-6 mr-2 text-indigo-600" />
            Módulo Fiscal do Contrato
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Bem-vindo, {usuarioAtual?.nome}. Abaixo estão os contratos sob sua
            responsabilidade.
          </p>
        </div>
      </div>

      <KpisContratos contratos={contratosPermitidos} />

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
        <TabelaContratosVigencia
          dados={filtrados}
          execucoes={execucoes}
          notificacoes={notificacoes}
          podeGerenciar={isMasterOrFiscal}
          onGerenciar={setContratoSelecionado}
          getPcaTitleByProcesso={getPcaTitleByProcesso}
        />
      </div>

      {contratoSelecionado && (
        <ExecucaoModal
          contrato={contratoSelecionado}
          execucoes={execucoes}
          notificacoes={notificacoes}
          comQuantidade
          usuarioNome={usuarioAtual?.nome}
          onAddExecucao={(execucao) =>
            setExecucoes((anteriores) => [...anteriores, { ...execucao, id: Date.now() }])
          }
          onFechar={() => setContratoSelecionado(null)}
        />
      )}
    </div>
  );
}
