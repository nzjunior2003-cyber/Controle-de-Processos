import { useApp } from '../../context/AppContext';
import KpisContratos from '../../components/contratos/KpisContratos';
import GraficosContratos from '../../components/contratos/GraficosContratos';
import { calcularStatusContrato, filtrarContratosPorGestor } from '../../lib/contratos';

/**
 * Reaproveita os mesmos KPIs já exibidos dentro do módulo Gestão de
 * Contratos (Vigentes/Atenção/Vencidos/Valor Global) — qualquer usuário
 * do perfil Gestão de Contratos (Gestor "raiz" ou Auxiliar) vê todos os
 * contratos, sem distinção.
 */
export default function DashboardGestaoContratos() {
  const { contratos, usuarioAtual } = useApp();

  const contratosDoEscopo = filtrarContratosPorGestor(contratos, usuarioAtual);
  const contratosComStatus = contratosDoEscopo.map((contrato) => calcularStatusContrato(contrato));

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
          Nenhum contrato no seu escopo até o momento.
        </div>
      ) : (
        <GraficosContratos contratos={contratosComStatus} />
      )}
    </div>
  );
}
