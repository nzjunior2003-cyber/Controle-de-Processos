import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, Filter, AlertCircle, FilePlus, Clock, Database, List, RefreshCw } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import IntegracaoPCA from './IntegracaoPCA';
import type { StatusProcesso } from '../types';

const STATUS_LABELS: Record<StatusProcesso, string> = {
  em_andamento: 'Em Andamento',
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

const STATUS_CORES: Record<StatusProcesso, string> = {
  em_andamento: 'bg-blue-50 text-blue-700 outline-blue-200',
  aprovado: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 outline-amber-200',
  concluido: 'bg-green-50 text-green-700 outline-green-200',
  arquivado: 'bg-gray-100 text-gray-600 outline-gray-300',
};

const URL_PLANILHA_PROCESSOS =
  'https://docs.google.com/spreadsheets/d/1deakLqP8-enEgY384EkFyYedgo5WYSONjvYIBJDwqXE/edit?usp=sharing';

export default function Aquisicoes() {
  const { processos, setores, usuarioAtual, syncProcessosDaPlanilha } = useApp();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [activeTab, setActiveTab] = useState<'processos' | 'pca'>('processos');
  const [sincronizando, setSincronizando] = useState(false);

  const [filtroTempo, setFiltroTempo] = useState<'todos' | 'verde' | 'amarelo' | 'vermelho'>('todos');

  const hoje = new Date();

  const filtrados = processos.filter(p => {
    const matchBusca = p.numero_processo.toLowerCase().includes(busca.toLowerCase()) || 
      p.objeto.toLowerCase().includes(busca.toLowerCase());
      
    if (!matchBusca) return false;
    
    if (filtroTempo === 'todos') return true;
    
    const dias = p.ultima_tramitacao ? Math.max(0, differenceInDays(hoje, new Date(p.ultima_tramitacao))) : 0;
    if (filtroTempo === 'verde' && dias < 10) return true;
    if (filtroTempo === 'amarelo' && dias >= 10 && dias <= 20) return true;
    if (filtroTempo === 'vermelho' && dias > 20) return true;
    
    return false;
  });
  
  const contagemTempo = processos.reduce(
    (acc, proc) => {
      const dias = proc.ultima_tramitacao ? Math.max(0, differenceInDays(hoje, new Date(proc.ultima_tramitacao))) : 0;
      if (dias < 10) acc.verde++;
      else if (dias <= 20) acc.amarelo++;
      else acc.vermelho++;
      return acc;
    },
    { verde: 0, amarelo: 0, vermelho: 0 }
  );

  const isMasterOrApoio = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'apoio';

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await syncProcessosDaPlanilha(URL_PLANILHA_PROCESSOS);
      alert(
        `Sincronização concluída: ${resultado.criados} processo(s) novo(s), ` +
          `${resultado.atualizados} atualizado(s)` +
          (resultado.ignorados > 0 ? `, ${resultado.ignorados} linha(s) ignorada(s) (sem número).` : '.'),
      );
    } catch (erro) {
      alert(
        'Erro ao sincronizar a planilha: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apoio e Suprimento</h1>
          <p className="mt-1 text-sm text-gray-500">Gestão de aquisições e controle do PCA</p>
        </div>
        {isMasterOrApoio && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              title="Atualiza os processos com os dados mais recentes da planilha de controle"
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`-ml-1 mr-2 h-5 w-5 ${sincronizando ? 'animate-spin' : ''}`} />
              {sincronizando ? 'Sincronizando...' : 'Sincronizar Planilha'}
            </button>
            <Link
              to="/sistema/processos/novo"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <FilePlus className="-ml-1 mr-2 h-5 w-5" />
              Novo Processo
            </Link>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('processos')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'processos'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List className="w-5 h-5 mr-2" />
            Acompanhamento de Processos
          </button>
          <button
            onClick={() => setActiveTab('pca')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'pca'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="w-5 h-5 mr-2" />
            Integração PCA
          </button>
        </nav>
      </div>

      {activeTab === 'processos' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div 
               onClick={() => setFiltroTempo(filtroTempo === 'verde' ? 'todos' : 'verde')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-emerald-500 cursor-pointer transition-colors ${filtroTempo === 'verde' ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Menos de 10 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.verde}</h3>
                  </div>
                  <Clock className="w-5 h-5 text-emerald-500" />
               </div>
             </div>
             <div 
               onClick={() => setFiltroTempo(filtroTempo === 'amarelo' ? 'todos' : 'amarelo')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-amber-500 cursor-pointer transition-colors ${filtroTempo === 'amarelo' ? 'ring-2 ring-amber-500 bg-amber-50 border-amber-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">10 a 20 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.amarelo}</h3>
                  </div>
                  <Clock className="w-5 h-5 text-amber-500" />
               </div>
             </div>
             <div 
               onClick={() => setFiltroTempo(filtroTempo === 'vermelho' ? 'todos' : 'vermelho')}
               className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-red-600 cursor-pointer transition-colors ${filtroTempo === 'vermelho' ? 'ring-2 ring-red-500 bg-red-50 border-red-200' : 'border-gray-200 hover:bg-gray-50'}`}
             >
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mais de 20 dias no setor</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{contagemTempo.vermelho}</h3>
                  </div>
                  <AlertCircle className="w-5 h-5 text-red-600" />
               </div>
             </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative flex-1 w-full max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
                  placeholder="Buscar número ou objeto"
                />
              </div>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                Filtros
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="w-[13%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nº PAE
                    </th>
                    <th scope="col" className="w-[30%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Objeto
                    </th>
                    <th scope="col" className="w-[24%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Setor Atual
                    </th>
                    <th scope="col" className="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rito
                    </th>
                    <th scope="col" className="w-[9%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dias no Setor
                    </th>
                    <th scope="col" className="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        Nenhum processo encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((proc) => {
                      const diasNoSetor = proc.ultima_tramitacao
                        ? Math.max(0, differenceInDays(hoje, new Date(proc.ultima_tramitacao)))
                        : null;
                      return (
                        <tr
                          key={proc.id}
                          onClick={() => navigate(`/sistema/processos/${proc.id}`)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              {proc.possui_alerta && (
                                <AlertCircle className="h-4 w-4 text-amber-500 mr-1.5 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-gray-900 truncate" title={proc.numero_processo}>
                                {proc.numero_processo}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900 line-clamp-2" title={proc.objeto}>
                              {proc.objeto}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div
                              className="text-sm text-gray-900 line-clamp-2"
                              title={proc.localizacao_atual}
                            >
                              {proc.localizacao_atual || setores.find(s => s.id === proc.fase_atual_id)?.sigla}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-700 truncate" title={proc.rito_processual}>
                              {proc.rito_processual || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-900">
                              {diasNoSetor === null ? '-' : `${diasNoSetor}d`}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium outline outline-1 outline-offset-1 ${STATUS_CORES[proc.status]}`}
                            >
                              {STATUS_LABELS[proc.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination placeholder */}
            <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Mostrando <span className="font-medium">1</span> a <span className="font-medium">{filtrados.length}</span> de <span className="font-medium">{filtrados.length}</span> resultados
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <IntegracaoPCA />
      )}
    </div>
  );
}
