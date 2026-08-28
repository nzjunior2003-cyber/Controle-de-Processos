import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  criarContaAuthIsolada,
  getDb,
  getFirebaseAuth,
  isFirebaseConfigured,
  mensagemErroAuth,
  requireDb,
  requireFirebaseAuth,
} from '../lib/firebase';
import { mapSheetArrayToPca, mapSheetRowToPca, type LinhaPlanilha } from '../lib/csv';
import {
  Processo,
  Setor,
  Usuario,
  MovimentacaoProcesso,
  PCA,
  Alerta,
  Parecer,
  Contrato,
  ProcedimentoLicitatorio,
  ProcessoSancionatorio,
  PortariaFiscal,
} from '../types';

const URL_PLANILHA_PCA =
  'https://docs.google.com/spreadsheets/d/1-XrRG5oLqrcMPLNHePm3KS4671vCp1r0/gviz/tq?tqx=out:csv&sheet=GERAL%20PCA';

interface AppContextData {
  setores: Setor[];
  usuarios: Usuario[];
  processos: Processo[];
  pcas: PCA[];
  movimentacoes: MovimentacaoProcesso[];
  alertas: Alerta[];
  pareceres: Parecer[];
  contratos: Contrato[];
  procedimentos: ProcedimentoLicitatorio[];
  sancionatorios: ProcessoSancionatorio[];
  portarias: PortariaFiscal[];
  usuarioAtual: Usuario | null;
  isAuthenticated: boolean;
  /** true enquanto o estado de autenticação ainda não foi resolvido. */
  carregandoAuth: boolean;
  /** false quando faltam as variáveis VITE_FIREBASE_* no .env. */
  firebaseConfigurado: boolean;
  login: (email: string, senha?: string) => Promise<void>;
  logout: () => Promise<void>;
  solicitarAcesso: (dados: {
    nome: string;
    email: string;
    senha: string;
    cargo?: string;
  }) => Promise<void>;
  enviarResetSenha: (email: string) => Promise<void>;
  addProcesso: (
    processo: Omit<
      Processo,
      'id' | 'criado_em' | 'atualizado_em' | 'status' | 'possui_alerta' | 'data_abertura'
    >,
  ) => Promise<void>;
  updateProcessoStatus: (
    id: string,
    status: Processo['status'],
    fase_id?: string,
  ) => Promise<void>;
  updateProcesso: (id: string, dados: Partial<Processo>) => Promise<void>;
  addMovimentacao: (
    movimentacao: Omit<MovimentacaoProcesso, 'id' | 'data_movimentacao'>,
  ) => Promise<void>;
  syncPcasFromPublicUrl: (url: string) => Promise<void>;
  updateUsuario: (id: string, dados: Partial<Usuario>) => Promise<void>;
  addUsuario: (dados: Omit<Usuario, 'id'> & { senha?: string }) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  addContrato: (dados: Omit<Contrato, 'id'>) => Promise<void>;
  updateContrato: (id: string, dados: Partial<Contrato>) => Promise<void>;
  deleteContrato: (id: string) => Promise<void>;
  addProcedimento: (dados: Omit<ProcedimentoLicitatorio, 'id'>) => Promise<void>;
  updateProcedimento: (id: string, dados: Partial<ProcedimentoLicitatorio>) => Promise<void>;
  addSancionatorio: (dados: Omit<ProcessoSancionatorio, 'id'>) => Promise<void>;
  updateSancionatorio: (id: string, dados: Partial<ProcessoSancionatorio>) => Promise<void>;
  addPortaria: (dados: Omit<PortariaFiscal, 'id'>) => Promise<void>;
  updatePortaria: (id: string, dados: Partial<PortariaFiscal>) => Promise<void>;
}

/**
 * Setores são configuração estática do fluxo do CBMPA (não são dados de
 * usuário), por isso continuam no código.
 */
const SETORES: Setor[] = [
  { id: '1', nome: 'Demandante', sigla: 'DEM', ordem_fluxo: 1 },
  { id: '2', nome: 'Diretoria de Finanças / FEBOM', sigla: 'DF/FEBOM', ordem_fluxo: 2 },
  { id: '3', nome: 'Gabinete do Cmt Geral', sigla: 'GCG', ordem_fluxo: 3 },
  { id: '4', nome: 'Secretaria de Planejamento e Admnistração', sigla: 'SEPLAD', ordem_fluxo: 4 },
  {
    id: '5',
    nome: 'Grupo de Trabalho de Acompanhamento Financeiro',
    sigla: 'GTAF',
    ordem_fluxo: 5,
  },
  { id: '6', nome: 'Consultoria Jurídica', sigla: 'CONJUR', ordem_fluxo: 6 },
  { id: '7', nome: 'Delegacia de Controle Administrativo', sigla: 'DCA', ordem_fluxo: 7 },
];

const AppContext = createContext<AppContextData>({} as AppContextData);

/** Assina uma coleção do Firestore em tempo real (somente quando autenticado). */
function useColecao<T extends { id: string }>(nome: string, ativo: boolean): T[] {
  const [dados, setDados] = useState<T[]>([]);

  useEffect(() => {
    const db = getDb();
    if (!ativo || !db) {
      setDados([]);
      return;
    }

    const cancelar = onSnapshot(
      collection(db, nome),
      (snapshot) => {
        setDados(
          snapshot.docs.map((documento) => ({
            ...(documento.data() as object),
            id: documento.id,
          })) as T[],
        );
      },
      (erro) => {
        console.error(`Erro ao carregar a coleção "${nome}":`, erro);
      },
    );

    return () => cancelar();
  }, [nome, ativo]);

  return dados;
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(isFirebaseConfigured);

  // --- Autenticação -------------------------------------------------------
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setCarregandoAuth(false);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setPerfil(null);
        setCarregandoAuth(false);
      }
    });
  }, []);

  // Documento de perfil (coleção `usuarios`, id = UID do Firebase Auth).
  useEffect(() => {
    const db = getDb();
    if (!authUser || !db) {
      setPerfil(null);
      return;
    }

    setCarregandoAuth(true);
    const cancelar = onSnapshot(
      doc(db, 'usuarios', authUser.uid),
      (snapshot) => {
        setPerfil(
          snapshot.exists()
            ? ({ ...(snapshot.data() as object), id: snapshot.id } as Usuario)
            : null,
        );
        setCarregandoAuth(false);
      },
      (erro) => {
        console.error('Erro ao carregar o perfil do usuário:', erro);
        setPerfil(null);
        setCarregandoAuth(false);
      },
    );

    return () => cancelar();
  }, [authUser]);

  const usuarioAtual = perfil && perfil.ativo ? perfil : null;
  const isAuthenticated = !!usuarioAtual;

  // --- Coleções -----------------------------------------------------------
  const usuarios = useColecao<Usuario>('usuarios', isAuthenticated);
  const processos = useColecao<Processo>('processos', isAuthenticated);
  const movimentacoes = useColecao<MovimentacaoProcesso>('movimentacoes', isAuthenticated);
  const pcas = useColecao<PCA>('pcas', isAuthenticated);
  const alertas = useColecao<Alerta>('alertas', isAuthenticated);
  const pareceres = useColecao<Parecer>('pareceres', isAuthenticated);
  const contratos = useColecao<Contrato>('contratos', isAuthenticated);
  const procedimentos = useColecao<ProcedimentoLicitatorio>('procedimentos', isAuthenticated);
  const sancionatorios = useColecao<ProcessoSancionatorio>('sancionatorios', isAuthenticated);
  const portarias = useColecao<PortariaFiscal>('portarias', isAuthenticated);

  // --- Autenticação: ações ------------------------------------------------
  const login = useCallback(async (email: string, senha?: string) => {
    try {
      const auth = requireFirebaseAuth();
      const db = requireDb();
      const credencial = await signInWithEmailAndPassword(auth, email, senha ?? '');
      const perfilSnap = await getDoc(doc(db, 'usuarios', credencial.user.uid));

      if (!perfilSnap.exists()) {
        await signOut(auth);
        throw new Error(
          'Perfil de usuário não encontrado no sistema. Solicite acesso ao administrador.',
        );
      }

      const perfilCarregado = {
        ...(perfilSnap.data() as object),
        id: perfilSnap.id,
      } as Usuario;

      if (!perfilCarregado.ativo) {
        await signOut(auth);
        throw new Error('Seu usuário ainda não foi aprovado por um administrador.');
      }

      setPerfil(perfilCarregado);
    } catch (erro) {
      throw new Error(mensagemErroAuth(erro));
    }
  }, []);

  const logout = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
    setPerfil(null);
    setAuthUser(null);
  }, []);

  const solicitarAcesso = useCallback(
    async ({
      nome,
      email,
      senha,
      cargo,
    }: {
      nome: string;
      email: string;
      senha: string;
      cargo?: string;
    }) => {
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const credencial = await createUserWithEmailAndPassword(auth, email, senha);

        // O perfil nasce inativo: um master precisa aprovar em /sistema/usuarios.
        await setDoc(doc(db, 'usuarios', credencial.user.uid), {
          nome,
          email,
          cargo: cargo ?? '',
          perfil: 'fiscal',
          setor_id: '1',
          ativo: false,
        });

        await signOut(auth);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [],
  );

  const enviarResetSenha = useCallback(async (email: string) => {
    try {
      const auth = requireFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
    } catch (erro) {
      throw new Error(mensagemErroAuth(erro));
    }
  }, []);

  // --- PCA ----------------------------------------------------------------
  const gravarPcas = useCallback(async (novos: PCA[]) => {
    const db = getDb();
    if (!db || novos.length === 0) return;

    // Firestore aceita no máximo 500 operações por lote.
    for (let inicio = 0; inicio < novos.length; inicio += 400) {
      const lote = writeBatch(db);
      novos.slice(inicio, inicio + 400).forEach((pca) => {
        const campos: Record<string, unknown> = { ...pca };
        lote.set(doc(db, 'pcas', pca.id), campos);
      });
      await lote.commit();
    }
  }, []);

  /**
   * Importa o PCA da planilha pública do CBMPA e persiste em `pcas`.
   * Roda apenas uma vez, quando o usuário está autenticado e a coleção
   * ainda está vazia — depois disso os dados vêm do Firestore.
   */
  useEffect(() => {
    if (!isAuthenticated || pcas.length > 0) return;

    let cancelado = false;

    const importarPcas = async () => {
      try {
        const resposta = await fetch(URL_PLANILHA_PCA);
        if (!resposta.ok) return;

        const csv = await resposta.text();
        const Papa = (await import('papaparse')).default;

        Papa.parse<LinhaPlanilha>(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (resultado) => {
            if (cancelado) return;
            const novos = resultado.data
              .map((linha, indice) => mapSheetRowToPca(linha, indice))
              .filter((pca) => !!pca.codigo_pca);
            if (novos.length > 0) {
              gravarPcas(novos).catch((erro) =>
                console.error('Erro ao gravar o PCA no Firestore:', erro),
              );
            }
          },
        });
      } catch (erro) {
        console.error('Erro ao carregar PCAs automaticamente', erro);
      }
    };

    importarPcas();
    return () => {
      cancelado = true;
    };
  }, [isAuthenticated, pcas.length, gravarPcas]);

  const syncPcasFromPublicUrl = useCallback(
    async (url: string) => {
      try {
        const correspondencia = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!correspondencia) {
          throw new Error('URL inválida. Não foi possível encontrar o ID da planilha.');
        }

        const fetchUrl = `https://docs.google.com/spreadsheets/d/${correspondencia[1]}/gviz/tq?tqx=out:csv`;
        const resposta = await fetch(fetchUrl);
        if (!resposta.ok) {
          throw new Error(
            "Não foi possível acessar a planilha. Verifique se ela está pública ('Qualquer pessoa com o link').",
          );
        }

        const csv = await resposta.text();
        const Papa = (await import('papaparse')).default;

        const resultado = Papa.parse<string[]>(csv, {
          header: false,
          skipEmptyLines: true,
        });

        const linhas = resultado.data;
        if (linhas.length <= 1) {
          alert('A planilha parece estar vazia ou a estrutura não foi reconhecida.');
          return;
        }

        const novos = linhas
          .slice(1)
          .map((colunas, indice) => mapSheetArrayToPca(colunas, indice));

        await gravarPcas(novos);
        alert(`Sincronizado ${novos.length} itens do PCA!`);
      } catch (erro) {
        console.error('Sync error: ', erro);
        alert(
          'Erro ao sincronizar planilha: ' +
            (erro instanceof Error ? erro.message : String(erro)),
        );
      }
    },
    [gravarPcas],
  );

  // --- Movimentações / Processos ------------------------------------------
  const addMovimentacao = useCallback(
    async (dados: Omit<MovimentacaoProcesso, 'id' | 'data_movimentacao'>) => {
      const db = requireDb();
      await addDoc(collection(db, 'movimentacoes'), {
        ...dados,
        data_movimentacao: new Date().toISOString(),
      });
    },
    [],
  );

  const addProcesso = useCallback(
    async (
      dados: Omit<
        Processo,
        'id' | 'criado_em' | 'atualizado_em' | 'status' | 'possui_alerta' | 'data_abertura'
      >,
    ) => {
      const db = requireDb();
      const agora = new Date().toISOString();
      const novoProcesso = {
        ...dados,
        status: 'em_andamento' as const,
        fase_atual_id: dados.fase_atual_id || '1',
        possui_alerta: false,
        data_abertura: agora,
        data_entrada: dados.data_entrada || agora,
        ultima_tramitacao: dados.ultima_tramitacao || agora,
        criado_em: agora,
        atualizado_em: agora,
      };

      const referencia = await addDoc(collection(db, 'processos'), novoProcesso);

      await addMovimentacao({
        processo_id: referencia.id,
        setor_id: novoProcesso.fase_atual_id,
        usuario_id: usuarioAtual?.id ?? '',
        status_movimentacao: 'concluido',
        observacao: 'Abertura do processo',
      });
    },
    [addMovimentacao, usuarioAtual],
  );

  const updateProcesso = useCallback(async (id: string, dados: Partial<Processo>) => {
    const db = requireDb();
    await updateDoc(doc(db, 'processos', id), {
      ...dados,
      atualizado_em: new Date().toISOString(),
    });
  }, []);

  const updateProcessoStatus = useCallback(
    async (id: string, status: Processo['status'], fase_id?: string) => {
      const db = requireDb();
      await updateDoc(doc(db, 'processos', id), {
        status,
        ...(fase_id
          ? { fase_atual_id: fase_id, ultima_tramitacao: new Date().toISOString() }
          : {}),
        atualizado_em: new Date().toISOString(),
      });
    },
    [],
  );

  // --- Usuários -----------------------------------------------------------
  const updateUsuario = useCallback(async (id: string, dados: Partial<Usuario>) => {
    const db = requireDb();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    delete campos.senha;
    await updateDoc(doc(db, 'usuarios', id), campos);
  }, []);

  /**
   * Cria a conta no Firebase Auth (numa instância isolada, para não derrubar a
   * sessão do master) e o documento de perfil correspondente. A senha nunca é
   * gravada no Firestore.
   */
  const addUsuario = useCallback(
    async (dados: Omit<Usuario, 'id'> & { senha?: string }) => {
      try {
        const db = requireDb();
        const { senha, ...perfilNovo } = dados;
        if (!senha) {
          throw new Error('Informe uma senha inicial para o novo usuário.');
        }

        const uid = await criarContaAuthIsolada(perfilNovo.email, senha);
        const campos: Record<string, unknown> = { ...perfilNovo };
        delete campos.senha;
        await setDoc(doc(db, 'usuarios', uid), campos);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [],
  );

  /**
   * Remove o documento de perfil. A conta no Firebase Authentication só pode
   * ser excluída pelo Console ou pelo Admin SDK (não é possível pelo cliente).
   */
  const deleteUsuario = useCallback(
    async (id: string) => {
      const db = requireDb();
      await deleteDoc(doc(db, 'usuarios', id));
      if (usuarioAtual?.id === id) {
        await logout();
      }
    },
    [logout, usuarioAtual],
  );

  // --- Contratos e afins --------------------------------------------------
  const criarEm = useCallback(async (colecao: string, dados: object) => {
    const db = requireDb();
    const agora = new Date().toISOString();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    campos.criado_em = agora;
    campos.atualizado_em = agora;
    await addDoc(collection(db, colecao), campos);
  }, []);

  const atualizarEm = useCallback(async (colecao: string, id: string, dados: object) => {
    const db = requireDb();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    campos.atualizado_em = new Date().toISOString();
    await updateDoc(doc(db, colecao, id), campos);
  }, []);

  const addContrato = useCallback(
    (dados: Omit<Contrato, 'id'>) => criarEm('contratos', dados),
    [criarEm],
  );
  const updateContrato = useCallback(
    (id: string, dados: Partial<Contrato>) => atualizarEm('contratos', id, dados),
    [atualizarEm],
  );
  const deleteContrato = useCallback(async (id: string) => {
    const db = requireDb();
    await deleteDoc(doc(db, 'contratos', id));
  }, []);

  const addProcedimento = useCallback(
    (dados: Omit<ProcedimentoLicitatorio, 'id'>) => criarEm('procedimentos', dados),
    [criarEm],
  );
  const updateProcedimento = useCallback(
    (id: string, dados: Partial<ProcedimentoLicitatorio>) =>
      atualizarEm('procedimentos', id, dados),
    [atualizarEm],
  );

  const addSancionatorio = useCallback(
    (dados: Omit<ProcessoSancionatorio, 'id'>) => criarEm('sancionatorios', dados),
    [criarEm],
  );
  const updateSancionatorio = useCallback(
    (id: string, dados: Partial<ProcessoSancionatorio>) =>
      atualizarEm('sancionatorios', id, dados),
    [atualizarEm],
  );

  const addPortaria = useCallback(
    (dados: Omit<PortariaFiscal, 'id'>) => criarEm('portarias', dados),
    [criarEm],
  );
  const updatePortaria = useCallback(
    (id: string, dados: Partial<PortariaFiscal>) => atualizarEm('portarias', id, dados),
    [atualizarEm],
  );

  const valor = useMemo<AppContextData>(
    () => ({
      setores: SETORES,
      usuarios,
      processos,
      pcas,
      movimentacoes,
      alertas,
      pareceres,
      contratos,
      procedimentos,
      sancionatorios,
      portarias,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      firebaseConfigurado: isFirebaseConfigured,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      addProcesso,
      updateProcessoStatus,
      updateProcesso,
      addMovimentacao,
      syncPcasFromPublicUrl,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addContrato,
      updateContrato,
      deleteContrato,
      addProcedimento,
      updateProcedimento,
      addSancionatorio,
      updateSancionatorio,
      addPortaria,
      updatePortaria,
    }),
    [
      usuarios,
      processos,
      pcas,
      movimentacoes,
      alertas,
      pareceres,
      contratos,
      procedimentos,
      sancionatorios,
      portarias,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      addProcesso,
      updateProcessoStatus,
      updateProcesso,
      addMovimentacao,
      syncPcasFromPublicUrl,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addContrato,
      updateContrato,
      deleteContrato,
      addProcedimento,
      updateProcedimento,
      addSancionatorio,
      updateSancionatorio,
      addPortaria,
      updatePortaria,
    ],
  );

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
