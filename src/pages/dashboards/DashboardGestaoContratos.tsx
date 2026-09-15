import { useApp } from '../../context/AppContext';
import KpisContratos from '../../components/contratos/KpisContratos';
import GraficosContratos from '../../components/contratos/GraficosContratos';
import { calcularStatusContrato } from '../../lib/contratos';

/**
 * Reaproveita os mesmos KPIs já exibidos dentro do módulo Gestão de
 * Contratos (Vigentes/Atenção/Vencidos/Valor Global) — qualquer usuário
 * do perfil Gestão de Contratos vê todos os contratos, sem distinção.
 */
export default function DashboardGestaoContratos() {
  const { contratos } = useApp();

  const contratosComStatus = contratos.map((contrato) => calcularStatusContrato(contrato));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Gestão de Contratos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visão geral dos contratos em gestão — vigência e valor global.
        </p>
      </div>

      <KpisContratos contratos={contratosComStatus} />

      {contratosComStatus.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          Nenhum contrato cadastrado até o momento.
        </div>
      ) : (
        <GraficosContratos contratos={contratosComStatus} />
      )}
    </div>
  );
}
