import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, PlusCircle, AlertTriangle, 
  Clock, FileSignature, CheckCircle, Mail, 
  ShieldAlert, AlertCircle, FileText, ShieldCheck, X, Upload, ChevronDown, ChevronUp, BellRing
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { initAuth, googleSignIn, getAccessToken } from '../lib/googleAuth';
import { getOrCreateFolder, uploadFileToDrive } from '../lib/driveService';
import { AlertasModal } from '../components/AlertasModal';

// Mocks baseados fielmente nas colunas das planilhas enviadas
const contratosMock = [
  { 
    id: '1', pae: '2020/201212', contrato: '053/2020', empresa: 'LUIZ VIANA TRANSPORTE LTDA', 
    objeto: 'Locação de veículos tipo pick-up/ Auto Busca e Salvamento',
    valorGlobal: 1089417.12, inicioVigencia: '2025-06-23', fimVigencia: '2026-06-23', 
    fiscalTitular: '1º TEN QOABM JOELMIR', fiscalEmail: 'ten.nunes17@gmail.com', portaria: '045/2024',
    fiscalSuplente: '2º TEN QOABM SILVA', fiscalSuplenteEmail: 'silva@gmail.com', contatosFornecedor: '(91) 98888-7777 / contato@luizviana.com.br',
    fonteRecurso: 'Tesouro Estadual', prd: '123/2020', empenho: '2020NE00123', dotacao: '06.122.1407.4776.0000',
    linkContrato: 'https://sei.pa.gov.br/sei/controlador.php?acao=documento_visualizar&acao_origem=arvore_visualizar&id_documento=11111'
  },
  { 
    id: '2', pae: '2020/209232', contrato: '041/2021', empresa: 'PRODEPA', 
    objeto: 'Prestação de serviços de tecnologia da informação e comunicação.',
    valorGlobal: 459468.48, inicioVigencia: '2025-04-03', fimVigencia: '2026-04-02', 
    fiscalTitular: 'MAJ QOBM EMERSON', fiscalEmail: 'emersoncsmoraes@gmail.com', portaria: '012/2024',
    fiscalSuplente: 'CAP QOBM ANDRÉ', fiscalSuplenteEmail: 'andre@gmail.com', contatosFornecedor: '(91) 99999-8888 / comercial@prodepa.pa.gov.br',
    fonteRecurso: 'FESPDS', prd: '456/2021', empenho: '2021NE00456', dotacao: '06.126.1407.4776.0000',
    linkContrato: 'https://sei.pa.gov.br/sei/controlador.php?acao=documento_visualizar&acao_origem=arvore_visualizar&id_documento=22222'
  },
  { 
    id: '3', pae: '2022/406950', contrato: '146/2022', empresa: 'PRINT SOLUTION SERVIÇOS', 
    objeto: 'Contratação de empresa especializada na solução de terceirização de impressão',
    valorGlobal: 503259.54, inicioVigencia: '2024-12-24', fimVigencia: '2025-12-23', 
    fiscalTitular: 'CAP QOBM SILVA', fiscalEmail: 'silva.print@cbmpa.gov.br', portaria: '118/2024',
    fiscalSuplente: '1º TEN QOBM PEREIRA', fiscalSuplenteEmail: 'pereira@gmail.com', contatosFornecedor: '(11) 97777-6666 / print@printsolution.com.br',
    fonteRecurso: 'Tesouro Estadual', prd: '789/2022', empenho: '2022NE00789', dotacao: '06.122.1407.4776.0000',
    linkContrato: null
  },
  { 
    id: '4', pae: '2023/882222', contrato: '105/2023', empresa: 'O.I.S.A', 
    objeto: 'Prestação de Serviços de Comunicação Corporativa de Link de Internet',
    valorGlobal: 1101119.40, inicioVigencia: '2025-09-14', fimVigencia: '2026-09-14', 
    fiscalTitular: 'CEL QOBM LUCIANO', fiscalEmail: 'mesoluciano@gmail.com', portaria: '089/2025',
    fiscalSuplente: 'MAJ QOBM PEREZ', fiscalSuplenteEmail: 'perez@gmail.com', contatosFornecedor: '(91) 98888-1111 / oisa@oisa.com',
    fonteRecurso: 'FESPDS', prd: '111/2023', empenho: '2023NE00111', dotacao: '06.126.1407.4776.0000',
    linkContrato: null
  },
  { 
    id: '5', pae: '2026/012345', contrato: '055/2021', empresa: 'NF CAPACITAÇÃO E SOLUÇÕES', 
    objeto: 'Acesso a banco de dados',
    valorGlobal: 10743.11, inicioVigencia: '2025-06-22', fimVigencia: '2026-06-21', 
    fiscalTitular: 'SGT QBM RARRARA', fiscalEmail: 'kitarrarabm@hotmail.com', portaria: '034/2024',
    fiscalSuplente: 'CB BM JUNIOR', fiscalSuplenteEmail: 'junior@gmail.com', contatosFornecedor: '(61) 97777-2222 / nf@nfcapacitacao.com.br',
    fonteRecurso: 'Tesouro Estadual', prd: '222/2021', empenho: '2021NE00222', dotacao: '06.126.1407.4776.0000',
    linkContrato: null
  }
];

export default function GestaoContratos() {
  const { processos, pcas, usuarioAtual } = useApp();
  const [busca, setBusca] = useState('');
  const [expandedContratoId, setExpandedContratoId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'geral' | 'alertas'>('geral');
  const [modalExecucao, setModalExecucao] = useState(false);
  const [contratoSelecionado, setContratoSelecionado] = useState<any>(null);
  const [execucoes, setExecucoes] = useState<any[]>([
    { id: 1, contratoId: '1', nf: '001234', data: '2025-07-15', valor: 50000, observacao: 'Faturamento ref ao mês de Junho/2025', arquivoLink: null },
    { id: 2, contratoId: '1', nf: '001289', data: '2025-08-16', valor: 45000, observacao: 'Faturamento ref ao mês de Julho/2025', arquivoLink: null },
  ]);
  const [novaNota, setNovaNota] = useState<{ nf: string, data: string, valor: string, observacao: string, arquivo: File | null }>({ nf: '', data: '', valor: '', observacao: '', arquivo: null });
  const [isUploading, setIsUploading] = useState(false);
  const [abaModal, setAbaModal] = useState<'execucao' | 'notificacoes'>('execucao');
  const [notificacoes, setNotificacoes] = useState<{ id: number, contratoId: string, texto: string, data: string }[]>([]);
  const [novaNotificacao, setNovaNotificacao] = useState('');
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);
  const [filtroKpi, setFiltroKpi] = useState<'vigentes' | 'atencao' | 'vencidos' | null>(null);

  useEffect(() => {
    const unsub = initAuth();
    return () => unsub();
  }, []);

  const handleAddNota = async () => {
    if (!novaNota.nf || !novaNota.valor || !novaNota.data) return;
    
    setIsUploading(true);
    try {
      let token = await getAccessToken();
      if (!token) {
        const result = await googleSignIn();
        token = result?.accessToken || null;
      }
      
      let arquivoLink = null;
      
      if (token && novaNota.arquivo) {
        const _novaNota = novaNota as { arquivo: File; nf: string };
        const newFile = new File([_novaNota.arquivo], `NF_${_novaNota.nf}.pdf`, { type: _novaNota.arquivo.type });
        
        // Find or create root folder
        const rootFolderId = await getOrCreateFolder(token, 'Documentos de Contratos');
        
        // Find or create contract folder inside root folder
        const folderName = `Contrato ${contratoSelecionado.contrato} - ${contratoSelecionado.empresa}`;
        const contractFolderId = await getOrCreateFolder(token, folderName, rootFolderId);
        
        arquivoLink = await uploadFileToDrive(token, newFile, contractFolderId);
      }

      setExecucoes([...execucoes, {
        id: Date.now(),
        contratoId: contratoSelecionado.id,
        nf: novaNota.nf,
        data: novaNota.data,
        valor: Number(novaNota.valor),
        observacao: novaNota.observacao,
        arquivoLink
      }]);
      setNovaNota({ nf: '', data: '', valor: '', observacao: '', arquivo: null });
    } catch (error) {
      console.error(error);
      alert('Erro ao realizar o upload para o Google Drive. Verifique suas permissões.');
    } finally {
      setIsUploading(false);
    }
  };

  const hoje = new Date('2026-05-28'); // Data base simulada para bater com a vigência

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

  const contratosComStatus = contratosMock.map(c => {
    const dataFim = new Date(c.fimVigencia);
    const diasRestantes = differenceInDays(dataFim, hoje);
    
    let status = 'VIGENTE';
    let cor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    let badge = 'Vigente';

    if (diasRestantes < 0) {
      status = 'VENCIDO';
      cor = 'bg-red-100 text-red-800 border-red-200';
      badge = 'Vencido';
    } else if (diasRestantes <= 30) {
      status = 'FALTA MENOS DE 30 DIAS';
      cor = 'bg-orange-100 text-orange-800 border-orange-200';
      badge = '< 30 Dias';
    } else if (diasRestantes <= 90) {
      status = 'FALTA MENOS DE 90 DIAS';
      cor = 'bg-amber-100 text-amber-800 border-amber-200';
      badge = '< 90 Dias';
    }

    return { ...c, diasRestantes, status, cor, badge };
  });

  const contratosPermitidos = usuarioAtual?.perfil === 'fiscal' 
    ? contratosComStatus.filter(c => c.fiscalEmail === usuarioAtual.email || c.fiscalTitular.includes(usuarioAtual.nome))
    : contratosComStatus;

  let filtrados = contratosPermitidos.filter(c => 
    c.empresa.toLowerCase().includes(busca.toLowerCase()) ||
    c.contrato.includes(busca) ||
    c.objeto.toLowerCase().includes(busca.toLowerCase()) ||
    c.pae.includes(busca)
  );

  if (filtroKpi === 'vigentes') {
    filtrados = filtrados.filter(c => c.diasRestantes > 90);
  } else if (filtroKpi === 'atencao') {
    filtrados = filtrados.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 90);
  } else if (filtroKpi === 'vencidos') {
    filtrados = filtrados.filter(c => c.diasRestantes < 0);
  }

  const kpiVigentes = contratosComStatus.filter(c => c.diasRestantes > 90).length;
  const kpiAtencao = contratosComStatus.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 90).length;
  const kpiVencidos = contratosComStatus.filter(c => c.diasRestantes < 0).length;
  const valorTotalVigente = contratosComStatus
    .filter(c => c.diasRestantes >= 0)
    .reduce((acc, curr) => acc + curr.valorGlobal, 0);

  const isMasterOrGestao = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'gestao';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Contratos</h1>
          <p className="mt-1 text-sm text-gray-500">Acompanhamento e fiscalização dos contratos em vigor e vigências.</p>
        </div>
        <button
          onClick={() => setAlertasModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <BellRing className="-ml-1 mr-2 h-5 w-5" />
          Painel de Alertas
        </button>
      </div>

      <AlertasModal
        isOpen={alertasModalOpen}
        onClose={() => setAlertasModalOpen(false)}
        contratos={contratosComStatus}
      />

      {/* Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div 
           onClick={() => setFiltroKpi(filtroKpi === 'vigentes' ? null : 'vigentes')}
           className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-emerald-500 cursor-pointer transition-colors ${filtroKpi === 'vigentes' ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}
         >
           <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos Vigentes</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpiVigentes}</h3>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
           </div>
         </div>
         <div 
           onClick={() => setFiltroKpi(filtroKpi === 'atencao' ? null : 'atencao')}
           className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-amber-500 cursor-pointer transition-colors ${filtroKpi === 'atencao' ? 'ring-2 ring-amber-500 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'}`}
         >
           <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vencendo (Até 90 dias)</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpiAtencao}</h3>
              </div>
              <Clock className="w-5 h-5 text-amber-500" />
           </div>
         </div>
         <div 
           onClick={() => setFiltroKpi(filtroKpi === 'vencidos' ? null : 'vencidos')}
           className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-red-600 cursor-pointer transition-colors ${filtroKpi === 'vencidos' ? 'ring-2 ring-red-600 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}
         >
           <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos Vencidos</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{kpiVencidos}</h3>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-600" />
           </div>
         </div>
         <div 
           onClick={() => setFiltroKpi(null)}
           className={`bg-white p-5 rounded-lg border shadow-sm border-l-4 border-l-blue-600 cursor-pointer transition-colors ${filtroKpi === null ? 'ring-2 ring-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
         >
           <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Global Ativo</p>
                <h3 className="text-xl font-bold text-gray-900 mt-1">
                  {valorTotalVigente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h3>
              </div>
              <FileSignature className="w-5 h-5 text-blue-600" />
           </div>
         </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setAbaAtiva('geral')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              abaAtiva === 'geral' ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Controle de Contratos
          </button>
          <button
            onClick={() => setAbaAtiva('alertas')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              abaAtiva === 'alertas' ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 mr-2" />
            Notificações e Alertas
          </button>
        </nav>
      </div>

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
            placeholder="Buscar por PAE, Contrato, Empresa ou Objeto..."
          />
        </div>
        <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
          <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
          Filtros Avançados
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {abaAtiva === 'geral' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PAE / Contrato</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa / Objeto</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vigência</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Global</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Situação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtrados.map((item) => {
                  const pcaIdCode = getPcaTitleByProcesso(item.pae);
                  const excDoContrato = execucoes.filter(e => e.contratoId === item.id);
                  const valorTotalExecutado = excDoContrato.reduce((acc, curr) => acc + curr.valor, 0);
                  const percExec = ((valorTotalExecutado / item.valorGlobal) * 100).toFixed(1);

                  return (
                  <React.Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50 ${expandedContratoId === item.id ? 'bg-blue-50/20' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => setExpandedContratoId(expandedContratoId === item.id ? null : item.id)}
                          className="text-left group flex flex-col focus:outline-none"
                        >
                          <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700 flex items-center gap-1">
                            Nº {item.contrato}
                            {expandedContratoId === item.id ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
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
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate" title={item.empresa}>{item.empresa}</div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2" title={item.objeto}>{item.objeto}</div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{format(new Date(item.fimVigencia), 'dd/MM/yyyy')}</div>
                      <div className={`text-xs font-medium mt-1 ${item.diasRestantes < 0 ? 'text-red-600' : item.diasRestantes <= 90 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {item.diasRestantes < 0 ? `Vencido há ${Math.abs(item.diasRestantes)} dias` : `Faltam ${item.diasRestantes} dias`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-gray-900">
                        {item.valorGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Executado: {percExec}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${item.cor}`}>
                        {item.badge}
                      </span>
                    </td>
                  </tr>
                  
                  {expandedContratoId === item.id && (
                    <tr className="bg-blue-50/10">
                      <td colSpan={5} className="px-6 py-4 border-b border-blue-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                          
                          <div className="space-y-4">
                            <div>
                              <span className="font-semibold text-gray-900 block flex items-center justify-between mb-1">
                                Ações 
                              </span>
                              <button 
                                onClick={() => item.linkContrato && window.open(item.linkContrato, '_blank')}
                                disabled={!item.linkContrato}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed mb-2 block"
                              >
                                <FileText className="w-4 h-4 mr-1.5"/>
                                Visualizar Contrato
                              </button>
                              {isMasterOrGestao && (
                                <button 
                                  onClick={() => { setContratoSelecionado(item); setModalExecucao(true); }}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none block"
                                >
                                  <PlusCircle className="w-4 h-4 mr-1.5"/>
                                  Gerenciar Execução / Notificações
                                </button>
                              )}
                            </div>
                            <div>
                               <span className="font-semibold text-gray-900 block mb-1">Contatos Fornecedor</span>
                               <div className="text-gray-700 text-xs">{item.contatosFornecedor}</div>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-900 block mb-1">Fiscalização</span>
                              <div className="text-gray-700 block mb-2">Titular: <span className="font-medium">{item.fiscalTitular}</span><br/><span className="text-xs text-gray-500">{item.fiscalEmail}</span></div>
                              <div className="text-gray-700">Suplente: <span className="font-medium">{item.fiscalSuplente}</span><br/><span className="text-xs text-gray-500">{item.fiscalSuplenteEmail}</span></div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <span className="font-semibold text-gray-900 block mb-1">Dados Orçamentários</span>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="font-medium text-gray-500">Fonte:</span> {item.fonteRecurso}</div>
                                <div><span className="font-medium text-gray-500">PRD:</span> {item.prd}</div>
                                <div><span className="font-medium text-gray-500">Empenho:</span> {item.empenho}</div>
                                <div><span className="font-medium text-gray-500">Dotação:</span> {item.dotacao}</div>
                              </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                               <div className="flex justify-between items-center mb-1">
                                 <span className="font-semibold text-gray-900">Saldo Atual</span>
                                 <span className="text-emerald-600 font-bold">
                                   {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorGlobal - valorTotalExecutado)}
                                 </span>
                               </div>
                               <div className="h-2 bg-gray-200 rounded-full mt-2 mb-1 overflow-hidden pointer-events-none">
                                  <div className={`h-full ${Number(percExec) > 90 ? 'bg-red-500' : Number(percExec) > 70 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, Number(percExec))}%` }}></div>
                               </div>
                               <div className="text-xs text-gray-500 text-right">Executado: {percExec}%</div>
                            </div>
                          </div>

                          <div className="space-y-2 lg:col-span-1 md:col-span-2">
                             <span className="font-semibold text-gray-900 block mb-1">Linha do Tempo (Últimos Eventos)</span>
                             <div className="relative pl-4 border-l-2 border-gray-200 space-y-4 mt-2">
                               {notificacoes.filter(n => n.contratoId === item.id).length > 0 || excDoContrato.length > 0 ? (
                                 <>
                                   {excDoContrato.slice(0,2).map(exec => (
                                     <div key={exec.id} className="relative">
                                       <div className="absolute -left-[21px] bg-blue-500 h-2 w-2 rounded-full border-2 border-white"></div>
                                       <div className="text-xs font-medium text-gray-900">Inclusão de {exec.tipo || 'NF/Fatura'}: {exec.nf}</div>
                                       <div className="text-[10px] text-gray-500">{format(new Date(exec.data), 'dd/MM/yyyy')} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(exec.valor)} {exec.quantidade ? `(Qtd: ${exec.quantidade})` : ''}</div>
                                     </div>
                                   ))}
                                   {notificacoes.filter(n => n.contratoId === item.id).slice(0,2).map(noti => (
                                      <div key={'not-'+noti.id} className="relative">
                                        <div className="absolute -left-[21px] bg-amber-500 h-2 w-2 rounded-full border-2 border-white"></div>
                                        <div className="text-xs font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">Ocorrência</div>
                                        <div className="text-[10px] text-gray-500">{noti.texto} ({format(new Date(noti.data), 'dd/MM/yyyy')})</div>
                                      </div>
                                   ))}
                                 </>
                               ) : (
                                  <p className="text-xs text-gray-500 mt-2">Nenhum evento recente.</p>
                               )}
                             </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {abaAtiva === 'alertas' && (
          <div className="p-6 bg-slate-50">
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">Notificações Disparadas para Fiscais</h3>
            </div>
            <div className="space-y-4">
              {filtrados.filter(c => c.diasRestantes <= 90).map((item) => (
                <div key={item.id} className={`p-4 rounded-lg border ${item.diasRestantes < 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} flex justify-between items-center`}>
                  <div>
                    <h4 className={`text-sm font-bold ${item.diasRestantes < 0 ? 'text-red-800' : 'text-orange-800'}`}>
                      Contrato {item.contrato} - {item.empresa}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">PAE: {item.pae} | Fiscal: {item.fiscalTitular}</p>
                    <p className="text-xs text-gray-600 mt-1 flex items-center">
                       <Clock className="w-3 h-3 mr-1" />
                       Vencimento: {format(new Date(item.fimVigencia), 'dd/MM/yyyy')} ({item.diasRestantes < 0 ? `Vencido há ${Math.abs(item.diasRestantes)} dias` : `Faltam ${item.diasRestantes} dias`})
                    </p>
                  </div>
                  <div>
                    <button className={`px-4 py-2 rounded text-sm font-medium border ${
                      item.diasRestantes < 0 
                        ? 'bg-red-600 text-white hover:bg-red-700 border-transparent' 
                        : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                    }`}>
                      <Mail className="w-4 h-4 inline mr-2" />
                      Reenviar E-mail ao Fiscal
                    </button>
                  </div>
                </div>
              ))}
              {filtrados.filter(c => c.diasRestantes <= 90).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum contrato em período crítico de alerta.
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal de Execução Financeira */}
      {modalExecucao && contratoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-500 bg-opacity-75 overflow-hidden" onClick={() => setModalExecucao(false)}>
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl h-full max-h-[95vh] p-4 sm:p-6 text-left transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 border-l-4 border-red-600 pl-3">
                Gestão do Contrato nº {contratoSelecionado.contrato}
              </h3>
              <div className="flex items-center space-x-2">
                <button 
                  type="button" 
                  onClick={() => alert('Relatório gerado com sucesso!')}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-gray-300 flex items-center"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Gerar Relatório
                </button>
                <button 
                  type="button" 
                  className="text-gray-400 hover:text-gray-500 focus:outline-none ml-2"
                  onClick={() => setModalExecucao(false)}
                >
                  <span className="sr-only">Fechar</span>
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex border-b border-gray-200 mb-4">
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 ${abaModal === 'execucao' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAbaModal('execucao')}
              >
                Execução Financeira
              </button>
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 ${abaModal === 'notificacoes' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAbaModal('notificacoes')}
              >
                Notificações
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Empresa Contratada</p>
                    <p className="font-semibold text-gray-900">{contratoSelecionado.empresa}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">Objeto</p>
                    <p className="text-sm text-gray-900 line-clamp-2">{contratoSelecionado.objeto}</p>
                  </div>
                </div>
                
                {(() => {
                  const excDoContrato = execucoes.filter(e => e.contratoId === contratoSelecionado.id);
                  const valorTotalExecutado = excDoContrato.reduce((acc, curr) => acc + curr.valor, 0);
                  const saldo = contratoSelecionado.valorGlobal - valorTotalExecutado;
                  const percExec = ((valorTotalExecutado / contratoSelecionado.valorGlobal) * 100).toFixed(1);
                  
                  return (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-200 pt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium">Valor Global</p>
                        <p className="text-xl font-bold text-gray-900">{contratoSelecionado.valorGlobal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium">Valor Executado (Deduzido)</p>
                        <p className="text-xl font-bold text-red-600">{valorTotalExecutado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${percExec}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium">Saldo Restante</p>
                        <p className="text-xl font-bold text-emerald-600">{saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {abaModal === 'execucao' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulário de Inclusão */}
                <div className="lg:col-span-1">
                  <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">Nova Execução / NF</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Nº da Nota Fiscal / Fatura</label>
                      <input 
                        type="text" 
                        value={novaNota.nf}
                        onChange={(e) => setNovaNota({...novaNota, nf: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data do Faturamento</label>
                      <input 
                        type="date" 
                        value={novaNota.data}
                        onChange={(e) => setNovaNota({...novaNota, data: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Valor (R$)</label>
                      <input 
                        type="number" 
                        value={novaNota.valor}
                        onChange={(e) => setNovaNota({...novaNota, valor: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Observação / Competência</label>
                      <textarea 
                        rows={2} 
                        value={novaNota.observacao}
                        onChange={(e) => setNovaNota({...novaNota, observacao: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Comprovante (NF / Recibo)</label>
                      <input 
                        type="file" 
                        accept=".pdf"
                        onChange={(e) => setNovaNota({...novaNota, arquivo: e.target.files ? e.target.files[0] : null})}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" 
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddNota}
                      disabled={isUploading || !novaNota.nf || !novaNota.valor || !novaNota.data}
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
                    >
                      {isUploading ? (
                        <>
                          <Upload className="-ml-1 mr-2 h-4 w-4 animate-bounce" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                          Registrar Dedução
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Linha do Tempo */}
                <div className="lg:col-span-2">
                  <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">Linha do Tempo de Execução</h4>
                  <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                    {execucoes
                      .filter(e => e.contratoId === contratoSelecionado.id)
                      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                      .map((exec, idx) => (
                        <div key={exec.id} className="relative">
                          <div className="absolute -left-6 mt-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white"></div>
                          <div className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm hover:border-gray-300">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                  NF / Fatura: {exec.nf}
                                </span>
                                <p className="text-xs text-gray-500 mt-1">{format(new Date(exec.data), 'dd/MM/yyyy')} - Ref: {exec.observacao}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-red-600">- {exec.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                              </div>
                            </div>
                            {exec.arquivoLink && (
                              <a 
                                href={exec.arquivoLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-xs text-red-600 hover:text-red-800 font-medium inline-flex items-center"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Ver Comprovante
                              </a>
                            )}
                          </div>
                        </div>
                    ))}
                    {execucoes.filter(e => e.contratoId === contratoSelecionado.id).length === 0 && (
                      <div className="text-sm text-gray-500 italic pb-4">
                        Nenhuma execução financeira registrada para este contrato.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )}

              {abaModal === 'notificacoes' && (
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">Nova Notificação</h4>
                    <div className="flex gap-2 mb-6">
                      <input
                        type="text"
                        value={novaNotificacao}
                        onChange={(e) => setNovaNotificacao(e.target.value)}
                        placeholder="Digite a ocorrência / notificação para este contrato..."
                        className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (novaNotificacao.trim()) {
                            setNotificacoes([{ id: Date.now(), contratoId: contratoSelecionado.id, texto: novaNotificacao, data: new Date().toISOString() }, ...notificacoes]);
                            setNovaNotificacao('');
                          }
                        }}
                        className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
                      >
                        <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                        Adicionar
                      </button>
                    </div>

                    <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">Histórico de Notificações</h4>
                    <div className="space-y-4">
                      {notificacoes.filter(n => n.contratoId === contratoSelecionado.id).map(notif => (
                        <div key={notif.id} className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm">
                          <p className="text-sm text-gray-800">{notif.texto}</p>
                          <p className="text-xs text-gray-500 mt-2">{format(new Date(notif.data), 'dd/MM/yyyy HH:mm')} - Registrado por {usuarioAtual?.nome}</p>
                        </div>
                      ))}
                      {notificacoes.filter(n => n.contratoId === contratoSelecionado.id).length === 0 && (
                        <div className="text-sm text-gray-500 italic">
                          Nenhuma notificação registrada para este contrato.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
