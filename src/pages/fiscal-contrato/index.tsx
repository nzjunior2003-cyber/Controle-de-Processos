import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { initAuth } from '../../lib/googleAuth';
import KpisContratos, { type FiltroKpi } from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import FiltroAno from '../../components/contratos/FiltroAno';
import {
  buscarContratos,
  calcularStatusContrato,
  extrairAnosDisponiveis,
  filtrarContratosDoFiscal,
  filtrarContratosPorAno,
  linhasCsvContratos,
} from '../../lib/contratos';
import { exportarCsv } from '../../lib/exportarCsv';

export default function FiscalContrato() {
  const { processos, pcas, usuarioAtual, contratos, execucoes, ocorrencias } = useApp();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState<number | null>(null);
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

  const filtrados = useMemo(() => {
    let lista = filtrarContratosPorAno(buscarContratos(contratosPermitidos, busca), filtroAno);
    if (filtroKpi === 'vigentes') lista = lista.filter((c) => c.diasRestantes > 90 && !c.concluido);
    else if (filtroKpi === 'atencao') {
      lista = lista.filter((c) => c.diasRestantes >= 0 && c.diasRestantes <= 90 && !c.concluido);
    } else if (filtroKpi === 'vencidos') lista = lista.filter((c) => c.diasRestantes < 0 && !c.concluido);
    return lista;
  }, [contratosPermitidos, busca, filtroAno, filtroKpi]);

  const anosDisponiveis = useMemo(() => extrairAnosDisponiveis(contratos), [contratos]);

  const isMasterOrFiscal =
    usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'fiscal';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileCheck className="w-6 h-6 mr-2 text-indigo-600 flex-shrink-0" />
            Módulo Fiscal do Contrato
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Bem-vindo, {usuarioAtual?.nome}. Abaixo estão os contratos sob sua
            responsabilidade.
          </p>
        </div>
      </div>

      <KpisContratos contratos={contratosPermitidos} filtro={filtroKpi} onFiltrar={setFiltroKpi} />

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
        <div className="flex items-center gap-2">
          <FiltroAno anos={anosDisponiveis} valor={filtroAno} onChange={setFiltroAno} />
          <button
            type="button"
            onClick={() => {
              const { colunas, linhas } = linhasCsvContratos(filtrados);
              exportarCsv('contratos', colunas, linhas);
            }}
            title="Exporta os contratos filtrados nesta tela em CSV"
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
            Exportar CSV
          </button>
        </div>
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
