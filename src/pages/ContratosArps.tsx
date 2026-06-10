import React, { useState } from 'react';
import { 
  Search, Filter, PlusCircle, BookOpen, 
  FileText, Calendar, Building, Megaphone, ShieldCheck,
  Scale, BadgeCheck, FileWarning, X, ExternalLink, ChevronDown, ChevronUp, FilePlus, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../context/AppContext';
import { useMilitares } from '../hooks/useMilitares';
import { MilitarAutocomplete } from '../components/MilitarAutocomplete';

// Mocks para Contratos
const initialContratosMock: any[] = [];

// Mocks para Pregões, Dispensas, etc.
const initialProcedimentosMock: any[] = [];

// Mocks para Processos Sancionatórios
const initialSancionatoriosMock: any[] = [];

// Mocks para Portarias de Fiscais
const initialPortariasMock: any[] = [];

export default function ContratosArps() {
  const { processos, pcas, usuarioAtual } = useApp();
  const { militares } = useMilitares();
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'contratos' | 'pregoes' | 'inexigibilidades' | 'dispensas' | 'adesoes' | 'participe' | 'sancionatorios' | 'portarias'>('contratos');

  const isMasterOrContratos = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'contratos';

  const [contratos, setContratos] = useState(initialContratosMock);
  const [expandedContrato, setExpandedContrato] = useState<string | null>(null);

  const [procedimentos, setProcedimentos] = useState(initialProcedimentosMock);
  const [expandedProcedimento, setExpandedProcedimento] = useState<string | null>(null);
  
  const [sancionatorios, setSancionatorios] = useState(initialSancionatoriosMock);
  const [expandedSancionatorio, setExpandedSancionatorio] = useState<string | null>(null);
  
  const [portarias, setPortarias] = useState(initialPortariasMock);
  const [expandedPortaria, setExpandedPortaria] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const getPcaTitleByProcesso = (numero_processo: string) => {
    const proc = processos.find(p => p.numero_processo === numero_processo);
    if (proc && proc.pca_id) {
      const pca = pcas.find(p => p.id === proc.pca_id);
      if (pca) {
        return pca.codigo_pca;
      }
    }
    return null;
  };

  const menuLateral = [
    { id: 'contratos', nome: 'Contratos e ARPs', icone: FileText, color: 'emerald-500', bgClass: 'bg-emerald-50/50', borderLClass: 'border-l-emerald-500', ringClass: 'ring-emerald-500', borderClass: 'border-emerald-200', textClass: 'text-emerald-500', textThemeClass: 'text-emerald-800', textNumClass: 'text-emerald-900' },
    { id: 'pregoes', nome: 'Pregões', icone: FileText, color: 'red-600', bgClass: 'bg-red-50/50', borderLClass: 'border-l-red-600', ringClass: 'ring-red-600', borderClass: 'border-red-200', textClass: 'text-red-600', textThemeClass: 'text-red-800', textNumClass: 'text-red-900' },
    { id: 'inexigibilidades', nome: 'Inexigibilidades', icone: BadgeCheck, color: 'blue-500', bgClass: 'bg-blue-50/50', borderLClass: 'border-l-blue-500', ringClass: 'ring-blue-500', borderClass: 'border-blue-200', textClass: 'text-blue-500', textThemeClass: 'text-blue-800', textNumClass: 'text-blue-900' },
    { id: 'dispensas', nome: 'Dispensas', icone: Building, color: 'amber-500', bgClass: 'bg-amber-50/50', borderLClass: 'border-l-amber-500', ringClass: 'ring-amber-500', borderClass: 'border-amber-200', textClass: 'text-amber-500', textThemeClass: 'text-amber-800', textNumClass: 'text-amber-900' },
    { id: 'adesoes', nome: 'Adesões', icone: FilePlus, color: 'teal-500', bgClass: 'bg-teal-50/50', borderLClass: 'border-l-teal-500', ringClass: 'ring-teal-500', borderClass: 'border-teal-200', textClass: 'text-teal-500', textThemeClass: 'text-teal-800', textNumClass: 'text-teal-900' },
    { id: 'participe', nome: 'Partícipe', icone: Users, color: 'indigo-500', bgClass: 'bg-indigo-50/50', borderLClass: 'border-l-indigo-500', ringClass: 'ring-indigo-500', borderClass: 'border-indigo-200', textClass: 'text-indigo-500', textThemeClass: 'text-indigo-800', textNumClass: 'text-indigo-900' },
    { id: 'sancionatorios', nome: 'Sancionatórios', icone: FileWarning, color: 'purple-500', bgClass: 'bg-purple-50/50', borderLClass: 'border-l-purple-500', ringClass: 'ring-purple-500', borderClass: 'border-purple-200', textClass: 'text-purple-500', textThemeClass: 'text-purple-800', textNumClass: 'text-purple-900' },
    { id: 'portarias', nome: 'Portarias de Fiscais', icone: BookOpen, color: 'gray-500', bgClass: 'bg-gray-50/50', borderLClass: 'border-l-gray-500', ringClass: 'ring-gray-500', borderClass: 'border-gray-200', textClass: 'text-gray-500', textThemeClass: 'text-gray-800', textNumClass: 'text-gray-900' },
  ] as const;

  const autoProcedimentos = processos
    .filter(p => {
      if (procedimentos.some(proc => proc.pae === p.numero_processo)) return false;
      return p.rito_processual === 'Adesão ARP' || 
             p.rito_processual === 'Gerenciador da ARP' || 
             p.rito_processual === 'Partícipe de ARP' ||
             p.rito_processual?.includes('Pregão') ||
             p.rito_processual?.includes('Dispensa') ||
             p.rito_processual?.includes('Inexigibilidade');
    })
    .map(p => {
      let modalidade = '';
      if (p.rito_processual === 'Adesão ARP') modalidade = 'Adesão';
      else if (p.rito_processual === 'Gerenciador da ARP') modalidade = 'Pregão Eletrônico (Gerenciador)';
      else if (p.rito_processual === 'Partícipe de ARP') modalidade = 'Partícipe';
      else if (p.rito_processual?.includes('Pregão')) modalidade = 'Pregão Eletrônico';
      else if (p.rito_processual?.includes('Dispensa')) modalidade = 'Dispensa';
      else if (p.rito_processual?.includes('Inexigibilidade')) modalidade = 'Inexigibilidade';
      
      return {
        id: `auto-${p.id}`,
        pae: p.numero_processo,
        numero: 'Aguardando',
        modalidade,
        objeto: p.objeto,
        fase: 'Pendente',
        dataPublicacao: '-',
        previsaoAbertura: '-',
        isAuto: true
      };
    });

  const todosProcedimentos = [...procedimentos, ...autoProcedimentos] as any[];

  const filtrarProcedimentos = (busca: string, tipoModalidade: string) => {
    return todosProcedimentos.filter(p => 
      p.modalidade.toLowerCase().includes(tipoModalidade.toLowerCase()) &&
      (p.modalidade.toLowerCase().includes(busca.toLowerCase()) ||
       p.numero.includes(busca) ||
       p.objeto.toLowerCase().includes(busca.toLowerCase()) ||
       p.pae.includes(busca))
    );
  };

  const pregoesFiltrados = filtrarProcedimentos(busca, 'Pregão');
  const inexigibilidadesFiltradas = filtrarProcedimentos(busca, 'Inexigibilidade');
  const dispensasFiltradas = filtrarProcedimentos(busca, 'Dispensa');
  const adesoesFiltradas = filtrarProcedimentos(busca, 'Adesão');
  const participesFiltradas = filtrarProcedimentos(busca, 'Partícipe');

  const sancionatoriosFiltrados = sancionatorios.filter(s => 
    s.empresa.toLowerCase().includes(busca.toLowerCase()) ||
    s.processo.includes(busca) ||
    s.motivo.toLowerCase().includes(busca.toLowerCase()) ||
    s.fase.toLowerCase().includes(busca.toLowerCase())
  );

  const portariasFiltradas = portarias.filter(p => 
    p.empresa.toLowerCase().includes(busca.toLowerCase()) ||
    p.contrato.includes(busca) ||
    p.fiscalTitular.toLowerCase().includes(busca.toLowerCase()) ||
    p.portaria.includes(busca)
  );

  const contratosFiltrados = contratos.filter(c => 
    c.numero.includes(busca) ||
    c.objeto.toLowerCase().includes(busca.toLowerCase()) ||
    c.fornecedor.toLowerCase().includes(busca.toLowerCase())
  );

  const renderTabelaContratos = (dados: typeof contratos) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PAE / Contrato</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa / Objeto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vigência</th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Global</th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acesso ao Contrato</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const isExpanded = expandedContrato === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-emerald-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => setExpandedContrato(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-emerald-700 group-hover:text-emerald-900 flex items-center gap-1">
                        Nº {item.numero}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">PAE: {item.pae}</span>
                    </button>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-sm font-medium text-gray-900 truncate" title={item.fornecedor}>{item.fornecedor}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{format(new Date(item.vigenciaInicio), 'dd/MM/yyyy')} a</div>
                    <div>{format(new Date(item.vigenciaFim), 'dd/MM/yyyy')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                    <button 
                      onClick={() => item.linkContrato && window.open(item.linkContrato, '_blank')}
                      disabled={!item.linkContrato}
                      className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm text-xs font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Acessar Contrato
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-emerald-50/10">
                    <td colSpan={5} className="px-6 py-4 border-b border-emerald-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm bg-white p-4 rounded-lg border border-emerald-100 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Fornecedor / CNPJ</span>
                            <div className="text-gray-700">{item.fornecedor}</div>
                            <div className="text-gray-500 text-xs">{item.cnpj}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Contatos Fornecedor</span>
                            <div className="text-gray-700">{item.contatoEmail}</div>
                            <div className="text-gray-700">{item.contatoTelefone}</div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Fiscalização</span>
                            <div className="text-gray-700 block mb-2">Titular: <span className="font-medium">{item.fiscalTitular}</span><br/><span className="text-xs text-gray-500">{item.fiscalTitularContato}</span></div>
                            <div className="text-gray-700">Suplente: <span className="font-medium">{item.fiscalSuplente}</span><br/><span className="text-xs text-gray-500">{item.fiscalSuplenteContato}</span></div>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Dados Orçamentários</span>
                            <div className="text-gray-700">Fonte: {item.fonte}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {dados.length === 0 && (
             <tr>
               <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum contrato encontrado.</td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderTabelaProcedimentos = (dados: typeof procedimentos) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processo / Modalidade</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objeto</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fase Atual</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cronograma</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dados.map((item) => {
            const pcaIdCode = getPcaTitleByProcesso(item.pae);
            const isExpanded = expandedProcedimento === item.id;
            return (
              <React.Fragment key={item.id}>
                <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-red-50/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => setExpandedProcedimento(isExpanded ? null : item.id)}
                      className="text-left group flex flex-col focus:outline-none"
                    >
                      <span className="text-sm font-bold text-gray-900 group-hover:text-red-700 flex items-center gap-1">
                        {item.modalidade} {item.numero}
                        {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">PAE: {item.pae}</span>
                    </button>
                    {pcaIdCode && (
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        PCA: {pcaIdCode}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-sm">
                    <div className="text-sm text-gray-900 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.fase}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div><span className="font-medium">Publicação:</span> {item.dataPublicacao !== '-' ? format(new Date(item.dataPublicacao), 'dd/MM/yyyy') : '-'}</div>
                    <div className="mt-1"><span className="font-medium">Abertura:</span> {item.previsaoAbertura !== '-' ? format(new Date(item.previsaoAbertura), 'dd/MM/yyyy') : '-'}</div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-red-50/10">
                    <td colSpan={4} className="px-6 py-4 border-b border-red-100">
                      <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-red-100 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <span className="font-semibold text-gray-900 block mb-1">Detalhes do Procedimento</span>
                            <div className="text-sm text-gray-700">{item.objeto}</div>
                          </div>
                          <div className="flex gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500 block">Modalidade</span>
                              <span className="text-gray-900">{item.modalidade}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">Número</span>
                              <span className="text-gray-900">{item.numero}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-500 block">PAE</span>
                              <span className="text-gray-900">{item.pae}</span>
                            </div>
                          </div>
                        </div>
                        {isMasterOrContratos && (
                          <button 
                            onClick={() => { setFormData(item); setModalOpen(true); }}
                            className="text-white bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                          >
                            Editar Procedimento
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {dados.length === 0 && (
             <tr>
               <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum registro encontrado.</td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSalvarRegistro = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    
    if (abaAtiva === 'sancionatorios') {
      setSancionatorios([...sancionatorios, { ...formData, id: newId } as any]);
    } else if (abaAtiva === 'portarias') {
      setPortarias([...portarias, { ...formData, id: newId } as any]);
    } else {
      let modalidade = formData.modalidade;
      if (!modalidade) {
        if (abaAtiva === 'pregoes') modalidade = 'Pregão Eletrônico';
        else if (abaAtiva === 'inexigibilidades') modalidade = 'Inexigibilidade';
        else if (abaAtiva === 'dispensas') modalidade = 'Dispensa';
        else if (abaAtiva === 'adesoes') modalidade = 'Adesão';
        else if (abaAtiva === 'participe') modalidade = 'Partícipe';
      }
      const linkedProcesso = processos.find(p => p.numero_processo === formData.pae);
      const dataToSave = { 
        ...formData, 
        id: newId, 
        modalidade, 
        objeto: formData.objeto || linkedProcesso?.objeto || 'Objeto não informado' 
      };
      setProcedimentos([...procedimentos, dataToSave as any]);
    }
    
    setModalOpen(false);
    setFormData({});
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos e ARP's</h1>
          <p className="mt-1 text-sm text-gray-500">Gestão de pregões, dispensas, inexigibilidades e portarias.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {menuLateral.map((item) => {
          const Icone = item.icone;
          const isAtivo = abaAtiva === item.id;
          
          let count = 0;
          if (item.id === 'contratos') count = contratosFiltrados.length;
          else if (item.id === 'pregoes') count = pregoesFiltrados.length;
          else if (item.id === 'inexigibilidades') count = inexigibilidadesFiltradas.length;
          else if (item.id === 'dispensas') count = dispensasFiltradas.length;
          else if (item.id === 'sancionatorios') count = sancionatoriosFiltrados.length;
          else if (item.id === 'portarias') count = portariasFiltradas.length;

          const colorTheme = item.color.split('-')[0];

          return (
            <div
              key={item.id}
              onClick={() => setAbaAtiva(item.id)}
              className={`bg-white p-4 rounded-lg border shadow-sm border-l-4 ${item.borderLClass} cursor-pointer transition-colors relative ${
                isAtivo 
                  ? `ring-1 ${item.ringClass} ${item.bgClass} ${item.borderClass}` 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider line-clamp-2 ${isAtivo ? item.textThemeClass : 'text-gray-500'}`} title={item.nome}>
                    {item.nome}
                  </span>
                  <Icone className={`h-5 w-5 flex-shrink-0 ${isAtivo ? item.textClass : 'text-gray-400'}`} />
                </div>
                <span className={`text-2xl font-bold ${isAtivo ? item.textNumClass : 'text-gray-900'}`}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 space-y-4">
          <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full max-w-lg">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
                placeholder="Pesquisar..."
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                Filtros
              </button>
              {abaAtiva !== 'contratos' && isMasterOrContratos && (
                <button 
                  onClick={() => { 
                    setFormData(abaAtiva === 'portarias' ? { portaria: `00${Math.floor(Math.random() * 10) + 1}/${new Date().getFullYear()}-DP` } : {}); 
                    setModalOpen(true); 
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
                >
                  <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
                  {abaAtiva === 'pregoes' ? 'Novo Pregão' :
                   abaAtiva === 'inexigibilidades' ? 'Nova Inexigibilidade' :
                   abaAtiva === 'dispensas' ? 'Nova Dispensa' :
                   abaAtiva === 'adesoes' ? 'Nova Adesão' :
                   abaAtiva === 'participe' ? 'Novo Partícipe' :
                   abaAtiva === 'sancionatorios' ? 'Novo Processo' :
                   'Nova Portaria'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            {abaAtiva === 'contratos' && renderTabelaContratos(contratosFiltrados)}
            {abaAtiva === 'pregoes' && renderTabelaProcedimentos(pregoesFiltrados)}
            {abaAtiva === 'inexigibilidades' && renderTabelaProcedimentos(inexigibilidadesFiltradas)}
            {abaAtiva === 'dispensas' && renderTabelaProcedimentos(dispensasFiltradas)}
            {abaAtiva === 'adesoes' && renderTabelaProcedimentos(adesoesFiltradas)}
            {abaAtiva === 'participe' && renderTabelaProcedimentos(participesFiltradas)}

            {abaAtiva === 'sancionatorios' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processo / Empresa</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fase</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abertura</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sancionatoriosFiltrados.map((item) => {
                      const isExpanded = expandedSancionatorio === item.id;
                      return (
                      <React.Fragment key={item.id}>
                        <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-orange-50/20' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <button 
                               onClick={() => setExpandedSancionatorio(isExpanded ? null : item.id)}
                               className="text-left group flex flex-col focus:outline-none"
                             >
                               <span className="text-sm font-bold text-gray-900 group-hover:text-orange-700 flex items-center gap-1">
                                 {item.processo}
                                 {isExpanded ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                               </span>
                               <span className="text-sm text-gray-500">{item.empresa}</span>
                             </button>
                          </td>
                          <td className="px-6 py-4 max-w-sm">
                             <div className="text-sm text-gray-900 line-clamp-2">{item.motivo}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {item.fase}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(item.dataAbertura), 'dd/MM/yyyy')}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-orange-50/10">
                            <td colSpan={4} className="px-6 py-4 border-b border-orange-100">
                              <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-orange-100 shadow-sm">
                                <div className="space-y-4 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-900 block mb-1">Motivo do Processo</span>
                                    <div className="text-gray-700">{item.motivo}</div>
                                  </div>
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="font-medium text-gray-500 block">Empresa</span>
                                      <span className="text-gray-900">{item.empresa}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500 block">Processo</span>
                                      <span className="text-gray-900">{item.processo}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500 block">Fase Atual</span>
                                      <span className="text-gray-900">{item.fase}</span>
                                    </div>
                                  </div>
                                </div>
                                {isMasterOrContratos && (
                                  <button 
                                    onClick={() => { setFormData(item); setModalOpen(true); }}
                                    className="text-white bg-orange-600 hover:bg-orange-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                                  >
                                    Editar Sancionatório
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )})}
                    {sancionatoriosFiltrados.length === 0 && (
                       <tr>
                         <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum registro encontrado.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {abaAtiva === 'portarias' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Portaria</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato / Empresa</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiscal Titular</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publicação</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {portariasFiltradas.map((item) => {
                      const isExpanded = expandedPortaria === item.id;
                      return (
                      <React.Fragment key={item.id}>
                        <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <button 
                               onClick={() => setExpandedPortaria(isExpanded ? null : item.id)}
                               className="text-left group flex flex-col focus:outline-none"
                             >
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 group-hover:bg-slate-200 transition-colors">
                                 Portaria {item.portaria}
                                 {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                               </span>
                             </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                             <div className="text-sm font-bold text-gray-900">Contrato {item.contrato}</div>
                             <div className="text-sm text-gray-500">{item.empresa}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                             <div className="text-sm font-medium text-gray-900">{item.fiscalTitular}</div>
                             <div className="text-xs text-gray-500 mt-1">{item.fiscalEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(item.dataPublicacao), 'dd/MM/yyyy')}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan={4} className="px-6 py-4 border-b border-slate-200">
                              <div className="flex justify-between items-start bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="space-y-4 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-900 block mb-1">Detalhes da Portaria</span>
                                    <div className="text-gray-700">Portaria {item.portaria} publicada em {format(new Date(item.dataPublicacao), 'dd/MM/yyyy')} para o Contrato {item.contrato} ({item.empresa}).</div>
                                  </div>
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="font-medium text-gray-500 block">Fiscal Titular</span>
                                      <span className="text-gray-900">{item.fiscalTitular}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-500 block">E-mail</span>
                                      <span className="text-gray-900">{item.fiscalEmail}</span>
                                    </div>
                                  </div>
                                </div>
                                {isMasterOrContratos && (
                                  <button 
                                    onClick={() => { setFormData(item); setModalOpen(true); }}
                                    className="text-white bg-slate-600 hover:bg-slate-700 px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors whitespace-nowrap"
                                  >
                                    Editar Portaria
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )})}
                    {portariasFiltradas.length === 0 && (
                       <tr>
                         <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Nenhum registro encontrado.</td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 overflow-hidden bg-gray-500 bg-opacity-75" onClick={() => setModalOpen(false)}>
          <div className="relative bg-white sm:rounded-lg shadow-xl w-full max-w-[100vw] sm:max-w-[95vw] h-full sm:max-h-[95vh] p-4 sm:p-6 text-left transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sm:mb-5 flex-shrink-0">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {abaAtiva === 'sancionatorios' && 'Novo Processo Sancionatório'}
                {abaAtiva === 'portarias' && 'Nova Portaria de Fiscal'}
                {(abaAtiva === 'pregoes' || abaAtiva === 'inexigibilidades' || abaAtiva === 'dispensas' || abaAtiva === 'adesoes' || abaAtiva === 'participe') && 'Novo Procedimento'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-2">
              {(abaAtiva === 'pregoes' || abaAtiva === 'inexigibilidades' || abaAtiva === 'dispensas' || abaAtiva === 'adesoes' || abaAtiva === 'participe') && (
                <>
                  <div className="border-b border-gray-200 pb-5">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Processo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 flex items-end justify-between border-b border-gray-100 pb-4">
                        <div className="flex-1 mr-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nº PAE</label>
                          <input 
                            type="text" 
                            name="pae" 
                            value={formData.pae || ''} 
                            onChange={handleInputChange} 
                            list="processos-list"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" 
                            placeholder="Selecione ou digite o PAE..."
                          />
                          <datalist id="processos-list">
                            {processos.map((p) => (
                              <option key={p.id} value={p.numero_processo}>
                                {p.rito_processual ? `${p.rito_processual} - ${p.objeto}` : p.objeto}
                              </option>
                            ))}
                          </datalist>
                        </div>
                        {abaAtiva === 'pregoes' && (
                          <div className="flex items-center mb-2">
                            <input
                              id="registroPrecos"
                              name="registroPrecos"
                              type="checkbox"
                              checked={formData.registroPrecos || false}
                              onChange={(e) => setFormData({ ...formData, registroPrecos: e.target.checked })}
                              className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <label htmlFor="registroPrecos" className="ml-2 block text-sm font-medium text-gray-900 whitespace-nowrap">
                              SRP (Registro de Preços)
                            </label>
                          </div>
                        )}
                      </div>
                      
                      {(() => {
                        const linkedProcesso = processos.find(p => p.numero_processo === formData.pae);
                        const linkedPca = linkedProcesso?.pca_id ? pcas.find(pca => pca.id === linkedProcesso.pca_id) : null;
                        const valorFormatado = linkedPca?.valor_previsto ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(linkedPca.valor_previsto) : '';
                        
                        return (
                          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-l-4 border-blue-500 pl-4 py-3 bg-blue-50/50 rounded-r-md">
                            <div className="sm:col-span-1">
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Demandante</label>
                              <input type="text" value={linkedProcesso?.unidade_demandante || ''} className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium" placeholder="Vinculado automaticamente" readOnly />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Objeto</label>
                              <input type="text" value={linkedProcesso?.objeto || ''} className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium truncate" title={linkedProcesso?.objeto} placeholder="Vinculado automaticamente" readOnly />
                            </div>
                            <div className="sm:col-span-1">
                               <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte / Dotação Orçamentária</label>
                               <input type="text" value={linkedPca?.fonte_recurso || linkedProcesso?.fonte || ''} className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium" placeholder="Vinculado automaticamente" readOnly />
                            </div>
                            <div className="sm:col-span-1">
                               <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Estimado</label>
                               <input type="text" value={valorFormatado} className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium" placeholder="Vinculado automaticamente" readOnly />
                            </div>
                            <div className="sm:col-span-1">
                               <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Nº do Parecer / BG</label>
                               <input type="text" className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium" placeholder="Vinculado automaticamente" readOnly />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="border-b border-gray-200 pb-5">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Publicação e Homologação</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {abaAtiva === 'pregoes' ? 'Nº do Edital' : (abaAtiva === 'adesoes' || abaAtiva === 'participe') ? 'Nº da ARP' : abaAtiva === 'dispensas' ? 'Nº do Aviso/Adesão' : 'Nº do Termo de Inexigibilidade'}
                        </label>
                        <input type="text" name="documento_referencia" value={formData.documento_referencia || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      
                      {(abaAtiva === 'adesoes' || abaAtiva === 'participe') && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Órgão Gerenciador/UF</label>
                            <input type="text" name="orgaoGerenciador" value={formData.orgaoGerenciador || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Vigência da ARP</label>
                            <input type="date" name="vigenciaArp" value={formData.vigenciaArp || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                        </>
                      )}

                      {abaAtiva !== 'participe' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{abaAtiva === 'adesoes' ? 'Data da Adesão' : 'Data de Publicação'}</label>
                          <input type="date" name="dataPublicacao" value={formData.dataPublicacao || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">DOE</label>
                        <input type="text" name="doe" value={formData.doe || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>

                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Link PNCP</label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <input type="url" name="linkPncp" placeholder="https://" value={formData.linkPncp || ''} onChange={handleInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                            <button type="button" onClick={() => formData.linkPncp && window.open(formData.linkPncp, '_blank')} disabled={!formData.linkPncp} className="inline-flex items-center px-4 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Acessar
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Link Compras GOV</label>
                          <div className="mt-1 flex rounded-md shadow-sm">
                            <input type="url" name="linkComprasGov" placeholder="https://" value={formData.linkComprasGov || ''} onChange={handleInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                            <button type="button" onClick={() => formData.linkComprasGov && window.open(formData.linkComprasGov, '_blank')} disabled={!formData.linkComprasGov} className="inline-flex items-center px-4 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Acessar
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pt-4 border-t border-gray-100">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">{(abaAtiva === 'adesoes' || abaAtiva === 'participe') ? 'Fornecedor da ARP (CNPJ)' : 'Fornecedor Homologado (CNPJ)'}</label>
                            <input type="text" name="fornecedor" placeholder="Após homologação..." value={formData.fornecedor || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Valor Homologado</label>
                            <input type="text" name="valorHomologado" placeholder="R$ Após homologação..." value={formData.valorHomologado || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                        </div>
                    </div>
                  </div>

                  {abaAtiva === 'pregoes' && formData.registroPrecos ? (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-base font-medium text-gray-900 flex-1">Atas de Registro de Preço (ARP) e Contratos</h4>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => {
                            const add = { id: Math.random().toString(), tipo: 'ARP', numero: '', doe: '', bg: '', vigenciaFim: '', link: '' };
                            setFormData({ ...formData, instrumentosDerivados: [...(formData.instrumentosDerivados || []), add] });
                          }} className="text-sm px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium whitespace-nowrap">
                            + Adicionar ARP
                          </button>
                          <button type="button" onClick={() => {
                            const add = { id: Math.random().toString(), tipo: 'CONTRATO', numero: '', origem: '', bg: '', vigenciaFim: '', link: '' };
                            setFormData({ ...formData, instrumentosDerivados: [...(formData.instrumentosDerivados || []), add] });
                          }} className="text-sm px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium whitespace-nowrap">
                            + Adicionar Contrato
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {(formData.instrumentosDerivados || []).map((inst: any, idx: number) => (
                          <div key={idx} className={`p-4 border rounded-md relative ${inst.tipo === 'ARP' ? 'bg-red-50/30 border-red-200' : 'bg-blue-50/30 border-blue-200'}`}>
                            <button type="button" onClick={() => {
                              const newInst = [...formData.instrumentosDerivados];
                              newInst.splice(idx, 1);
                              setFormData({ ...formData, instrumentosDerivados: newInst });
                            }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                              <X className="w-5 h-5" />
                            </button>
                            <h5 className="text-sm font-bold text-gray-800 mb-2">{inst.tipo === 'ARP' ? 'Ata de Registro de Preço' : 'Contrato'}</h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Nº do Documento</label>
                                <input type="text" value={inst.numero} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].numero = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              {inst.tipo === 'CONTRATO' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700">Origem (Nº da ARP / Pregão)</label>
                                  <input type="text" value={inst.origem || ''} onChange={(e) => {
                                    const newInst = [...formData.instrumentosDerivados];
                                    newInst[idx].origem = e.target.value;
                                    setFormData({ ...formData, instrumentosDerivados: newInst });
                                  }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                                </div>
                              )}
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fim Vigência</label>
                                <input type="date" value={inst.vigenciaFim || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].vigenciaFim = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-700">Link Acesso (Drive)</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                  <input type="url" placeholder="Cole o link do Google Drive aqui..." value={inst.link || ''} onChange={(e) => {
                                    const newInst = [...formData.instrumentosDerivados];
                                    newInst[idx].link = e.target.value;
                                    setFormData({ ...formData, instrumentosDerivados: newInst });
                                  }} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-1.5 px-3 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                                  <button type="button" onClick={() => inst.link && window.open(inst.link, '_blank')} disabled={!inst.link} className="inline-flex items-center px-3 py-1.5 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Acessar Documento
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!formData.instrumentosDerivados || formData.instrumentosDerivados.length === 0) && (
                          <p className="text-sm text-gray-500 italic py-3 text-center border rounded-md bg-gray-50">Nenhum instrumento adicionado. Clique nos botões acima para cadastrar.</p>
                        )}
                      </div>
                    </div>
                  ) : abaAtiva === 'pregoes' && !formData.registroPrecos ? (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Pregão</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Nº do Pregão</label>
                        <input type="text" name="numeroContrato" placeholder="Ex: 001/2026" value={formData.numeroContrato || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Nº DOE</label>
                        <input type="text" name="doeContrato" value={formData.doeContrato || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                         <label className="block text-sm font-medium text-gray-700">Fornecedores Homologados</label>
                         <button type="button" onClick={() => {
                           const add = { id: Math.random().toString(), cnpj: '', valor: '' };
                           setFormData({ ...formData, fornecedoresHomologados: [...(formData.fornecedoresHomologados || []), add] });
                         }} className="text-xs px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium">
                           + Adicionar Fornecedor
                         </button>
                      </div>
                      <div className="space-y-2">
                        {(formData.fornecedoresHomologados || []).map((forn: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input type="text" placeholder="CNPJ / Nome do Fornecedor" value={forn.cnpj} onChange={(e) => {
                               const newF = [...formData.fornecedoresHomologados];
                               newF[idx].cnpj = e.target.value;
                               setFormData({ ...formData, fornecedoresHomologados: newF });
                            }} className="flex-1 block border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                            <input type="text" placeholder="R$ Valor Homologado" value={forn.valor} onChange={(e) => {
                               const newF = [...formData.fornecedoresHomologados];
                               newF[idx].valor = e.target.value;
                               setFormData({ ...formData, fornecedoresHomologados: newF });
                            }} className="flex-1 block border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                            <button type="button" onClick={() => {
                               const newF = [...formData.fornecedoresHomologados];
                               newF.splice(idx, 1);
                               setFormData({ ...formData, fornecedoresHomologados: newF });
                            }} className="text-gray-400 hover:text-red-500">
                               <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 border-t border-gray-200 pt-5">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-base font-medium text-gray-900 flex-1">Dados do Contrato</h4>
                        <button type="button" onClick={() => {
                          const add = { id: Math.random().toString(), tipo: 'CONTRATO', numero: '', fornecedorIdx: '', valor: '', vigenciaInicio: '', vigenciaFim: '', prd: '', empenho: '', fiscalTitular: '', fiscalSuplente: '', link: '' };
                          setFormData({ ...formData, instrumentosDerivados: [...(formData.instrumentosDerivados || []), add] });
                        }} className="text-sm px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium whitespace-nowrap">
                          + Adicionar Contrato
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {(formData.instrumentosDerivados || []).map((inst: any, idx: number) => (
                          <div key={idx} className="p-4 border rounded-md relative bg-blue-50/30 border-blue-200">
                            <button type="button" onClick={() => {
                              const newInst = [...formData.instrumentosDerivados];
                              newInst.splice(idx, 1);
                              setFormData({ ...formData, instrumentosDerivados: newInst });
                            }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                              <X className="w-5 h-5" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-700">Nº do Contrato (nnnn/aaaa)</label>
                                <input type="text" value={inst.numero} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].numero = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fornecedor</label>
                                <select value={inst.fornecedorIdx} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].fornecedorIdx = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500">
                                  <option value="">Selecione um fornecedor</option>
                                  {(formData.fornecedoresHomologados || []).map((f: any, i: number) => (
                                    <option key={i} value={i}>{f.cnpj || `Fornecedor ${i+1}`}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Valor (Total/Item para saldo)</label>
                                <input type="text" value={inst.valor || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].valor = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Início da Vigência</label>
                                <input type="date" value={inst.vigenciaInicio || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].vigenciaInicio = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fim da Vigência</label>
                                <input type="date" value={inst.vigenciaFim || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].vigenciaFim = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Nº da PRD</label>
                                <input type="text" value={inst.prd || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].prd = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Nº do Empenho</label>
                                <input type="text" value={inst.empenho || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].empenho = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fiscal Titular</label>
                                <select value={inst.fiscalTitular || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].fiscalTitular = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500">
                                  <option value="">Selecione...</option>
                                  {portarias.map(p => (
                                    <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">Fiscal Suplente</label>
                                <select value={inst.fiscalSuplente || ''} onChange={(e) => {
                                  const newInst = [...formData.instrumentosDerivados];
                                  newInst[idx].fiscalSuplente = e.target.value;
                                  setFormData({ ...formData, instrumentosDerivados: newInst });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500">
                                  <option value="">Selecione...</option>
                                  {portarias.map(p => (
                                    <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                                  ))}
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-gray-700">Link Acesso (Drive)</label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                  <input type="url" placeholder="Cole o link do Google Drive aqui..." value={inst.link || ''} onChange={(e) => {
                                    const newInst = [...formData.instrumentosDerivados];
                                    newInst[idx].link = e.target.value;
                                    setFormData({ ...formData, instrumentosDerivados: newInst });
                                  }} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-1.5 px-3 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                                  <button type="button" onClick={() => inst.link && window.open(inst.link, '_blank')} disabled={!inst.link} className="inline-flex items-center px-3 py-1.5 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Acessar Documento
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!formData.instrumentosDerivados || formData.instrumentosDerivados.length === 0) && (
                          <p className="text-sm text-gray-500 italic py-3 text-center border rounded-md bg-gray-50">Nenhum contrato adicionado.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Contrato / ARP</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Nº do Contrato / ARP (nnnn/aaaa)</label>
                        <input type="text" name="numeroContrato" placeholder="Ex: 001/2026" value={formData.numeroContrato || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">DOE do Contrato</label>
                        <input type="text" name="doeContrato" value={formData.doeContrato || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">BG do Contrato</label>
                        <input type="text" name="bgContrato" value={formData.bgContrato || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Número da PRD</label>
                        <input type="text" name="prd" placeholder="Ex: PRD 123/2026" value={formData.prd || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Número do Empenho</label>
                        <input type="text" name="empenho" placeholder="Ex: 2026NE0001" value={formData.empenho || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Início da Vigência</label>
                        <input type="date" name="inicioVigencia" value={formData.inicioVigencia || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fim da Vigência</label>
                        <input type="date" name="fimVigencia" value={formData.fimVigencia || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Link de Acesso ao Contrato (Drive)</label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input type="url" name="linkContrato" placeholder="Cole o link do Google Drive aqui..." value={formData.linkContrato || ''} onChange={handleInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          <button type="button" onClick={() => formData.linkContrato && window.open(formData.linkContrato, '_blank')} disabled={!formData.linkContrato} className="inline-flex items-center px-4 py-2 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Acessar Documento
                          </button>
                        </div>
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Fiscal Titular</label>
                        <select name="fiscal" value={formData.fiscal || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm">
                          <option value="">Selecione...</option>
                          {portarias.map(p => (
                            <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Fiscal Suplente</label>
                        <select name="suplente" value={formData.suplente || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm">
                          <option value="">Selecione...</option>
                          {portarias.map(p => (
                            <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                  
                    <div className="mt-6 border-t border-gray-200 pt-5">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-base font-medium text-gray-900">{(abaAtiva === 'adesoes' || abaAtiva === 'participe') ? 'Itens Solicitados' : 'Itens Homologados'}</h4>
                          <button type="button" onClick={() => setFormData({ ...formData, itens: [...(formData.itens || []), { descricao: '', quantidade: '', valorHomologado: '' }] })} className="text-sm px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium">
                            + Adicionar Item
                          </button>
                        </div>
                        <div className="space-y-3">
                          {(formData.itens || []).map((item: any, index: number) => (
                            <div key={index} className="flex gap-2 items-start">
                              <div className="flex-1">
                                <input type="text" placeholder="Nome do item..." value={item.descricao} onChange={(e) => {
                                  const newItens = [...(formData.itens || [])];
                                  newItens[index].descricao = e.target.value;
                                  setFormData({ ...formData, itens: newItens });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                              </div>
                              <div className="w-24">
                                <input type="text" placeholder="Qtd" value={item.quantidade} onChange={(e) => {
                                  const newItens = [...(formData.itens || [])];
                                  newItens[index].quantidade = e.target.value;
                                  setFormData({ ...formData, itens: newItens });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                              </div>
                              <div className="w-32">
                                <input type="text" placeholder="R$ Valor" value={item.valorHomologado} onChange={(e) => {
                                  const newItens = [...(formData.itens || [])];
                                  newItens[index].valorHomologado = e.target.value;
                                  setFormData({ ...formData, itens: newItens });
                                }} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                              </div>
                              <button type="button" onClick={() => {
                                const newItens = [...(formData.itens || [])];
                                newItens.splice(index, 1);
                                setFormData({ ...formData, itens: newItens });
                              }} className="mt-2 p-1 text-gray-400 hover:text-red-500">
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                          {(!formData.itens || formData.itens.length === 0) && (
                            <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded border border-dashed border-gray-200">
                              Nenhum item cadastrado. Clique em "+ Adicionar Item" para inserir.
                            </p>
                          )}
                        </div>
                        
                        {formData.itens && formData.itens.length > 0 && (
                          <div className="mt-6 flex justify-end">
                              <div className="text-right border-t border-gray-200 pt-4 px-4 w-full md:w-auto">
                                 <p className="text-sm text-gray-500 uppercase tracking-wider font-medium mb-1">Valor Total</p>
                                 <p className="text-2xl font-bold text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                        formData.itens.reduce((acc: number, item: any) => {
                                            let valStr = item.valorHomologado || '';
                                            valStr = valStr.toString().replace(/[^\d.,]/g, '');
                                            if (valStr.includes(',') && valStr.includes('.')) { valStr = valStr.replace(/\./g, '').replace(',', '.'); }
                                            else if (valStr.includes(',')) { valStr = valStr.replace(',', '.'); }
                                            
                                            let qtyStr = (item.quantidade || '').toString().replace(/[^\d.,]/g, '');
                                            if (qtyStr.includes(',') && qtyStr.includes('.')) { qtyStr = qtyStr.replace(/\./g, '').replace(',', '.'); }
                                            else if (qtyStr.includes(',')) { qtyStr = qtyStr.replace(',', '.'); }
                                            
                                            const val = parseFloat(valStr) || 0;
                                            const qty = parseFloat(qtyStr) || 1;
                                            return acc + (val * qty);
                                        }, 0)
                                    )}
                                 </p>
                              </div>
                          </div>
                        )}
                    </div>
                </>
              )}

              {abaAtiva === 'sancionatorios' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Processo</label>
                    <input type="text" name="processo" value={formData.processo || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Empresa</label>
                    <input type="text" name="empresa" value={formData.empresa || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                    <textarea name="motivo" rows={3} value={formData.motivo || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fase</label>
                    <input type="text" name="fase" value={formData.fase || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                  </div>
                </>
              )}

              {abaAtiva === 'portarias' && (
                <div className="space-y-6 pb-20">
                  <div className="border-b border-gray-200 pb-5">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Contrato e Portaria</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Nº do Contrato (nnnn/aaaa)</label>
                        <input type="text" name="contrato" placeholder="Ex: 015/2026" value={formData.contrato || ''} onChange={handleInputChange} className="mt-1 block w-full sm:w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>

                      <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 border-l-4 border-emerald-500 pl-4 py-3 bg-emerald-50/50 rounded-r-md">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Objeto do Contrato</label>
                          <input type="text" className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-600" placeholder="Vinculado automaticamente" readOnly />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa Contratada</label>
                          <input type="text" className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-600" placeholder="Vinculado automaticamente" readOnly />
                        </div>
                        <div className="sm:col-span-1">
                           <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Homologado</label>
                           <input type="text" className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-600" placeholder="Vinculado automaticamente" readOnly />
                        </div>
                        <div className="sm:col-span-3">
                           <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Período de Vigência</label>
                           <input type="text" className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-600" placeholder="Vinculado automaticamente" readOnly />
                        </div>
                      </div>

                      <div className="mt-4 md:col-span-2">
                        <div className="flex items-center justify-between max-w-sm mb-1">
                          <label className="block text-sm font-medium text-gray-700">Número da Portaria</label>
                          <button type="button" onClick={() => setFormData({ ...formData, portaria: `0${Math.floor(Math.random() * 90) + 10}/${new Date().getFullYear()}-DP`})} className="text-xs text-red-600 font-medium hover:text-red-800">
                            Gerar Número
                          </button>
                        </div>
                        <input type="text" name="portaria" placeholder="Ex: 042/2026-DP" value={formData.portaria || ''} onChange={handleInputChange} className="block w-full max-w-sm border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm font-medium text-gray-900" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">DOE da Publicação</label>
                        <input type="text" name="doe" placeholder="Inserir posteriormente..." value={formData.doe || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">BG da Publicação</label>
                        <input type="text" name="bg" placeholder="Inserir posteriormente..." value={formData.bg || ''} onChange={handleInputChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-gray-200 pb-5">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Nomeação de Fiscais</h4>
                    
                    <div className="space-y-6">
                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        <label className="block text-sm font-medium text-gray-900 mb-2">Militar - Fiscal Titular (Nome e Cargo da Planilha)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div>
                             <MilitarAutocomplete
                               militares={militares}
                               name="fiscalTitularNome"
                               placeholder="Nome do Militar..."
                               value={formData.fiscalTitularNome || formData.fiscalTitular || ''}
                               onChange={(val) => setFormData({...formData, fiscalTitularNome: val, fiscalTitular: val})}
                               onSelect={(m) => setFormData({...formData, fiscalTitularNome: m.nome, fiscalTitular: m.nome, fiscalTitularCargo: m.cargo})}
                               className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                             />
                          </div>
                          <div>
                             <input type="text" name="fiscalTitularCargo" placeholder="Posto/Graduação (Cargo)..." value={formData.fiscalTitularCargo || ''} onChange={handleInputChange} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="col-span-1 md:col-span-1">
                             <label className="block text-xs text-gray-500">Contato</label>
                             <input type="text" name="fiscalTitularContato" value={formData.fiscalTitularContato || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="(91) 9..." />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                             <label className="block text-xs text-gray-500">E-mail</label>
                             <input type="email" name="fiscalTitularEmail" value={formData.fiscalTitularEmail || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="email@bombeiros.pa.gov.br" />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                             <label className="block text-xs text-gray-500">UBM / Lotação</label>
                             <input type="text" name="fiscalTitularUbm" value={formData.fiscalTitularUbm || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="Unidade..." />
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                        <label className="block text-sm font-medium text-gray-900 mb-2">Militar - Fiscal Suplente (Nome e Cargo da Planilha)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                          <div>
                            <MilitarAutocomplete
                               militares={militares}
                               name="fiscalSuplenteNome"
                               placeholder="Nome do Militar..."
                               value={formData.fiscalSuplenteNome || formData.fiscalSuplente || ''}
                               onChange={(val) => setFormData({...formData, fiscalSuplenteNome: val, fiscalSuplente: val})}
                               onSelect={(m) => setFormData({...formData, fiscalSuplenteNome: m.nome, fiscalSuplente: m.nome, fiscalSuplenteCargo: m.cargo})}
                               className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                             />
                          </div>
                          <div>
                            <input type="text" name="fiscalSuplenteCargo" placeholder="Posto/Graduação (Cargo)..." value={formData.fiscalSuplenteCargo || ''} onChange={handleInputChange} className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                          </div>
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="col-span-1 md:col-span-1">
                             <label className="block text-xs text-gray-500">Contato</label>
                             <input type="text" name="fiscalSuplenteContato" value={formData.fiscalSuplenteContato || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="(91) 9..." />
                          </div>
                          <div className="col-span-1 md:col-span-2">
                             <label className="block text-xs text-gray-500">E-mail</label>
                             <input type="email" name="fiscalSuplenteEmail" value={formData.fiscalSuplenteEmail || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="email@bombeiros.pa.gov.br" />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                             <label className="block text-xs text-gray-500">UBM / Lotação</label>
                             <input type="text" name="fiscalSuplenteUbm" value={formData.fiscalSuplenteUbm || ''} onChange={handleInputChange} className="mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500" placeholder="Unidade..." />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-base font-medium text-gray-900">Substituições de Fiscais no Contrato</h4>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newSubs = [...(formData.substituicoes || []), { data: new Date().toISOString().split('T')[0], tipoAfastamento: '', fiscalSubstituto: '' }];
                          setFormData({ ...formData, substituicoes: newSubs });
                        }}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <PlusCircle className="mr-1.5 h-4 w-4 text-gray-500" />
                        Registrar Substituição
                      </button>
                    </div>

                    {(!formData.substituicoes || formData.substituicoes.length === 0) ? (
                      <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-sm text-gray-500">
                        Nenhuma substituição registrada nesta portaria ainda.
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center justify-center w-4 h-full left-4" aria-hidden="true">
                           <div className="w-0.5 h-full bg-gray-200"></div>
                        </div>
                        
                        <div className="space-y-6">
                          {formData.substituicoes.map((sub: any, index: number) => (
                            <div key={index} className="relative pl-10 pr-2">
                              <div className="absolute top-4 left-3 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white ring-red-600 ring-2 z-10"></div>
                              <div className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm hover:border-gray-300 relative group">
                                <button type="button" onClick={() => {
                                  const newSubs = [...formData.substituicoes];
                                  newSubs.splice(index, 1);
                                  setFormData({ ...formData, substituicoes: newSubs });
                                }} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hidden group-hover:block transition-all">
                                  <X className="w-4 h-4"/>
                                </button>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Data de Substituição</label>
                                    <input type="date" value={sub.data || ''} onChange={(e) => {
                                      const newSubs = [...formData.substituicoes];
                                      newSubs[index].data = e.target.value;
                                      setFormData({ ...formData, substituicoes: newSubs });
                                    }} className="mt-1 block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Quem foi substituído / Tipo</label>
                                    <select value={sub.tipoAfastamento || ''} onChange={(e) => {
                                      const newSubs = [...formData.substituicoes];
                                      newSubs[index].tipoAfastamento = e.target.value;
                                      setFormData({ ...formData, substituicoes: newSubs });
                                    }} className="mt-1 block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500">
                                      <option value="">Selecione...</option>
                                      <option value="Titular Exonerado">Fiscal Titular - Transferência/Definitivo</option>
                                      <option value="Titular Férias">Fiscal Titular - Férias/Licença (Temp)</option>
                                      <option value="Suplente Exonerado">O Fiscal Suplente</option>
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">Novo Fiscal / Militar Substituto (Nome)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                      <MilitarAutocomplete
                                        militares={militares}
                                        placeholder="Nome do Militar..."
                                        value={sub.fiscalSubstituto || ''}
                                        onChange={(val) => {
                                          const newSubs = [...formData.substituicoes];
                                          newSubs[index].fiscalSubstituto = val;
                                          setFormData({ ...formData, substituicoes: newSubs });
                                        }}
                                        onSelect={(m) => {
                                          const newSubs = [...formData.substituicoes];
                                          newSubs[index].fiscalSubstituto = m.nome;
                                          newSubs[index].cargoSubstituto = m.cargo;
                                          setFormData({ ...formData, substituicoes: newSubs });
                                        }}
                                        className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500"
                                      />
                                      <input type="text" placeholder="Cargo/Posto..." value={sub.cargoSubstituto || ''} onChange={(e) => {
                                        const newSubs = [...formData.substituicoes];
                                        newSubs[index].cargoSubstituto = e.target.value;
                                        setFormData({ ...formData, substituicoes: newSubs });
                                      }} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                       <input type="text" placeholder="Contato..." value={sub.contatoSubstituto || ''} onChange={(e) => {
                                          const newSubs = [...formData.substituicoes];
                                          newSubs[index].contatoSubstituto = e.target.value;
                                          setFormData({ ...formData, substituicoes: newSubs });
                                       }} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                       <input type="email" placeholder="E-mail..." value={sub.emailSubstituto || ''} onChange={(e) => {
                                          const newSubs = [...formData.substituicoes];
                                          newSubs[index].emailSubstituto = e.target.value;
                                          setFormData({ ...formData, substituicoes: newSubs });
                                       }} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                       <input type="text" placeholder="UBM..." value={sub.ubmSubstituto || ''} onChange={(e) => {
                                          const newSubs = [...formData.substituicoes];
                                          newSubs[index].ubmSubstituto = e.target.value;
                                          setFormData({ ...formData, substituicoes: newSubs });
                                       }} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">DOE da Alteração</label>
                                    <input type="text" placeholder="Opcional..." value={sub.doe || ''} onChange={(e) => {
                                      const newSubs = [...formData.substituicoes];
                                      newSubs[index].doe = e.target.value;
                                      setFormData({ ...formData, substituicoes: newSubs });
                                    }} className="mt-1 block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">BG da Alteração</label>
                                    <input type="text" placeholder="Opcional..." value={sub.bg || ''} onChange={(e) => {
                                      const newSubs = [...formData.substituicoes];
                                      newSubs[index].bg = e.target.value;
                                      setFormData({ ...formData, substituicoes: newSubs });
                                    }} className="mt-1 block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 sm:flex sm:flex-row-reverse flex-shrink-0 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSalvarRegistro}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

