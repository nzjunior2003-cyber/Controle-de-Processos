import { useState } from 'react';
import { FileCheck, FileText, Package, CheckSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DashboardApoio from './dashboards/DashboardApoio';
import DashboardContratosArps from './dashboards/DashboardContratosArps';
import DashboardGestaoContratos from './dashboards/DashboardGestaoContratos';
import DashboardFiscalContrato from './dashboards/DashboardFiscalContrato';

/**
 * Dashboard Corporativo: um dashboard distinto por módulo, cada um com
 * as métricas próprias daquele módulo. Um usuário comum só vê o
 * dashboard do módulo ao qual está vinculado (perfil); o master vê
 * todos, em abas.
 */
export default function Dashboard() {
  const { usuarioAtual } = useApp();
  const perfil = usuarioAtual?.perfil;
  const isMaster = perfil === 'master';

  const abas = [
    { id: 'apoio', nome: 'Apoio e Suprimento', icon: Package, show: isMaster || perfil === 'apoio', Componente: DashboardApoio },
    { id: 'contratos-arps', nome: "Contratos e ARP's", icon: FileText, show: isMaster || perfil === 'contratos', Componente: DashboardContratosArps },
    { id: 'gestao-contratos', nome: 'Gestão de Contratos', icon: CheckSquare, show: isMaster || perfil === 'gestao', Componente: DashboardGestaoContratos },
    { id: 'fiscal-contrato', nome: 'Fiscal do Contrato', icon: FileCheck, show: isMaster || perfil === 'fiscal', Componente: DashboardFiscalContrato },
  ].filter((aba) => aba.show);

  const [abaAtiva, setAbaAtiva] = useState(abas[0]?.id);
  const abaSelecionada = abas.find((aba) => aba.id === abaAtiva) ?? abas[0];

  if (!abaSelecionada) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center text-gray-500">
        Nenhum dashboard disponível para o seu perfil ainda.
      </div>
    );
  }

  // Só um dashboard disponível (qualquer perfil que não seja master):
  // vai direto pro conteúdo, sem a barra de abas.
  if (abas.length === 1) {
    const { Componente } = abaSelecionada;
    return <Componente />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {abas.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                abaAtiva === aba.id
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <aba.icon className="w-4 h-4 mr-2" />
              {aba.nome}
            </button>
          ))}
        </nav>
      </div>

      <abaSelecionada.Componente />
    </div>
  );
}
