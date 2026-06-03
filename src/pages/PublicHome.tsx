import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogIn, PieChart as PieChartIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import LoginModal from '../components/LoginModal';

export default function PublicHome() {
  const { processos, pcas, setores } = useApp();
  const [busca, setBusca] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Filtros
  const filtrados = processos.filter(p => {
    const term = busca.toLowerCase();
    const pcaVal = pcas.find(pca => pca.id === p.pca_id)?.codigo_pca.toLowerCase() || '';
    const setorVal = setores.find(s => s.id === p.fase_atual_id)?.nome.toLowerCase() || '';
    return p.numero_processo.toLowerCase().includes(term) ||
           p.objeto.toLowerCase().includes(term) ||
           p.unidade_demandante.toLowerCase().includes(term) ||
           setorVal.includes(term) ||
           (p.fonte && p.fonte.toLowerCase().includes(term)) ||
           pcaVal.includes(term);
  });

  const total = processos.length;
  const concluidos = processos.filter(p => p.status === 'concluido').length;
  const emAndamento = processos.filter(p => p.status === 'em_andamento').length;

  const dataStatus = [
    { name: 'Em Andamento', value: emAndamento },
    { name: 'Concluídos', value: concluidos },
    { name: 'Com Pendência', value: processos.filter(p => p.status === 'pendente').length },
  ];

  const dataFases = setores.map(s => ({
    name: s.sigla,
    Processos: processos.filter(p => p.fase_atual_id === s.id && p.status !== 'concluido').length
  }));

  const COLORS = ['#0284c7', '#059669', '#d97706'];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header Público */}
      <header className="bg-red-800 text-white shadow-md border-b-2 border-amber-400 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-stretch justify-between h-20 relative z-10">
          <div className="flex items-center h-full">
            <div className="bg-white flex items-center justify-center h-full pl-4 sm:pl-6 lg:pl-8 pr-4 shadow-sm w-fit relative">
              {/* Pseudo-elemento para preencher até a borda esquerda da tela */}
              <div className="absolute top-0 right-full w-[50vw] h-full bg-white" />
              <img src="/logo-qcg.png" alt="Logotipo QCG" className="w-14 h-14 object-contain relative z-10" />
            </div>
            <div className="flex flex-col justify-center ml-4">
              <span className="text-xl font-bold tracking-wide leading-tight">Sistema de Controle de Processos do CBMPA</span>
              <span className="text-xs font-semibold text-red-200 uppercase tracking-wider mt-0.5">Departamento Geral de Administração</span>
            </div>
          </div>
          <div className="flex items-center pr-4 sm:pr-6 lg:pr-8">
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center space-x-2 bg-white text-red-800 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              <span>Acessar Sistema</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        
        {/* Barra de Consulta */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Search className="w-6 h-6 mr-3 text-red-700" />
            Consulta Pública de Processos
          </h2>
          
          <div className="relative">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por número PAE, Objeto, Demandante, Localização (setor), Fonte ou Item do PCA..."
              className="w-full text-lg pl-12 pr-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
            />
            <Search className="absolute left-4 top-4.5 w-6 h-6 text-gray-400" />
          </div>

          {busca && (
             <div className="mt-6 overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processo / PAE</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objeto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Demandante</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor Atual</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtrados.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum processo encontrado.</td></tr>
                    ) : (
                      filtrados.map(p => {
                        const setorAtual = setores.find(s => s.id === p.fase_atual_id);
                        return (
                          <tr key={p.id}>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{p.numero_processo}</td>
                            <td className="px-6 py-4 text-sm text-gray-500 line-clamp-2 max-w-sm">{p.objeto}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.unidade_demandante}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{setorAtual?.nome}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {p.status.replace("_", " ").toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
               </table>
             </div>
          )}
        </section>

        {/* Dashboard Público */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <PieChartIcon className="w-6 h-6 mr-3 text-red-700" />
            Transparência / Dashboard
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-80 w-full border border-gray-100 rounded-lg p-4 pb-10">
              <h3 className="text-sm font-semibold text-gray-500 uppercase text-center mb-4">Volume por Setor</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataFases} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="Processos" fill="#b91c1c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="h-80 w-full border border-gray-100 rounded-lg p-4">
               <h3 className="text-sm font-semibold text-gray-500 uppercase text-center mb-4">Status Global dos Processos</h3>
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataStatus} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                    {dataStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>

      {isLoginModalOpen && (
        <LoginModal onClose={() => setIsLoginModalOpen(false)} />
      )}
    </div>
  );
}
