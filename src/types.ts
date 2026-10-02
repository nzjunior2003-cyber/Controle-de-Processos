export type Perfil =
  | 'master'
  | 'contratos'
  | 'apoio'
  | 'gestao'
  | 'fiscal'
  | 'bm4'
  | 'financeiro'
  | 'dga'
  | 'dal'
  | 'df'
  | 'dca'
  | 'demandante';

export const PERFIL_LABELS: Record<Perfil, string> = {
  master: 'Master',
  contratos: "Contratos e ARP's (Gestor e Auxiliares)",
  apoio: 'Apoio e Suprimento',
  gestao: 'Gestão de Contratos (Gestor e Auxiliares)',
  fiscal: 'Fiscal do Contrato',
  bm4: 'Planejamento (4ª Seção do EMG)',
  financeiro: 'Financeiro (Diretoria de Finanças)',
  dga: 'DGA (Departamento Geral de Administração)',
  dal: 'DAL (Diretoria)',
  df: 'DF (Diretoria)',
  dca: 'DCA (Diretoria)',
  demandante: 'Demandante (Setor Requisitante)',
};

/**
 * Perfis de Diretoria (Chefe de Departamento e Diretores): enxergam todos os
 * módulos, menos Usuários e Auditoria, mas não editam nada — a única
 * exceção é o BM4, que continua cadastrando IRPs e editando o PCA
 * (Planejamento). Não confundir com os perfis "donos" de módulo
 * (apoio, contratos, gestao, fiscal, financeiro), que editam o próprio módulo.
 */
export const PERFIS_DIRETORIA: Perfil[] = ['dga', 'dal', 'df', 'dca', 'bm4'];

export const ehPerfilDiretoria = (perfil?: Perfil): boolean =>
  !!perfil && PERFIS_DIRETORIA.includes(perfil);

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  setor_id: string;
  perfil: Perfil;
  ativo: boolean;
  cargo?: string;
  /**
   * MF (matrícula funcional) informada no primeiro acesso — usada pra
   * reconhecer automaticamente, sem precisar bater e-mail/nome, quais
   * contratos já cadastrados por um Gestor têm esse militar como Fiscal
   * Titular/Suplente (ver `filtrarContratosDoFiscal`). Única e imutável,
   * diferente de e-mail/nome.
   */
  mf?: string;
  /** Nome de guerra (como a pessoa é chamada no dia a dia) — distinto do nome completo. */
  nomeGuerra?: string;
  /** UBM (Unidade Bombeiro Militar) informada no primeiro acesso — texto livre por enquanto. */
  ubm?: string;
  /**
   * Unidade demandante (mesma lista de `OPCOES_UNIDADE_DEMANDANTE`,
   * `src/lib/planilhaProcessos.ts`) vinculada a usuários do perfil
   * `demandante` — NÃO é o mesmo conceito de `setor_id`/`Setor` acima, que
   * é a etapa interna de tramitação do fluxo antigo, não o departamento
   * requisitante da contratação.
   */
  unidadeDemandante?: string;
}

export interface Setor {
  id: string;
  nome: string;
  sigla: string;
  ordem_fluxo: number;
}

export type StatusProcesso =
  | 'em_andamento'
  | 'aprovado'
  | 'pendente'
  | 'contratado_aditivado'
  | 'concluido'
  | 'arquivado';

/** Rótulos de exibição de StatusProcesso — usado tanto na lista (Aquisicoes) quanto no detalhe do processo. */
export const STATUS_PROCESSO_LABELS: Record<StatusProcesso, string> = {
  em_andamento: 'Em Andamento',
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  contratado_aditivado: 'Contratado/Aditivado',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

/** Cores do badge de status (fundo/texto claros, pra usar com outline ou fundo sólido conforme a tela). */
export const STATUS_PROCESSO_CORES: Record<StatusProcesso, string> = {
  em_andamento: 'bg-blue-50 text-blue-700 outline-blue-200',
  aprovado: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  pendente: 'bg-amber-50 text-amber-700 outline-amber-200',
  contratado_aditivado: 'bg-purple-50 text-purple-700 outline-purple-200',
  concluido: 'bg-green-50 text-green-700 outline-green-200',
  arquivado: 'bg-gray-100 text-gray-600 outline-gray-300',
};

export const CHECKLISTS_RITOS: Record<string, string[]> = {
  'Pregão Eletrônico': [
    'Documento de Formalização de Demanda',
    'Estudo Técnico Preliminar',
    'Análise de Risco',
    'Termo de Referência',
    'Pesquisa e Codificação no SIMAS',
    'Orçamento Estimado/Pesquisa de preços',
    'Dotação Orçamentária',
    'Autorização do ordenador de despesas',
    'Autorização da SEPLAD (quando cabível)',
    'Minuta de Contrato e Minuta de Edital',
    'Parecer Jurídico',
    'Autorização do GTAF (quando cabível)',
    'Edital do Pregão Eletrônico'
  ],
  'Pregão Eletrônico (SRP)': [
    'Documento de Oficialização da Demanda (DOD)',
    'Estudo Técnico Preliminar (ETP)',
    'Termo de Referência (TR)',
    'Pesquisa de Preços',
    'Intenção de Registro de Preços (IRP)',
    'Aprovação da Autoridade Competente',
    'Parecer Jurídico',
    'Publicação do Edital',
    'Realização do Pregão',
    'Homologação / Adjudicação',
    'Assinatura da Ata de Registro de Preços'
  ],
  'Gerenciador da ARP': [
    'Documento de Oficialização da Demanda (DOD)',
    'Estudo Técnico Preliminar (ETP)',
    'Termo de Referência (TR)',
    'Pesquisa de Preços',
    'Aprovação da Autoridade Competente',
    'Parecer Jurídico',
    'Publicação do Edital',
    'Homologação / Adjudicação',
    'Assinatura da ARP'
  ],
  'Partícipe de ARP': [
    'Documento de Oficialização da Demanda (DOD)',
    'Manifestação de Interesse',
    'Estimativa de Quantitativos',
    'Aprovação da Autoridade Competente',
    'Envio ao Órgão Gerenciador'
  ],
  'Adesão ARP': [
    'Documento de Oficialização da Demanda (DOD)',
    'Estudo Técnico Preliminar (ETP)',
    'Justificativa da Vantajosidade',
    'Aceite do Órgão Gerenciador',
    'Aceite do Fornecedor',
    'Aprovação da Autoridade Competente',
    'Parecer Jurídico',
    'Assinatura do Contrato'
  ],
  'Inexigibilidade (com as suas variantes)': [
    'Documento de Oficialização da Demanda (DOD)',
    'Termo de Referência (TR)',
    'Justificativa de Inexigibilidade',
    'Comprovação de Exclusividade (se aplicável)',
    'Justificativa de Preço',
    'Aprovação da Autoridade Competente',
    'Parecer Jurídico',
    'Publicação da Inexigibilidade',
    'Assinatura do Contrato'
  ],
  'Dispensa de Licitação (com suas variantes)': [
    'Documento de Oficialização da Demanda (DOD)',
    'Termo de Referência (TR)',
    'Justificativa da Dispensa',
    'Pesquisa de Preços',
    'Aprovação da Autoridade Competente',
    'Parecer Jurídico',
    'Publicação da Dispensa',
    'Assinatura do Contrato / Empenho'
  ],
  'Aditivo Contratual (Tempo, Valor ou tempo e valor)': [
    'Relatório Técnico / Justificativa',
    'Cronograma Físico-Financeiro (se aplicável)',
    'Manifestação da Contratada',
    'Pesquisa de Mercado (para aditivo de valor)',
    'Adequação Orçamentária',
    'Parecer Jurídico',
    'Assinatura do Termo Aditivo',
    'Publicação do Extrato'
  ],
  'Outro': [
    'Abertura do Processo',
    'Instrução',
    'Decisão',
    'Publicação'
  ]
};

export interface Processo {
  id: string;
  numero_processo: string;
  objeto: string;
  descricao?: string;
  demandante_id: string;
  unidade_demandante: string;
  status: StatusProcesso;
  fase_atual_id: string;
  pca_id?: string;
  possui_alerta: boolean;
  data_abertura: string;
  data_conclusao?: string;
  fonte?: string;
  natureza_despesa?: string;
  valor_estimado?: number;
  rito_processual?: string;
  checklist_rito?: string[];
  /** Só usados quando o rito é a Adesão à ata de registro de preços (RITO_ADESAO_ARP). */
  orgaoGerenciadorArp?: string;
  fornecedorArp?: string;
  fase_processo?: string;
  subfase_processo?: string;
  /**
   * Localização/unidade atual do processo, em texto livre (ex.: "CBM >
   * CSMV/SUBCHEFIA > Complexo do Entroncamento"), vinda da planilha de
   * controle já usada pela equipe — não corresponde ao fluxo interno fixo
   * de `fase_atual_id`, é só para exibição.
   */
  localizacao_atual?: string;
  andamento?: string;
  data_entrada?: string;
  ultima_tramitacao?: string;
  /** Linha (1-based) desse processo na planilha de controle, para atualizações futuras acharem a linha certa sem precisar buscar de novo. */
  planilha_linha?: number;
  /**
   * Snapshot de status/fase/subfase tirado no instante em que o processo é
   * marcado como "Contratado/Aditivado" — permite desmarcar restaurando
   * exatamente o estado anterior, em vez de reconfigurar tudo manualmente.
   * Limpo ao desmarcar.
   */
  statusAnterior?: StatusProcesso;
  faseAnterior?: string;
  subfaseAnterior?: string;
  criado_em: string;
  atualizado_em: string;
}

export type StatusMovimentacao = 'pendente' | 'aprovado' | 'devolvido' | 'concluido';

export interface MovimentacaoProcesso {
  id: string;
  processo_id: string;
  setor_id: string;
  usuario_id: string;
  observacao?: string;
  status_movimentacao: StatusMovimentacao;
  data_movimentacao: string;
}

export interface Parecer {
  id: string;
  processo_id: string;
  setor_id: string;
  descricao: string;
  arquivo_url?: string;
  criado_por: string;
  criado_em: string;
}

export interface PCA {
  id: string;
  codigo_pca: string; // Will map to "Ordem"
  objeto_pca: string; // Will map to "Descrição"
  exercicio: number;
  unidade_responsavel: string; // Will map to "Demandante"
  valor_previsto: number; // Will map to "Valor do Recurso"
  item_pca: string; // Will map to "Item"
  grupo_pca: string; // Will map to "Grupo"
  fonte_recurso: string; // Will map to "Fonte de Recurso"
  origem?: string; // "Origem" — setor que originou o pedido
  subitem?: string; // "Subitem"
  quantidade?: string; // "Quantidade" — texto (nem sempre é um número)
  valor_unitario_estimado?: number; // "Valor Unitário Estimado"
  prioridade?: string; // "Prioridade" — ALTA/MÉDIA/BAIXA
  data_desejada?: string; // "Data Desejada" — texto livre (ex.: "1º QDQQ")
  contrato_novo?: boolean; // "Contrato Novo" — SIM/NÃO
  modalidade_licitacao?: string; // "*Provável Modalidade de Licitação ou de Rito Processual"
  numero_pae?: string; // "Nº do PAE"
  qdqq?: { q1: boolean; q2: boolean; q3: boolean; q4: boolean }; // Quadrimestre(s) previsto(s) para efetivação/entrega
  criado_em?: string;
  atualizado_em?: string;
}

export type TipoAlerta = 'prazo' | 'pendencia' | 'gargalo';

export interface Alerta {
  id: string;
  processo_id: string;
  tipo_alerta: TipoAlerta;
  descricao: string;
  resolvido: boolean;
  criado_em: string;
}

/* ------------------------------------------------------------------ *
 * Contratos e instrumentos derivados
 *
 * `Contrato` é a entidade única compartilhada pelas páginas
 * ContratosArps, GestaoContratos e FiscalContrato (antes cada uma
 * mantinha o seu próprio array mock local e não compartilhado).
 * ------------------------------------------------------------------ */

export interface Contrato {
  id: string;
  /** Nº do processo administrativo eletrônico de origem */
  pae: string;
  /** Nº do contrato / ARP no formato nnnn/aaaa */
  numero: string;
  objeto: string;
  /** Razão social da empresa contratada */
  empresa: string;
  cnpj?: string;
  contatosFornecedor?: string;
  contatoEmail?: string;
  contatoTelefone?: string;
  valorGlobal: number;
  /** Saldo financeiro de referência no cadastro (preenchido pelo Gestor). */
  saldoInicialFinanceiro: number;
  /** Saldo financeiro corrente, decrementado quando o Financeiro registra o pagamento da fatura/NF (contratos antigos: a cada NF lançada). */
  saldoAtualFinanceiro: number;
  /** Saldo em quantidade de referência, para contratos com controle por quantitativo. */
  saldoInicialQuantitativo?: number;
  /** Saldo em quantidade corrente, decrementado a cada execução lançada. */
  saldoAtualQuantitativo?: number;
  inicioVigencia: string;
  fimVigencia: string;
  fiscalTitular?: string;
  fiscalEmail?: string;
  fiscalTitularContato?: string;
  /** Cargo/posto do Fiscal Titular (ex.: "1º TEN QOABM") — preenchido junto com o nome ao selecionar no buscador de militares, mas editável direto. */
  fiscalTitularCargo?: string;
  /** MF (matrícula funcional) do Fiscal Titular. */
  fiscalTitularMf?: string;
  /** UBM (unidade) do Fiscal Titular — inserida direto no sistema, não vem do buscador de militares. */
  fiscalTitularUbm?: string;
  fiscalSuplente?: string;
  fiscalSuplenteEmail?: string;
  fiscalSuplenteContato?: string;
  /** Cargo/posto do Fiscal Suplente. */
  fiscalSuplenteCargo?: string;
  /** MF (matrícula funcional) do Fiscal Suplente. */
  fiscalSuplenteMf?: string;
  /** UBM (unidade) do Fiscal Suplente. */
  fiscalSuplenteUbm?: string;
  /**
   * Períodos anteriores de Fiscal Titular/Suplente deste contrato,
   * fechados automaticamente toda vez que esses campos são alterados na
   * edição — o fiscal ATUAL é sempre `fiscalTitular`/`fiscalSuplente`
   * acima, nunca o último item daqui.
   */
  historicoFiscal?: HistoricoFiscalContrato[];
  portaria?: string;
  fonteRecurso?: string;
  /** Natureza de despesa do contrato (Consumo, Permanente ou Serviço). */
  naturezaDespesa?: string;
  /** Marcado manualmente pelo Gestor quando o contrato foi encerrado/totalmente executado antes do fim da vigência (ou mesmo depois, como registro). */
  concluido?: boolean;
  prd?: string;
  /** Valor do PRD (Pedido de Reconhecimento de Despesa), distinto do valor global do contrato. */
  valorPRD?: number;
  empenho?: string;
  dotacao?: string;
  /** Nº do Diário Oficial (DOE) em que o contrato foi publicado. */
  doe?: string;
  linkContrato?: string | null;
  /** Unidade demandante do contrato (só vem da sincronização com a planilha — sem campo próprio no cadastro ainda). */
  unidadeDemandante?: string;
  /** Código do PCA vinculado, como texto livre (só vem da sincronização com a planilha). */
  pcaCodigo?: string;
  /** Linha (1-based) da planilha "Gestão de Contratos" onde este contrato está sincronizado. */
  planilha_linha?: number;
  /**
   * Itens do contrato (bens de Consumo/Permanente), cada um com seu
   * próprio saldo de quantidade — abatido a cada execução (NF) que
   * informar consumo desse item. Independente do saldo financeiro e do
   * saldo quantitativo agregado (`saldoAtual/InicialQuantitativo`).
   */
  itens?: ItemContrato[];
  /**
   * Link do PDF do contrato anexado (Google Drive), pra abrir direto
   * pelo app — distinto de `linkContrato` (campo de texto livre, usado
   * pra links externos como SEI/PAE).
   */
  contratoPdfLink?: string | null;
  /** Link do PDF da Nota de Empenho anexado (Google Drive, mesma pasta do contrato). */
  empenhoPdfLink?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ItemContrato {
  id: string;
  descricao: string;
  unidade?: string;
  quantidadeInicial: number;
  quantidadeAtual: number;
  /** Valor unitário do item — usado pra calcular o valor total do item e, na execução (NF), o valor abatido a partir da quantidade usada. */
  valorUnitario: number;
}

/** Um período fechado (`desde` até `ate`) em que alguém foi Fiscal Titular/Suplente de um contrato, antes de ser substituído. */
export interface HistoricoFiscalContrato {
  id: string;
  fiscalTitular?: string;
  fiscalEmail?: string;
  fiscalTitularContato?: string;
  fiscalSuplente?: string;
  fiscalSuplenteEmail?: string;
  fiscalSuplenteContato?: string;
  desde: string;
  ate: string;
}

export interface ItemProcedimento {
  descricao: string;
  quantidade: string;
  valorHomologado: string;
}

export interface FornecedorHomologado {
  id: string;
  cnpj: string;
  valor: string;
}

export interface InstrumentoDerivado {
  id: string;
  tipo: 'ARP' | 'CONTRATO';
  numero: string;
  origem?: string;
  doe?: string;
  bg?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  link?: string;
  fornecedorIdx?: string;
  valor?: string;
  prd?: string;
  empenho?: string;
  fiscalTitular?: string;
  fiscalSuplente?: string;
}

/** Pregões, inexigibilidades, dispensas, adesões e partícipes de ARP. */
export interface ProcedimentoLicitatorio {
  id: string;
  pae: string;
  numero: string;
  modalidade: string;
  objeto: string;
  fase: string;
  dataPublicacao: string;
  previsaoAbertura: string;
  registroPrecos?: boolean;
  documento_referencia?: string;
  orgaoGerenciador?: string;
  vigenciaArp?: string;
  doe?: string;
  linkPncp?: string;
  linkComprasGov?: string;
  fornecedor?: string;
  valorHomologado?: string;
  numeroContrato?: string;
  doeContrato?: string;
  bgContrato?: string;
  prd?: string;
  empenho?: string;
  inicioVigencia?: string;
  fimVigencia?: string;
  linkContrato?: string;
  fiscal?: string;
  suplente?: string;
  itens?: ItemProcedimento[];
  fornecedoresHomologados?: FornecedorHomologado[];
  instrumentosDerivados?: InstrumentoDerivado[];
  /** true quando o registro é derivado automaticamente de um Processo. */
  isAuto?: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ProcessoSancionatorio {
  id: string;
  processo: string;
  empresa: string;
  motivo: string;
  fase: string;
  dataAbertura: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface SubstituicaoFiscal {
  data: string;
  tipoAfastamento: string;
  fiscalSubstituto: string;
  cargoSubstituto?: string;
  contatoSubstituto?: string;
  emailSubstituto?: string;
  ubmSubstituto?: string;
  doe?: string;
  bg?: string;
}

export interface PortariaFiscal {
  id: string;
  portaria: string;
  contrato: string;
  empresa: string;
  dataPublicacao: string;
  doe?: string;
  bg?: string;
  fiscalTitular: string;
  fiscalTitularNome?: string;
  fiscalTitularCargo?: string;
  fiscalTitularContato?: string;
  fiscalEmail?: string;
  fiscalTitularUbm?: string;
  fiscalSuplente?: string;
  fiscalSuplenteNome?: string;
  fiscalSuplenteCargo?: string;
  fiscalSuplenteContato?: string;
  fiscalSuplenteEmail?: string;
  fiscalSuplenteUbm?: string;
  substituicoes?: SubstituicaoFiscal[];
  criado_em?: string;
  atualizado_em?: string;
}

/* ------------------------------------------------------------------ *
 * Planejamento (IRP) — módulo restrito à 4ª Seção do Estado-Maior
 * Geral (perfil `bm4`): Intenções de Registro de Preços publicadas por
 * outros órgãos, que o CBMPA pode manifestar interesse em aderir.
 * ------------------------------------------------------------------ */

export type EsferaOrgaoIrp = 'Federal' | 'Distrital' | 'Estadual';

export type StatusIrp =
  | 'aberta'
  | 'em_analise'
  | 'manifestado_interesse'
  | 'sem_interesse'
  | 'prazo_expirado'
  | 'aderida';

export const STATUS_IRP_LABELS: Record<StatusIrp, string> = {
  aberta: 'Aberta',
  em_analise: 'Em análise pelo setor',
  manifestado_interesse: 'Manifestado interesse',
  sem_interesse: 'Não há interesse',
  prazo_expirado: 'Prazo expirado',
  aderida: 'Aderida',
};

export const STATUS_IRP_CORES: Record<StatusIrp, string> = {
  aberta: 'bg-blue-50 text-blue-700 outline-blue-200',
  em_analise: 'bg-amber-50 text-amber-700 outline-amber-200',
  manifestado_interesse: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  sem_interesse: 'bg-gray-100 text-gray-600 outline-gray-300',
  prazo_expirado: 'bg-red-50 text-red-700 outline-red-200',
  aderida: 'bg-purple-50 text-purple-700 outline-purple-200',
};

export interface IRP {
  id: string;
  esferaOrgao: EsferaOrgaoIrp;
  orgaoGerenciador: string;
  numeroIrp: string;
  processoOrigem?: string;
  objeto: string;
  dataPublicacao: string;
  prazoManifestacao: string;
  /** Unidades demandantes vinculadas ao tipo de objeto (uma IRP pode interessar a mais de um setor). */
  setoresDemandantes: string[];
  status: StatusIrp;
  linkEdital?: string;
  observacaoResposta?: string;
  responsavelCadastroId: string;
  responsavelCadastroNome: string;
  /** Contato do setor demandante que deve se manifestar sobre o interesse — usado no alerta de prazo. */
  responsavelRespostaNome?: string;
  responsavelRespostaEmail?: string;
  /** Id do ProcedimentoLicitatorio criado automaticamente quando o status vira 'aderida' (ver AppContext.tsx `updateIrp`). */
  procedimentoVinculadoId?: string;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Registro de dotação orçamentária (módulo Financeiro) — o saldo
 * disponível é sempre calculado (nunca persistido) somando os
 * `PagamentoContrato` que apontam pra ela (ver `saldoDaDotacao`,
 * src/lib/financeiro.ts), no mesmo espírito de `calcularEconomicidade`.
 */
export interface DotacaoOrcamentaria {
  id: string;
  exercicio: number;
  /** Código do elemento de despesa/programa orçamentário. */
  codigo: string;
  descricao: string;
  fonteRecurso: string;
  valorDotado: number;
  /** Funcional programática (ex.: 06.122.1297-8338) — cabeçalho da ficha de controle da Diretoria de Finanças. */
  funcionalProgramatica?: string;
  /** Projeto-Atividade ou Operações Especiais (ex.: Operacionalização das Ações Administrativas). */
  projetoAtividade?: string;
  /** Natureza da despesa (ex.: 339033). */
  naturezaDespesa?: string;
  /** Código da fonte (ex.: 01500.000001), distinto do nome em `fonteRecurso` (TESOURO, FEBOM...). */
  fonteCodigo?: string;
  detalhamento?: string;
  planoInterno?: string;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Nota de Empenho (NE) de um contrato num exercício. Contratos com despesa
 * estimativa têm uma NE de **origem** (valor simbólico, em geral R$ 1,00) e,
 * a cada fatura, uma NE de **reforço** que cobre o valor antes do
 * pagamento. O saldo é sempre calculado (ver `saldoDoExercicio`,
 * src/lib/financeiro.ts), nunca persistido.
 */
export type TipoEmpenho = 'origem' | 'reforco';

export interface Empenho {
  id: string;
  contratoId: string;
  exercicio: number;
  tipo: TipoEmpenho;
  /** Número da NE. */
  numero: string;
  /** Só no reforço: a NE de origem que ele reforça. */
  neOrigemId?: string;
  valor: number;
  dotacaoId?: string;
  /** Só na origem: despesa estimativa (valor mensal não fixo, sujeita a reforço). */
  estimativo?: boolean;
  /** Só na origem: PRD do exercício (ex.: "10/2026"), validade e valor total reservado. */
  prd?: string;
  prdValidade?: string;
  prdValor?: number;
  /** Só na origem: PAE (protocolo) do PRD/empenho. */
  paeOrigem?: string;
  data?: string;
  observacao?: string;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Pagamento efetuado a um fornecedor por um contrato (módulo Financeiro,
 * alimentado pela Diretoria de Finanças) — complementa `ExecucaoContrato`
 * (que já registra a NF/Fatura em si) com os dados de liquidação
 * financeira: empenho, ordem de pagamento e dotação orçamentária.
 */
export type StatusPagamento = 'em_tramitacao' | 'pago' | 'arquivado';

export const STATUS_PAGAMENTO_LABELS: Record<StatusPagamento, string> = {
  em_tramitacao: 'Em tramitação',
  pago: 'Pago',
  arquivado: 'Arquivado',
};

/** Documento de cobrança de um pagamento (uma NF, fatura ou recibo). */
export interface DocumentoPagamento {
  tipo: 'NF' | 'Fatura' | 'Recibo' | 'Outro';
  numero: string;
  /** Pode faltar: algumas faturas só têm o valor em bloco, não por NF. */
  valor?: number;
  /** Execução (NF) já lançada pelo fiscal/gestão à qual este documento corresponde. */
  execucaoId?: string;
}

/** Ordem Bancária (OB) de um pagamento — pode haver mais de uma (ex.: pagamento + retenção). */
export interface OrdemBancaria {
  numero: string;
  /** Nº do documento (NF) a que esta OB se refere — na planilha cada NF tem a sua OB. Vazio = vale pra fatura toda. */
  documento?: string;
  valor?: number;
  data?: string;
}

/** Cada passagem do pagamento por um setor/etapa (histórico do "status do processo"). */
export interface AndamentoPagamento {
  setor: string;
  etapa: string;
  data: string;
  porNome: string;
}

/**
 * Processo de pagamento de uma fatura (controle da Diretoria de Finanças):
 * cada fatura vem num PAE novo (`paeFatura`), pode reunir várias NFs, é
 * coberta por uma ou mais NEs (origem/reforço) e termina em uma ou mais
 * OBs. Os campos `numeroEmpenho`, `numeroOrdemPagamento`, `valorPago` e
 * `dataPagamento` são do modelo anterior e continuam lidos como legado.
 */
export interface PagamentoContrato {
  id: string;
  contratoId: string;
  paeFatura?: string;
  documentos?: DocumentoPagamento[];
  /** Valor da fatura inteira (soma das NFs). */
  valorTotal?: number;
  empenhoIds?: string[];
  ordensBancarias?: OrdemBancaria[];
  dotacaoId?: string;
  fonteRecurso: string;
  /** Mês de competência, 'AAAA-MM' (a coluna MÊS da planilha de controle). */
  competencia?: string;
  setorAtual?: string;
  etapa?: string;
  /** Ausente nos registros do modelo anterior (lidos como 'pago'). */
  status?: StatusPagamento;
  autenticado?: boolean;
  autenticadoPor?: string;
  historico?: AndamentoPagamento[];
  observacao?: string;
  anexoLink?: string;
  /**
   * Quanto este pagamento já abateu do saldo financeiro do contrato — o saldo
   * só cai quando o Financeiro marca a fatura como paga. Guardado pra poder
   * reverter/ajustar sem recalcular tudo.
   */
  valorAbatidoSaldo?: number;
  /** Legado (modelo anterior). */
  execucaoId?: string;
  numeroEmpenho?: string;
  numeroOrdemPagamento?: string;
  valorPago?: number;
  dataPagamento?: string;
  criado_em: string;
  atualizado_em: string;
}

/** Eventos de um processo que disparam notificação (push + central interna). */
export type TipoEventoNotificacao = 'mudanca_setor' | 'mudanca_fase' | 'conclusao';

/**
 * Notificação dirigida a um único usuário (destinatarioId), gravada pelo
 * cliente que executou a ação que a originou (não há Cloud Functions nesse
 * projeto — ver `dispararNotificacoesProcesso`, AppContext.tsx). Alimenta a
 * central de notificações (sino) e, quando há inscrição de push, também o
 * `/api/send-push`.
 */
export interface Notificacao {
  id: string;
  destinatarioId: string;
  tipo: TipoEventoNotificacao;
  titulo: string;
  corpo: string;
  /** Link pra abrir ao clicar na notificação (ex.: /sistema/processos/:id). */
  url?: string;
  lida: boolean;
  criado_em: string;
}

/** Inscrição de push (Web Push/VAPID) de um usuário num navegador/dispositivo. */
export interface PushSubscriptionRegistro {
  id: string;
  usuarioId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  criado_em: string;
}
