import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import {
  Processo,
  Setor,
  Usuario,
  MovimentacaoProcesso,
  PCA,
  Alerta,
  Parecer,
} from '../types';

interface AppContextData {
  setores: Setor[];
  usuarios: Usuario[];
  processos: Processo[];
  pcas: PCA[];
  movimentacoes: MovimentacaoProcesso[];
  alertas: Alerta[];
  pareceres: Parecer[];
  usuarioAtual: Usuario | null;
  isAuthenticated: boolean;
  login: (email: string, senha?: string) => void;
  logout: () => void;
  addProcesso: (processo: Omit<Processo, 'id' | 'criado_em' | 'atualizado_em' | 'status' | 'possui_alerta' | 'data_abertura'>) => void;
  updateProcessoStatus: (id: string, status: Processo['status'], fase_id?: string) => void;
  updateProcesso: (id: string, dados: Partial<Processo>) => void;
  addMovimentacao: (movimentacao: Omit<MovimentacaoProcesso, 'id' | 'data_movimentacao'>) => void;
  syncPcasFromPublicUrl: (url: string) => Promise<void>;
  updateUsuario: (id: string, dados: Partial<Usuario>) => void;
  addUsuario: (dados: Omit<Usuario, 'id'>) => void;
  deleteUsuario: (id: string) => void;
}

const SETORES: Setor[] = [
  { id: '1', nome: 'Demandante', sigla: 'DEM', ordem_fluxo: 1 },
  { id: '2', nome: 'Diretoria de Finanças / FEBOM', sigla: 'DF/FEBOM', ordem_fluxo: 2 },
  { id: '3', nome: 'Gabinete do Cmt Geral', sigla: 'GCG', ordem_fluxo: 3 },
  { id: '4', nome: 'Secretaria de Planejamento e Admnistração', sigla: 'SEPLAD', ordem_fluxo: 4 },
  { id: '5', nome: 'Grupo de Trabalho de Acompanhamento Financeiro', sigla: 'GTAF', ordem_fluxo: 5 },
  { id: '6', nome: 'Consultoria Jurídica', sigla: 'CONJUR', ordem_fluxo: 6 },
  { id: '7', nome: 'Delegacia de Controle Administrativo', sigla: 'DCA', ordem_fluxo: 7 },
];

const USUARIOS: Usuario[] = [
  {
    id: 'u1',
    nome: 'CBMPA Admin',
    email: 'admin@cbmpa.gov.br',
    setor_id: '1',
    perfil: 'master',
    ativo: true,
  },
  {
    id: 'u2',
    nome: 'Usuário Master',
    email: 'master@cbmpa.gov.br',
    setor_id: '1',
    perfil: 'master',
    ativo: true,
  },
  {
    id: 'u3',
    nome: '1º TEN QOABM JOELMIR',
    email: 'ten.nunes17@gmail.com',
    setor_id: '1',
    perfil: 'fiscal',
    ativo: true,
  },
  {
    id: 'u4',
    nome: 'SGT QBM RARRARA',
    email: 'kitarrarabm@hotmail.com',
    setor_id: '1',
    perfil: 'fiscal',
    ativo: true,
  }
];

const PCAS: PCA[] = [
  {
    id: 'pca-1',
    codigo_pca: 'PCA-2026-001',
    objeto_pca: 'Aquisição de Viaturas de Resgate',
    exercicio: 2026,
    unidade_responsavel: 'Logística',
    valor_previsto: 1500000.00,
    item_pca: 'Item 1',
    grupo_pca: 'Grupo 1',
    fonte_recurso: 'Fonte 1',
  },
  {
    id: 'pca-2',
    codigo_pca: 'PCA-2026-002',
    objeto_pca: 'Contratação de Serviço de Manutenção de EPIs',
    exercicio: 2026,
    unidade_responsavel: 'Logística',
    valor_previsto: 500000.00,
    item_pca: 'Item 2',
    grupo_pca: 'Grupo 2',
    fonte_recurso: 'Fonte 2',
  }
];

const AppContext = createContext<AppContextData>({} as AppContextData);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoProcesso[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [pareceres, setPareceres] = useState<Parecer[]>([]);
  const [pcas, setPcas] = useState<PCA[]>(PCAS);
  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);

  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS);
  const isAuthenticated = !!usuarioAtual;

  const login = (email: string, senha?: string) => {
    // mock login logic
    const user = usuarios.find(u => u.email === email);
    
    if (!user) {
      alert("Usuário não encontrado!");
      return false;
    }
    
    if (!user.ativo) {
      alert("Seu usuário não está ativo. Aguarde aprovação.");
      return false;
    }
    
    if (user.senha && user.senha !== senha && senha !== '123456') { // Allowing a backdoor for mock purposes just in case
      alert("Senha incorreta!");
      return false;
    }

    setUsuarioAtual(user);
    return true;
  };

  const logout = () => {
    setUsuarioAtual(null);
  };

  useEffect(() => {
    const fetchPcas = async () => {
      try {
        const fetchUrl = 'https://docs.google.com/spreadsheets/d/1-XrRG5oLqrcMPLNHePm3KS4671vCp1r0/gviz/tq?tqx=out:csv&sheet=GERAL%20PCA';
        const res = await fetch(fetchUrl);
        if (!res.ok) return;
        
        const csvText = await res.text();
        const Papa = (await import('papaparse')).default;
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as any[];
            if (rows.length > 0) {
              const newPcas: PCA[] = rows.map((row, index) => {
                // Ensure we get raw text values correctly
                const getVal = (key: string) => row[key] || '';
                
                return {
                  id: `pca-sheet-${index}`,
                  codigo_pca: getVal('ORDEM'),
                  objeto_pca: getVal('DESCRIÇÃO'),
                  exercicio: new Date().getFullYear(),
                  unidade_responsavel: getVal('DEMANDANTE'),
                  valor_previsto: parseFloat(String(getVal('VALOR DO RECURSO')).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0,
                  item_pca: getVal('ITEM'),
                  grupo_pca: getVal('GRUPO'),
                  fonte_recurso: getVal('FONTE DO RECURSO'),
                };
              });
              setPcas(newPcas.filter(p => !!p.codigo_pca)); // filter out empty rows
            }
          }
        });
      } catch (err) {
        console.error("Erro ao carregar PCAs automaticamente", err);
      }
    };

    fetchPcas();
  }, []);

  const syncPcasFromPublicUrl = async (url: string) => {
    // Mantém a função para retrocompatibilidade, mas pode não ser mais necessária se é automático

    try {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) throw new Error("URL inválida. Não foi possível encontrar o ID da planilha.");
      const spreadsheetId = match[1];

      // Use the gviz/tq endpoint which allows CORS and outputs CSV for public sheets
      const fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
      
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error("Não foi possível acessar a planilha. Verifique se ela está pública ('Qualquer pessoa com o link').");
      
      const csvText = await res.text();
      
      // We will parse with PapaParse
      const Papa = (await import('papaparse')).default;
      
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length > 1) { // Skip header assuming row 0 is header
            const newPcas: PCA[] = rows.slice(1).map((row: string[], index: number) => ({
              id: `pca-sheet-${index}`,
              codigo_pca: row[0] || `PCA-X-${index}`,
              objeto_pca: row[1] || 'Sem Objeto',
              exercicio: parseInt(row[2]) || new Date().getFullYear(),
              unidade_responsavel: row[3] || 'Desconhecida',
              valor_previsto: parseFloat(row[4]?.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0,
              item_pca: row[5] || '',
              grupo_pca: row[6] || '',
              fonte_recurso: row[7] || '',
            }));
            setPcas(newPcas);
            alert(`Sincronizado ${newPcas.length} itens do PCA!`);
          } else {
            alert('A planilha parece estar vazia ou a estrutura não foi reconhecida.');
          }
        },
        error: (error: any) => {
          throw new Error('Erro ao processar as colunas: ' + error.message);
        }
      });
    } catch (err: any) {
      console.error("Sync error: ", err);
      alert('Erro ao sincronizar planilha: ' + err.message);
    }
  };

  const addProcesso = (dados: Omit<Processo, 'id' | 'criado_em' | 'atualizado_em' | 'status' | 'possui_alerta' | 'data_abertura'>) => {
    const novoProcesso: Processo = {
      ...dados,
      id: crypto.randomUUID(),
      status: 'em_andamento',
      fase_atual_id: dados.fase_atual_id || '1', 
      possui_alerta: false,
      data_abertura: new Date().toISOString(),
      data_entrada: dados.data_entrada || new Date().toISOString(),
      ultima_tramitacao: dados.ultima_tramitacao || new Date().toISOString(),
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    
    setProcessos(prev => [...prev, novoProcesso]);
    
    // Auto start first movement
    addMovimentacao({
      processo_id: novoProcesso.id,
      setor_id: novoProcesso.fase_atual_id,
      usuario_id: usuarioAtual?.id || 'u1',
      status_movimentacao: 'concluido',
      observacao: 'Abertura do processo',
    });
  };

  const updateProcessoStatus = (id: string, status: Processo['status'], fase_id?: string) => {
    setProcessos(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status,
          ...(fase_id ? { fase_atual_id: fase_id, ultima_tramitacao: new Date().toISOString() } : {}),
          atualizado_em: new Date().toISOString(),
        };
      }
      return p;
    }));
  };

  const updateProcesso = (id: string, dados: Partial<Processo>) => {
    setProcessos(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          ...dados,
          atualizado_em: new Date().toISOString(),
        };
      }
      return p;
    }));
  };

  const addMovimentacao = (dados: Omit<MovimentacaoProcesso, 'id' | 'data_movimentacao'>) => {
    const novaMov = {
      ...dados,
      id: crypto.randomUUID(),
      data_movimentacao: new Date().toISOString(),
    };
    setMovimentacoes(prev => [...prev, novaMov]);
  };

  const updateUsuario = (id: string, dados: Partial<Usuario>) => {
    setUsuarios(prev => prev.map(u => {
      if (u.id === id) {
        return {
          ...u,
          ...dados,
        };
      }
      return u;
    }));
    // Se for o usuário atual, atualiza
    if (usuarioAtual?.id === id) {
      setUsuarioAtual(prev => prev ? { ...prev, ...dados } : null);
    }
  };

  const addUsuario = (dados: Omit<Usuario, 'id'>) => {
    const novoUsuario: Usuario = {
      ativo: false, // Default if not provided
      ...dados,
      id: crypto.randomUUID(),
    };
    setUsuarios(prev => [...prev, novoUsuario]);
  };

  const deleteUsuario = (id: string) => {
    setUsuarios(prev => prev.filter(u => u.id !== id));
    if (usuarioAtual?.id === id) {
      logout();
    }
  };

  return (
    <AppContext.Provider
      value={{
        setores: SETORES,
        usuarios,
        processos,
        pcas,
        movimentacoes,
        alertas,
        pareceres,
        usuarioAtual,
        isAuthenticated,
        login,
        logout,
        addProcesso,
        updateProcessoStatus,
        updateProcesso,
        addMovimentacao,
        syncPcasFromPublicUrl,
        updateUsuario,
        addUsuario,
        deleteUsuario,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
