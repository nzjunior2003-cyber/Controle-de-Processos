import { useApp } from '../../context/AppContext';
import KpisContratos from '../../components/contratos/KpisContratos';
import { calcularStatusContrato, filtrarContratosDoFiscal } from '../../lib/contratos';

/**
 * Reaproveita os mesmos KPIs já exibidos dentro do módulo Fiscal do
 * Contrato, restritos aos contratos em que o usuário é fiscal titular
 * ou suplente. Pro master (que não é fiscal de nada), mostra a visão
 * completa em vez de uma lista vazia.
 */
export default function DashboardFiscalContrato() {
  const { contratos, usuarioAtual } = useApp();
  const isMaster = usuarioAtual?.perfil === 'master';

  const contratosDoEscopo = isMaster ? contratos : filtrarContratosDoFiscal(contratos, usuarioAtual);
  const contratosComStatus = contratosDoEscopo.map((contrato) => calcularStatusContrato(contrato));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard do Fiscal do Contrato</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isMaster
            ? 'Visão geral de todos os contratos, por vigência e valor global.'
            : 'Visão geral dos contratos sob sua fiscalização.'}
        </p>
      </div>

      <KpisContratos contratos={contratosComStatus} />

      {contratosComStatus.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Nenhum contrato sob sua fiscalização até o momento.
        </div>
      )}
    </div>
  );
}
