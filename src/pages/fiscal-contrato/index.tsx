import { useEffect, useMemo, useState } from 'react';
import { FileCheck, Filter, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Contrato } from '../../types';
import { ID_PLANILHA_CONTRATOS } from '../../lib/csv';
import { getAccessToken, initAuth } from '../../lib/googleAuth';
import { sincronizarContratoNaPlanilha } from '../../lib/sheetsService';
import { contratoParaDadosPlanilha } from '../../lib/planilhaContratos';
import KpisContratos from '../../components/contratos/KpisContratos';
import TabelaContratosVigencia from '../../components/contratos/TabelaContratosVigencia';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import {
  buscarContratos,
  calcularStatusContrato,
  filtrarContratosDoFiscal,
  type ContratoComStatus,
} from '../../lib/contratos';

/**
 * Depois de uma execução (NF) lançada no app mudar o saldo do contrato,
 * empurra esse campo de volta pra planilha — só se já houver uma sessão
 * Google autenticada (não força um popup de login no meio do
 * lançamento); falha aqui não deve travar o fluxo do fiscal.
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

export default function FiscalContrato() {
  const { processos, pcas, usuarioAtual, contratos, execucoes, addExecucao, ocorrencias, addOcorrencia } =
    useApp();

  const [busca, setBusca] = useState('');
  const [contratoSelecionado, setContratoSelecionado] = useState<ContratoComStatus | null>(null);

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

  // Sempre a versão mais atual do contrato selecionado (não a foto tirada
  // no clique) — essencial pra refletir na hora uma execução recém lançada
  // sem precisar fechar e reabrir o modal.
  const contratoModalAtivo = contratoSelecionado
    ? (contratosComStatus.find((c) => c.id === contratoSelecionado.id) ?? contratoSelecionado)
    : null;

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
          ocorrencias={ocorrencias}
          podeGerenciar={isMasterOrFiscal}
          onGerenciar={setContratoSelecionado}
          getPcaTitleByProcesso={getPcaTitleByProcesso}
        />
      </div>

      {contratoModalAtivo && (
        <ExecucaoModal
          contrato={contratoModalAtivo}
          execucoes={execucoes.filter((e) => e.contratoId === contratoModalAtivo.id)}
          ocorrencias={ocorrencias.filter((o) => o.contratoId === contratoModalAtivo.id)}
          comQuantidade
          comOcorrencias
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
          onFechar={() => setContratoSelecionado(null)}
        />
      )}
    </div>
  );
}
