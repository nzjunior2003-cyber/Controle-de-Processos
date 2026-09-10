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
  runTransaction,
  serverTimestamp,
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
import {
  mapSheetArrayToPca,
  mapSheetRowToPca,
  mapSheetRowToProcesso,
  type LinhaPlanilha,
  type ProcessoDaPlanilha,
} from '../lib/csv';
import { localizacaoEfetiva, type EstadaProcesso } from '../lib/fluxoProcesso';
import {
  ABA_GESTAO_CONTRATOS,
  mapLinhaContratoDaPlanilha,
  type ContratoDaPlanilha,
} from '../lib/planilhaContratos';
import {
  abaterSaldo,
  aplicarAditivoFinanceiro,
  devolverSaldo,
  gestorRaizDe,
  validarLimiteFiscal,
  type Aditivo,
  type ExecucaoContrato,
  type Ocorrencia,
} from '../lib/contratos';
import {
  resumirAuditoria,
  type AcaoAuditoria,
  type LogAcesso,
  type LogAuditoria,
} from '../lib/auditoria';
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
  estadasProcesso: EstadaProcesso[];
  alertas: Alerta[];
  pareceres: Parecer[];
  contratos: Contrato[];
  execucoes: ExecucaoContrato[];
  ocorrencias: Ocorrencia[];
  aditivos: Aditivo[];
  procedimentos: ProcedimentoLicitatorio[];
  sancionatorios: ProcessoSancionatorio[];
  portarias: PortariaFiscal[];
  /** Só é populado para o perfil 'master' (mesma restrição das firestore.rules). */
  logsAcesso: LogAcesso[];
  /** Só é populado para o perfil 'master' (mesma restrição das firestore.rules). */
  logsAuditoria: LogAuditoria[];
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
  ) => Promise<string>;
  deleteProcesso: (id: string) => Promise<void>;
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
  syncProcessosDaPlanilha: (
    url: string,
  ) => Promise<{ criados: number; atualizados: number; ignorados: number }>;
  syncContratosDaPlanilha: (
    url: string,
  ) => Promise<{ criados: number; atualizados: number; ignorados: number }>;
  updateUsuario: (id: string, dados: Partial<Usuario>) => Promise<void>;
  addUsuario: (dados: Omit<Usuario, 'id'> & { senha?: string }) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  addContrato: (dados: Omit<Contrato, 'id'>) => Promise<string>;
  updateContrato: (id: string, dados: Partial<Contrato>) => Promise<void>;
  deleteContrato: (id: string) => Promise<void>;
  addExecucao: (dados: Omit<ExecucaoContrato, 'id'>) => Promise<void>;
  deleteExecucao: (id: string, contratoId: string) => Promise<void>;
  addOcorrencia: (dados: Omit<Ocorrencia, 'id'>) => Promise<void>;
  addAditivo: (dados: Omit<Aditivo, 'id'>) => Promise<void>;
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
  const estadasProcesso = useColecao<EstadaProcesso>('estadas_processo', isAuthenticated);
  const movimentacoes = useColecao<MovimentacaoProcesso>('movimentacoes', isAuthenticated);
  const pcas = useColecao<PCA>('pcas', isAuthenticated);
  const alertas = useColecao<Alerta>('alertas', isAuthenticated);
  const pareceres = useColecao<Parecer>('pareceres', isAuthenticated);
  const contratos = useColecao<Contrato>('contratos', isAuthenticated);
  const execucoes = useColecao<ExecucaoContrato>('execucoes', isAuthenticated);
  const ocorrencias = useColecao<Ocorrencia>('ocorrencias', isAuthenticated);
  const aditivos = useColecao<Aditivo>('aditivos', isAuthenticated);
  const procedimentos = useColecao<ProcedimentoLicitatorio>('procedimentos', isAuthenticated);
  const sancionatorios = useColecao<ProcessoSancionatorio>('sancionatorios', isAuthenticated);
  const portarias = useColecao<PortariaFiscal>('portarias', isAuthenticated);
  // Leitura restrita a 'master' nas firestore.rules — só assina quando fizer
  // sentido, para não gerar erros de permissão para os demais perfis.
  const podeVerLogs = isAuthenticated && usuarioAtual?.perfil === 'master';
  const logsAcesso = useColecao<LogAcesso>('logs_acesso', podeVerLogs);
  const logsAuditoria = useColecao<LogAuditoria>('logs_auditoria', podeVerLogs);

  // --- Autenticação: ações ------------------------------------------------
  /**
   * Grava um log de acesso (coleção `logs_acesso`), sucesso ou falha. Nunca
   * lança: uma falha ao registrar o log não pode travar o login.
   */
  const registrarLogAcesso = useCallback(
    async (userId: string | null, email: string, sucesso: boolean) => {
      try {
        const db = getDb();
        if (!db) return;
        await addDoc(collection(db, 'logs_acesso'), {
          userId,
          email,
          sucesso,
          dataHora: serverTimestamp(),
          userAgent: navigator.userAgent,
        });
      } catch (erro) {
        console.error('Erro ao registrar log de acesso:', erro);
      }
    },
    [],
  );

  const login = useCallback(
    async (email: string, senha?: string) => {
      let userIdParaLog: string | null = null;
      try {
        const auth = requireFirebaseAuth();
        const db = requireDb();
        const credencial = await signInWithEmailAndPassword(auth, email, senha ?? '');
        userIdParaLog = credencial.user.uid;
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
        await registrarLogAcesso(userIdParaLog, email, true);
      } catch (erro) {
        await registrarLogAcesso(userIdParaLog, email, false);
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [registrarLogAcesso],
  );

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

  /**
   * Sincroniza os processos com a planilha de controle da equipe (a mesma
   * atualizada pelo RPA de acompanhamento no PAE): casa cada linha pelo
   * número do processo — atualiza o que já existe (status, localização
   * atual, andamento, datas etc.) e cria o que ainda não estava cadastrado.
   * Não mexe em campos que o próprio sistema passa a gerenciar depois de
   * criado (fase_atual_id do fluxo interno, pca_id, checklist_rito).
   */
  /**
   * Garante que a "estada" atual do processo (coleção `estadas_processo`)
   * bate com a localização informada: se a localização mudou desde a
   * última estada aberta, fecha a antiga e abre uma nova. Alimenta o
   * histórico de fluxo/Gantt de cada processo (por localização real, não
   * pelo fluxo fixo de 7 setores).
   */
  const sincronizarEstada = useCallback(
    async (processoId: string, novaLocalizacao: string, dataMudanca: string) => {
      if (!novaLocalizacao) return;
      const db = requireDb();
      const aberta = estadasProcesso.find(
        (e) => e.processo_id === processoId && e.data_fim === null,
      );

      if (aberta && aberta.localizacao === novaLocalizacao) return;

      if (aberta) {
        await updateDoc(doc(db, 'estadas_processo', aberta.id), { data_fim: dataMudanca });
      }
      await addDoc(collection(db, 'estadas_processo'), {
        processo_id: processoId,
        localizacao: novaLocalizacao,
        data_inicio: dataMudanca,
        data_fim: null,
        criado_em: new Date().toISOString(),
      });
    },
    [estadasProcesso],
  );

  const syncProcessosDaPlanilha = useCallback(
    async (url: string) => {
      const db = requireDb();
      const correspondencia = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!correspondencia) {
        throw new Error('URL inválida. Não foi possível encontrar o ID da planilha.');
      }

      const fetchUrl = `https://docs.google.com/spreadsheets/d/${correspondencia[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Processos 2026')}`;
      const resposta = await fetch(fetchUrl);
      if (!resposta.ok) {
        throw new Error(
          "Não foi possível acessar a planilha. Verifique se ela está pública ('Qualquer pessoa com o link').",
        );
      }

      const csv = await resposta.text();
      const Papa = (await import('papaparse')).default;

      const linhas = await new Promise<LinhaPlanilha[]>((resolve) => {
        Papa.parse<LinhaPlanilha>(csv, {
          header: true,
          skipEmptyLines: true,
          complete: (resultado) => resolve(resultado.data),
        });
      });

      const validas = linhas
        .map((linha) => mapSheetRowToProcesso(linha))
        .filter((p): p is ProcessoDaPlanilha => p !== null);

      let criados = 0;
      let atualizados = 0;
      // Evita criar duplicados quando o mesmo número aparece mais de uma
      // vez na planilha e ainda não existe no Firestore (o lote inteiro
      // ainda não foi confirmado, então `processos` não reflete as
      // criações anteriores deste mesmo lote).
      const idsCriadosNestaSincronizacao = new Map<string, string>();
      const mudancasDeLocalizacao: Array<{
        processoId: string;
        localizacao: string;
        dataMudanca: string;
      }> = [];

      for (let inicio = 0; inicio < validas.length; inicio += 400) {
        const lote = writeBatch(db);
        const agora = new Date().toISOString();

        validas.slice(inicio, inicio + 400).forEach((dados) => {
          const { numero_processo, ...resto } = dados;
          const campos = Object.fromEntries(
            Object.entries(resto).filter(([, v]) => v !== undefined),
          );

          const idExistente =
            processos.find((p) => p.numero_processo === numero_processo)?.id ??
            idsCriadosNestaSincronizacao.get(numero_processo);

          if (idExistente) {
            lote.set(
              doc(db, 'processos', idExistente),
              { ...campos, numero_processo, atualizado_em: agora },
              { merge: true },
            );
            atualizados++;
            if (dados.localizacao_atual) {
              mudancasDeLocalizacao.push({
                processoId: idExistente,
                localizacao: dados.localizacao_atual,
                dataMudanca: dados.ultima_tramitacao || agora,
              });
            }
          } else {
            const novaRef = doc(collection(db, 'processos'));
            idsCriadosNestaSincronizacao.set(numero_processo, novaRef.id);
            lote.set(novaRef, {
              ...campos,
              numero_processo,
              demandante_id: '',
              fase_atual_id: '1',
              possui_alerta: false,
              data_abertura: dados.data_entrada || agora,
              criado_em: agora,
              atualizado_em: agora,
            });
            criados++;
            if (dados.localizacao_atual) {
              // Primeira estada: melhor estimativa possível é "desde a
              // data de entrada" — o histórico anterior a esta
              // funcionalidade não existe.
              mudancasDeLocalizacao.push({
                processoId: novaRef.id,
                localizacao: dados.localizacao_atual,
                dataMudanca: dados.data_entrada || dados.ultima_tramitacao || agora,
              });
            }
          }
        });

        await lote.commit();
      }

      // Sequencial (não em paralelo): sincronizarEstada lê o estado atual
      // de `estadasProcesso` para decidir se abre uma estada nova, e esse
      // estado só é confiável se as chamadas não pisarem uma na outra.
      for (const mudanca of mudancasDeLocalizacao) {
        await sincronizarEstada(mudanca.processoId, mudanca.localizacao, mudanca.dataMudanca);
      }

      return { criados, atualizados, ignorados: linhas.length - validas.length };
    },
    [processos, sincronizarEstada],
  );

  /**
   * Importa os contratos da aba "Gestão de Contratos" da planilha para o
   * app: cria os que ainda não existem (casando pelo N° do Contrato) e
   * atualiza os campos que a planilha controla nos que já existem. Como a
   * planilha não tem valor global/saldo (conceito só do app, usado para
   * abater as execuções), um contrato novo importado usa o Valor do PRD
   * como estimativa inicial de saldo — o Gestor pode corrigir na edição.
   */
  const syncContratosDaPlanilha = useCallback(
    async (url: string) => {
      const db = requireDb();
      const correspondencia = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!correspondencia) {
        throw new Error('URL inválida. Não foi possível encontrar o ID da planilha.');
      }

      const fetchUrl = `https://docs.google.com/spreadsheets/d/${correspondencia[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(ABA_GESTAO_CONTRATOS)}`;
      const resposta = await fetch(fetchUrl);
      if (!resposta.ok) {
        throw new Error(
          "Não foi possível acessar a planilha. Verifique se ela está pública ('Qualquer pessoa com o link').",
        );
      }

      const csv = await resposta.text();
      const Papa = (await import('papaparse')).default;

      const linhas = await new Promise<string[][]>((resolve) => {
        Papa.parse<string[]>(csv, {
          header: false,
          skipEmptyLines: true,
          complete: (resultado) => resolve(resultado.data),
        });
      });

      // A primeira linha é cabeçalho; os dados reais começam na segunda.
      const linhasDeDados = linhas.slice(1);
      const validos = linhasDeDados
        .map((linha) => mapLinhaContratoDaPlanilha(linha))
        .filter((c): c is ContratoDaPlanilha => c !== null);

      let criados = 0;
      let atualizados = 0;
      const idsCriadosNestaSincronizacao = new Map<string, string>();

      for (let inicio = 0; inicio < validos.length; inicio += 400) {
        const lote = writeBatch(db);
        const agora = new Date().toISOString();

        validos.slice(inicio, inicio + 400).forEach((dados) => {
          const { numero, ...resto } = dados;
          const campos = Object.fromEntries(
            Object.entries(resto).filter(([, v]) => v !== undefined),
          );

          const idExistente =
            contratos.find((c) => c.numero === numero)?.id ??
            idsCriadosNestaSincronizacao.get(numero);

          if (idExistente) {
            lote.set(
              doc(db, 'contratos', idExistente),
              { ...campos, numero, atualizado_em: agora },
              { merge: true },
            );
            atualizados++;
          } else {
            const novaRef = doc(collection(db, 'contratos'));
            idsCriadosNestaSincronizacao.set(numero, novaRef.id);
            const valorBase = dados.valorPRD ?? 0;
            lote.set(novaRef, {
              ...campos,
              numero,
              pae: '',
              valorGlobal: valorBase,
              saldoInicialFinanceiro: valorBase,
              saldoAtualFinanceiro: valorBase,
              inicioVigencia: dados.inicioVigencia || agora,
              fimVigencia: dados.fimVigencia || agora,
              criado_em: agora,
              atualizado_em: agora,
            });
            criados++;
          }
        });

        await lote.commit();
      }

      return { criados, atualizados, ignorados: linhasDeDados.length - validos.length };
    },
    [contratos],
  );

  /**
   * Grava um log de auditoria (coleção `logs_auditoria`) para uma alteração
   * de dados. Nunca lança: uma falha ao registrar o log não pode impedir a
   * operação principal que a chamou.
   */
  const registrarAuditoria = useCallback(
    async (
      colecao: string,
      documentoId: string,
      acao: AcaoAuditoria,
      dados: object,
      anterior?: object,
    ) => {
      try {
        const db = getDb();
        if (!db || !usuarioAtual) return;
        await addDoc(collection(db, 'logs_auditoria'), {
          colecao,
          documentoId,
          acao,
          usuarioId: usuarioAtual.id,
          usuarioNome: usuarioAtual.nome,
          dataHora: serverTimestamp(),
          resumo: resumirAuditoria(acao, dados, anterior),
        });
      } catch (erro) {
        console.error('Erro ao registrar log de auditoria:', erro);
      }
    },
    [usuarioAtual],
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

      await sincronizarEstada(
        referencia.id,
        localizacaoEfetiva(novoProcesso, (setorId) => SETORES.find((s) => s.id === setorId)?.sigla),
        novoProcesso.data_entrada,
      );

      await registrarAuditoria('processos', referencia.id, 'CREATE', novoProcesso);

      return referencia.id;
    },
    [addMovimentacao, usuarioAtual, sincronizarEstada, registrarAuditoria],
  );

  /**
   * Remove um processo (ex.: cadastro feito por engano). Não apaga o
   * histórico de movimentações/estadas associado — fica órfão, mas
   * inofensivo (nada mais referencia um processo que não existe mais).
   */
  const deleteProcesso = useCallback(
    async (id: string) => {
      const db = requireDb();
      const anterior = processos.find((p) => p.id === id);
      await deleteDoc(doc(db, 'processos', id));
      await registrarAuditoria('processos', id, 'DELETE', {}, anterior);
    },
    [processos, registrarAuditoria],
  );

  const updateProcesso = useCallback(
    async (id: string, dados: Partial<Processo>) => {
      const db = requireDb();
      const anterior = processos.find((p) => p.id === id);

      await updateDoc(doc(db, 'processos', id), {
        ...dados,
        atualizado_em: new Date().toISOString(),
      });

      if (anterior && (dados.localizacao_atual !== undefined || dados.fase_atual_id !== undefined)) {
        const siglaDoSetor = (setorId: string) => SETORES.find((s) => s.id === setorId)?.sigla;
        const novaLocalizacao = localizacaoEfetiva({ ...anterior, ...dados }, siglaDoSetor);
        await sincronizarEstada(id, novaLocalizacao, new Date().toISOString());
      }

      await registrarAuditoria('processos', id, 'UPDATE', dados, anterior);
    },
    [processos, sincronizarEstada, registrarAuditoria],
  );

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
  const updateUsuario = useCallback(
    async (id: string, dados: Partial<Usuario>) => {
      const db = requireDb();
      const campos: Record<string, unknown> = { ...dados };
      delete campos.id;
      delete campos.senha;
      const anterior = usuarios.find((u) => u.id === id);
      await updateDoc(doc(db, 'usuarios', id), campos);
      await registrarAuditoria('usuarios', id, 'UPDATE', campos, anterior);
    },
    [usuarios, registrarAuditoria],
  );

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
        await registrarAuditoria('usuarios', uid, 'CREATE', campos);
      } catch (erro) {
        throw new Error(mensagemErroAuth(erro));
      }
    },
    [registrarAuditoria],
  );

  /**
   * Remove o documento de perfil. A conta no Firebase Authentication só pode
   * ser excluída pelo Console ou pelo Admin SDK (não é possível pelo cliente).
   */
  const deleteUsuario = useCallback(
    async (id: string) => {
      const db = requireDb();
      const anterior = usuarios.find((u) => u.id === id);
      await deleteDoc(doc(db, 'usuarios', id));
      await registrarAuditoria('usuarios', id, 'DELETE', {}, anterior);
      if (usuarioAtual?.id === id) {
        await logout();
      }
    },
    [logout, usuarioAtual, usuarios, registrarAuditoria],
  );

  // --- Contratos e afins --------------------------------------------------
  const criarEm = useCallback(async (colecao: string, dados: object) => {
    const db = requireDb();
    const agora = new Date().toISOString();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    campos.criado_em = agora;
    campos.atualizado_em = agora;
    const referencia = await addDoc(collection(db, colecao), campos);
    return referencia.id;
  }, []);

  const atualizarEm = useCallback(async (colecao: string, id: string, dados: object) => {
    const db = requireDb();
    const campos: Record<string, unknown> = { ...dados };
    delete campos.id;
    campos.atualizado_em = new Date().toISOString();
    await updateDoc(doc(db, colecao, id), campos);
  }, []);

  const addContrato = useCallback(
    async (dados: Omit<Contrato, 'id'>) => {
      if (dados.fiscalEmail && !validarLimiteFiscal(contratos, dados.fiscalEmail).valido) {
        throw new Error(
          'Este fiscal já possui 3 contratos ativos sob sua titularidade (limite atingido).',
        );
      }

      // O saldo atual sempre nasce igual ao saldo inicial informado pelo
      // Gestor no cadastro, e o contrato sempre fica amarrado ao Gestor
      // "raiz" correto — independente do que vier em `dados` ou de quem
      // efetivamente preencheu o cadastro (Gestor ou seu Auxiliar).
      const contratoCompleto: Omit<Contrato, 'id'> = {
        ...dados,
        saldoAtualFinanceiro: dados.saldoInicialFinanceiro,
        ...(typeof dados.saldoInicialQuantitativo === 'number'
          ? { saldoAtualQuantitativo: dados.saldoInicialQuantitativo }
          : {}),
        ...(gestorRaizDe(usuarioAtual) ? { gestorGeralId: gestorRaizDe(usuarioAtual) } : {}),
      };
      const id = await criarEm('contratos', contratoCompleto);
      await registrarAuditoria('contratos', id, 'CREATE', contratoCompleto);
      return id;
    },
    [criarEm, contratos, usuarioAtual, registrarAuditoria],
  );
  const updateContrato = useCallback(
    async (id: string, dados: Partial<Contrato>) => {
      if (dados.fiscalEmail && !validarLimiteFiscal(contratos, dados.fiscalEmail, id).valido) {
        throw new Error(
          'Este fiscal já possui 3 contratos ativos sob sua titularidade (limite atingido).',
        );
      }
      const anterior = contratos.find((c) => c.id === id);
      await atualizarEm('contratos', id, dados);
      await registrarAuditoria('contratos', id, 'UPDATE', dados, anterior);
    },
    [atualizarEm, contratos, registrarAuditoria],
  );
  const deleteContrato = useCallback(
    async (id: string) => {
      const db = requireDb();
      const anterior = contratos.find((c) => c.id === id);
      await deleteDoc(doc(db, 'contratos', id));
      await registrarAuditoria('contratos', id, 'DELETE', {}, anterior);
    },
    [contratos, registrarAuditoria],
  );

  /**
   * Lança uma execução (NF/fatura/recibo) e abate o saldo do contrato numa
   * única transação, para não perder atualizações se duas NFs forem
   * lançadas ao mesmo tempo.
   */
  const addExecucao = useCallback(async (dados: Omit<ExecucaoContrato, 'id'>) => {
    const db = requireDb();
    const contratoRef = doc(db, 'contratos', dados.contratoId);
    const execucaoRef = doc(collection(db, 'execucoes'));
    const agora = new Date().toISOString();

    await runTransaction(db, async (transacao) => {
      const contratoSnap = await transacao.get(contratoRef);
      if (!contratoSnap.exists()) {
        throw new Error('Contrato não encontrado.');
      }
      const contrato = contratoSnap.data() as Contrato;
      const novoSaldo = abaterSaldo(contrato, dados);

      if (novoSaldo.saldoAtualFinanceiro < 0) {
        console.warn(
          `Saldo financeiro do contrato ${dados.contratoId} ficou negativo: ${novoSaldo.saldoAtualFinanceiro}`,
        );
      }
      if ((novoSaldo.saldoAtualQuantitativo ?? 0) < 0 && 'saldoAtualQuantitativo' in novoSaldo) {
        console.warn(
          `Saldo quantitativo do contrato ${dados.contratoId} ficou negativo: ${novoSaldo.saldoAtualQuantitativo}`,
        );
      }

      transacao.set(execucaoRef, { ...dados, criado_em: agora });
      transacao.update(contratoRef, { ...novoSaldo, atualizado_em: agora });
    });

    await registrarAuditoria('execucoes', execucaoRef.id, 'CREATE', dados);
  }, [registrarAuditoria]);

  /** Remove uma execução e devolve valor/quantidade ao saldo atual do contrato. */
  const deleteExecucao = useCallback(async (id: string, contratoId: string) => {
    const db = requireDb();
    const contratoRef = doc(db, 'contratos', contratoId);
    const execucaoRef = doc(db, 'execucoes', id);

    const execucaoRemovida = await runTransaction(db, async (transacao) => {
      const [contratoSnap, execucaoSnap] = await Promise.all([
        transacao.get(contratoRef),
        transacao.get(execucaoRef),
      ]);
      if (!contratoSnap.exists() || !execucaoSnap.exists()) {
        throw new Error('Contrato ou execução não encontrados.');
      }
      const contrato = contratoSnap.data() as Contrato;
      const execucao = execucaoSnap.data() as ExecucaoContrato;
      const novoSaldo = devolverSaldo(contrato, execucao);

      transacao.delete(execucaoRef);
      transacao.update(contratoRef, { ...novoSaldo, atualizado_em: new Date().toISOString() });
      return execucao;
    });

    await registrarAuditoria('execucoes', id, 'DELETE', {}, execucaoRemovida);
  }, [registrarAuditoria]);

  /**
   * Registra uma ocorrência sobre um contrato: um apontamento (atraso na
   * entrega, atraso de pagamento, desconformidade, item não entregue etc.,
   * descritos livremente em `descricao`) ou uma solicitação de aditivo/
   * esclarecimento. Master/Contratos/Gestão podem registrar em qualquer
   * contrato; um Fiscal só pode registrar (qualquer tipo) para um contrato
   * em que é titular ou suplente — mesma fronteira aplicada nas
   * firestore.rules.
   */
  const addOcorrencia = useCallback(
    async (dados: Omit<Ocorrencia, 'id'>) => {
      const perfil = usuarioAtual?.perfil;
      const gestorOuContratos = perfil === 'master' || perfil === 'gestao' || perfil === 'contratos';

      let podeRegistrar = gestorOuContratos;
      if (!podeRegistrar && perfil === 'fiscal') {
        const contrato = contratos.find((c) => c.id === dados.contratoId);
        podeRegistrar =
          !!contrato &&
          (contrato.fiscalEmail === usuarioAtual?.email ||
            contrato.fiscalSuplenteEmail === usuarioAtual?.email);
      }

      if (!podeRegistrar) {
        throw new Error('Você não tem permissão para registrar esta ocorrência neste contrato.');
      }

      const id = await criarEm('ocorrencias', dados);
      await registrarAuditoria('ocorrencias', id, 'CREATE', dados);
    },
    [criarEm, contratos, usuarioAtual, registrarAuditoria],
  );

  /**
   * Registra um aditivo (financeiro e/ou de prazo, também usado para
   * apostilamentos que mudem valor/vigência) sobre um contrato,
   * atualizando o próprio contrato numa única transação com o registro
   * do aditivo — restrito a Master/Contratos/Gestão, mesma fronteira de
   * quem pode editar o contrato.
   */
  const addAditivo = useCallback(
    async (dados: Omit<Aditivo, 'id'>) => {
      const perfil = usuarioAtual?.perfil;
      const podeRegistrar = perfil === 'master' || perfil === 'gestao' || perfil === 'contratos';
      if (!podeRegistrar) {
        throw new Error('Você não tem permissão para registrar aditivos neste contrato.');
      }

      const db = requireDb();
      const contratoRef = doc(db, 'contratos', dados.contratoId);
      const aditivoRef = doc(collection(db, 'aditivos'));
      const agora = new Date().toISOString();

      const { contratoAntes, atualizacaoContrato } = await runTransaction(db, async (transacao) => {
        const contratoSnap = await transacao.get(contratoRef);
        if (!contratoSnap.exists()) {
          throw new Error('Contrato não encontrado.');
        }
        const contrato = contratoSnap.data() as Contrato;

        const atualizacao: Record<string, unknown> = {};
        if (dados.tipo !== 'PRAZO' && typeof dados.valorAcrescido === 'number') {
          Object.assign(atualizacao, aplicarAditivoFinanceiro(contrato, dados.valorAcrescido));
        }
        if (dados.tipo !== 'FINANCEIRO' && dados.novaFimVigencia) {
          atualizacao.fimVigencia = dados.novaFimVigencia;
        }

        transacao.set(aditivoRef, { ...dados, criado_em: agora });
        transacao.update(contratoRef, { ...atualizacao, atualizado_em: agora });

        return { contratoAntes: contrato, atualizacaoContrato: atualizacao };
      });

      await registrarAuditoria('aditivos', aditivoRef.id, 'CREATE', dados);
      await registrarAuditoria('contratos', dados.contratoId, 'UPDATE', atualizacaoContrato, contratoAntes);
    },
    [usuarioAtual, registrarAuditoria],
  );

  const addProcedimento = useCallback(
    async (dados: Omit<ProcedimentoLicitatorio, 'id'>) => {
      await criarEm('procedimentos', dados);
    },
    [criarEm],
  );
  const updateProcedimento = useCallback(
    (id: string, dados: Partial<ProcedimentoLicitatorio>) =>
      atualizarEm('procedimentos', id, dados),
    [atualizarEm],
  );

  const addSancionatorio = useCallback(
    async (dados: Omit<ProcessoSancionatorio, 'id'>) => {
      await criarEm('sancionatorios', dados);
    },
    [criarEm],
  );
  const updateSancionatorio = useCallback(
    (id: string, dados: Partial<ProcessoSancionatorio>) =>
      atualizarEm('sancionatorios', id, dados),
    [atualizarEm],
  );

  const addPortaria = useCallback(
    async (dados: Omit<PortariaFiscal, 'id'>) => {
      await criarEm('portarias', dados);
    },
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
      estadasProcesso,
      alertas,
      pareceres,
      contratos,
      execucoes,
      ocorrencias,
      aditivos,
      procedimentos,
      sancionatorios,
      portarias,
      logsAcesso,
      logsAuditoria,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      firebaseConfigurado: isFirebaseConfigured,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      addProcesso,
      deleteProcesso,
      updateProcessoStatus,
      updateProcesso,
      addMovimentacao,
      syncPcasFromPublicUrl,
      syncProcessosDaPlanilha,
      syncContratosDaPlanilha,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addContrato,
      updateContrato,
      deleteContrato,
      addExecucao,
      deleteExecucao,
      addOcorrencia,
      addAditivo,
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
      estadasProcesso,
      alertas,
      pareceres,
      contratos,
      execucoes,
      ocorrencias,
      aditivos,
      procedimentos,
      sancionatorios,
      portarias,
      logsAcesso,
      logsAuditoria,
      usuarioAtual,
      isAuthenticated,
      carregandoAuth,
      login,
      logout,
      solicitarAcesso,
      enviarResetSenha,
      addProcesso,
      deleteProcesso,
      updateProcessoStatus,
      updateProcesso,
      addMovimentacao,
      syncPcasFromPublicUrl,
      syncProcessosDaPlanilha,
      syncContratosDaPlanilha,
      updateUsuario,
      addUsuario,
      deleteUsuario,
      addContrato,
      updateContrato,
      deleteContrato,
      addExecucao,
      deleteExecucao,
      addOcorrencia,
      addAditivo,
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
