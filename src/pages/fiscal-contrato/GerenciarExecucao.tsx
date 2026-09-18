import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { ID_PLANILHA_CONTRATOS } from '../../lib/csv';
import { getAccessToken } from '../../lib/googleAuth';
import { sincronizarContratoNaPlanilha } from '../../lib/sheetsService';
import { contratoParaDadosPlanilha } from '../../lib/planilhaContratos';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import { calcularStatusContrato, type ContratoComStatus } from '../../lib/contratos';
import type { Contrato } from '../../types';

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

/** Página (não popup) de gerenciamento de execução/notificações do Fiscal do Contrato. */
export default function GerenciarExecucaoFiscal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contratos, execucoes, ocorrencias, addExecucao, addOcorrencia, usuarioAtual } = useApp();

  const contrato = useMemo(() => {
    const encontrado = contratos.find((c) => c.id === id);
    return encontrado ? calcularStatusContrato(encontrado) : null;
  }, [contratos, id]);

  if (!contrato) {
    return (
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
        Contrato não encontrado.
      </div>
    );
  }

  return (
    <ExecucaoModal
      contrato={contrato}
      execucoes={execucoes.filter((e) => e.contratoId === contrato.id)}
      ocorrencias={ocorrencias.filter((o) => o.contratoId === contrato.id)}
      comQuantidade
      comOcorrencias
      modoPagina
      onAddExecucao={async (execucao) => {
        const novoSaldo = await addExecucao(execucao);
        await pushSaldoNaPlanilha(contrato, novoSaldo);
      }}
      onAddOcorrencia={({ descricao, tipo }) =>
        addOcorrencia({
          contratoId: contrato.id,
          descricao,
          tipo,
          data: new Date().toISOString(),
          registradoPorId: usuarioAtual?.id ?? '',
          registradoPorNome: usuarioAtual?.nome ?? '',
        })
      }
      onFechar={() => navigate('/sistema/fiscal-contrato')}
    />
  );
}
