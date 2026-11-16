import { useState } from 'react';
import { BarChart3, ClipboardList } from 'lucide-react';
import PainelProcessos from './dashboards/PainelProcessos';
import PainelPca from './dashboards/PainelPca';

/**
 * Dashboard: apenas o Painel de Processos e o Painel do PCA, para todos os
 * perfis (ambos já são de leitura liberada pelas regras do Firestore). Os
 * dashboards por módulo (Apoio, Contratos, Gestão, Fiscal, Executivo) foram
 * retirados daqui; os componentes continuam em ./dashboards, sem uso.
 */
export default function Dashboard() {
  const abas = [
    { id: 'painel-processos', nome: 'Painel de Processos', icon: BarChart3, Componente: PainelProcessos },
    { id: 'painel-pca', nome: 'Painel do PCA', icon: ClipboardList, Componente: PainelPca },
  ];

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
