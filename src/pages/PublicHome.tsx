import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Search, LogIn, PieChart as PieChartIcon, FileText, FileCheck2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDb } from '../lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import LoginModal from '../components/LoginModal';

interface ItemBuscaPublica {
  id: string;
  tipo: 'processo' | 'contrato';
  numero: string;
  objeto: string;
  empresa?: string;
}

export default function PublicHome() {
  const { processos, setores } = useApp();
  const [busca, setBusca] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Índice público de busca (só número/objeto/empresa — nunca o
  // documento inteiro) — mantido por scripts/atualizar-busca-publica.mjs,
  // lido direto do Firestore sem precisar estar logado (a coleção
  // `busca_publica` tem leitura liberada nas regras pra esse fim).
  const [indice, setIndice] = useState<ItemBuscaPublica[]>([]);
  const [carregandoIndice, setCarregandoIndice] = useState(true);
  const [erroIndice, setErroIndice] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const db = getDb();
        if (!db) throw new Error('Firebase não configurado.');
        const snapshot = await getDocs(collection(db, 'busca_publica'));
        if (cancelado) return;
        setIndice(
          snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ItemBuscaPublica, 'id'>) })),
        );
      } catch (erro) {
        if (!cancelado) setErroIndice('Não foi possível carregar os dados de consulta pública no momento.');
        console.error('Erro ao carregar índice de busca pública:', erro);
      } finally {
        if (!cancelado) setCarregandoIndice(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const termo = busca.trim().toLowerCase();
  const resultados = termo
    ? indice.filter(
        (item) =>
          item.numero.toLowerCase().includes(termo) ||
          item.objeto.toLowerCase().includes(termo) ||
          (item.empresa ?? '').toLowerCase().includes(termo),
      )
    : [];

  // Dashboard de transparência (Volume por Setor / Status) só é
  // significativo pra quem está logado — visitante anônimo não tem
  // acesso aos dados completos de processos, então "processos"/"setores"
  // vêm sempre vazios aqui e essas seções somem sozinhas.
  const concluidos = processos.filter(p => p.status === 'concluido').length;
  const contratadosAditivados = processos.filter(p => p.status === 'contratado_aditivado').length;
  const emAndamento = processos.filter(p => p.status === 'em_andamento').length;

  const dataStatus = [
    { name: 'Em Andamento', value: emAndamento },
    { name: 'Contratado/Aditivado', value: contratadosAditivados },
    { name: 'Concluídos', value: concluidos },
    { name: 'Com Pendência', value: processos.filter(p => p.status === 'pendente').length },
  ];

  const dataFases = setores.map(s => ({
    name: s.sigla,
    Processos: processos.filter(p => p.fase_atual_id === s.id && p.status !== 'concluido' && p.status !== 'contratado_aditivado').length
  }));

  const COLORS = ['#0284c7', '#7c3aed', '#059669', '#d97706'];
  const mostrarDashboardInterno = processos.length > 0;

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

        {/* Barra de Consulta Pública, centralizada */}
        <section className="bg-white p-8 sm:p-10 rounded-xl shadow-sm border border-gray-200">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center justify-center">
              <Search className="w-6 h-6 mr-3 text-red-700" />
              Consulta Pública
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Busque um processo ou contrato pelo número ou pelo objeto.
            </p>

            <div className="relative">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o número ou o objeto do processo/contrato..."
                className="w-full text-lg pl-12 pr-4 py-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            </div>
            {carregandoIndice && (
              <p className="text-xs text-gray-400 mt-2">Carregando índice de consulta...</p>
            )}
            {erroIndice && <p className="text-xs text-red-600 mt-2">{erroIndice}</p>}
          </div>

          {termo && !carregandoIndice && (
            <div className="mt-8 max-w-3xl mx-auto text-left">
              {resultados.length === 0 ? (
                <p className="text-center text-gray-500 py-6">Nenhum processo ou contrato encontrado para &quot;{busca}&quot;.</p>
              ) : (
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {resultados.slice(0, 50).map((item) => (
                    <li key={item.id} className="p-4 hover:bg-gray-50 flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          item.tipo === 'processo' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.tipo === 'processo' ? (
                          <FileText className="w-3 h-3 mr-1" />
                        ) : (
                          <FileCheck2 className="w-3 h-3 mr-1" />
                        )}
                        {item.tipo === 'processo' ? 'Processo' : 'Contrato'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{item.numero}</p>
                        {item.empresa && <p className="text-sm text-gray-600">{item.empresa}</p>}
                        <p className="text-sm text-gray-500 line-clamp-2">{item.objeto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {resultados.length > 50 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Mostrando os primeiros 50 de {resultados.length} resultados — refine sua busca.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Dashboard interno (só visível quando já há sessão autenticada) */}
        {mostrarDashboardInterno && (
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
        )}
      </main>

      {isLoginModalOpen && (
        <LoginModal onClose={() => setIsLoginModalOpen(false)} />
      )}
    </div>
  );
}
