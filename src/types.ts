export type Perfil = 'master' | 'contratos' | 'apoio' | 'gestao' | 'fiscal';

export const PERFIL_LABELS: Record<Perfil, string> = {
  master: 'Master',
  contratos: "Contratos e ARP's (Gestor e Auxiliares)",
  apoio: 'Apoio e Suprimento',
  gestao: 'Gestão de Contratos (Gestor e Auxiliares)',
  fiscal: 'Fiscal do Contrato',
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  setor_id: string;
  perfil: Perfil;
  ativo: boolean;
  cargo?: string;
}

export interface Setor {
  id: string;
  nome: string;
  sigla: string;
  ordem_fluxo: number;
}

export type StatusProcesso = 'em_andamento' | 'aprovado' | 'pendente' | 'concluido' | 'arquivado';

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
  rito_processual?: string;
  checklist_rito?: string[];
  fase_processo?: string;
  subfase_processo?: string;
  andamento?: string;
  data_entrada?: string;
  ultima_tramitacao?: string;
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
  inicioVigencia: string;
  fimVigencia: string;
  fiscalTitular?: string;
  fiscalEmail?: string;
  fiscalTitularContato?: string;
  fiscalSuplente?: string;
  fiscalSuplenteEmail?: string;
  fiscalSuplenteContato?: string;
  portaria?: string;
  fonteRecurso?: string;
  prd?: string;
  empenho?: string;
  dotacao?: string;
  linkContrato?: string | null;
  criado_em?: string;
  atualizado_em?: string;
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
