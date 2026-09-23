import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { initAuth } from '../../lib/googleAuth';
import KpisContratos from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import FiltroAno from '../../components/contratos/FiltroAno';
import {
  buscarContratos,
  calcularStatusContrato,
  extrairAnosDisponiveis,
  filtrarContratosDoFiscal,
  filtrarContratosPorAno,
} from '../../lib/contratos';

export default function FiscalContrato() {
  const { processos, pcas, usuarioAtual, contratos, execucoes, ocorrencias } = useApp();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState<number | null>(null);

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
    () => filtrarContratosPorAno(buscarContratos(contratosPermitidos, busca), filtroAno),
    [contratosPermitidos, busca, filtroAno],
  );

  const anosDisponiveis = useMemo(() => extrairAnosDisponiveis(contratos), [contratos]);

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
        <FiltroAno anos={anosDisponiveis} valor={filtroAno} onChange={setFiltroAno} />
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <TabelaContratosVigencia
          dados={filtrados}
          execucoes={execucoes}
          ocorrencias={ocorrencias}
          podeGerenciar={isMasterOrFiscal}
          onGerenciar={(contrato) => navigate(`/sistema/fiscal-contrato/${contrato.id}/gerenciar`)}
          getPcaTitleByProcesso={getPcaTitleByProcesso}
        />
      </div>
    </div>
  );
}
