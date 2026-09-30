import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import ExecucaoModal from '../../components/contratos/ExecucaoModal';
import { calcularStatusContrato } from '../../lib/contratos';
import { pushSaldoNaPlanilha } from '../../lib/saldoPlanilha';

/** Página (não popup) de gerenciamento de execução/notificações do Fiscal do Contrato. */
export default function GerenciarExecucaoFiscal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contratos, execucoes, ocorrencias, addExecucao, addOcorrencia, usuarioAtual } = useApp();

  const contrato = useMemo(() => {
    const encontrado = contratos.find((c) => c.id === id);
    return encontrado ? calcularStatusContrato(encontrado) : null;
  }, [contratos, id]);

  const perfil = usuarioAtual?.perfil;
  if (perfil !== 'master' && perfil !== 'fiscal' && perfil !== 'gestao' && perfil !== 'contratos') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para gerenciar a execução deste contrato.
      </div>
    );
  }

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
