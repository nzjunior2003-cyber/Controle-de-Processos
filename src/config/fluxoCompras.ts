/**
 * FLUXO OFICIAL DE COMPRAS DA DAL/CBMPA — arquivo único de configuração.
 *
 * Para mudar o fluxo (etapas, setores, perguntas, desvios, checklist da E07
 * por rito) edite SÓ este arquivo; as telas e o motor (src/lib/fluxoCompras.ts)
 * leem tudo daqui. Os testes (src/lib/fluxoCompras.test.ts) avisam se alguma
 * transição apontar para uma etapa que não existe.
 *
 * PADRÕES ADOTADOS onde o pedido deixava margem (todos ajustáveis aqui):
 *  1. Os nomes antigos de rito (planilha/código) são traduzidos para os 8
 *     ritos do fluxo em MAPA_RITO_ANTIGO. As 4 dispensas viram
 *     `dispensa_eletronica`. "Concorrência" não existe na lista antiga: só
 *     entra pelo campo novo `ritoProcessual`.
 *  2. Prorrogação, Acréscimo, Reequilíbrio, Cotação Deserta e Outro NÃO são
 *     compras: ficam em RITOS_FORA_DO_FLUXO e o motor diz "fora do fluxo".
 *  3. Depois da E16 (ajustes), o padrão é seguir para a E17. Para voltar ao
 *     CONJUR (E14), troque APOS_AJUSTES_E16 para 'E14'.
 *  4. E17 é uma etapa de decisão: sem a resposta "haverá fase externa?" o
 *     motor pergunta em vez de escolher.
 *  5. E31 e E34 ("caso necessário") ficam na sequência, marcadas `opcional`.
 *  6. Rito definido = E06 concluída; o processo parte, no mínimo, da E07.
 *  7. PRD preenchido ⇒ E20 concluída; status "arquivado"/"concluido" ⇒ E35;
 *     "contratado_aditivado" ⇒ E19 concluída. São PISTAS: o usuário confirma.
 *  8. Itens da E07 que a planilha talvez não tenha (ex.: "Mapa de Demanda")
 *     aparecem como "faltando"; o master os inclui em "ajustar etapas do rito".
 *  9. Setor só informa quem age agora; não restringe acesso a ninguém.
 */

export type RitoCompras =
  | 'pregao_srp'
  | 'pregao'
  | 'concorrencia'
  | 'dispensa_eletronica'
  | 'inexigibilidade'
  | 'gerenciador_ata'
  | 'participe_ata'
  | 'adesao_ata';

/** Campos de decisão (sim/não) guardados no processo. */
export type CampoDecisao =
  | 'dispensaAteMetadeLimite'
  | 'necessitaDotacao'
  | 'cbmGerenciadorOuParticipeArp'
  | 'parecerJuridicoAprovadoSemRecomendacoes'
  | 'haveraFaseExterna';

export interface EtapaFluxo {
  id: string;
  nome: string;
  grupo: string;
  /** Quem age nesta etapa (informativo). */
  setor: string;
  /** "Caso necessário": o usuário pode pular. */
  opcional?: boolean;
}

export const ETAPAS: EtapaFluxo[] = [
  { id: 'E01', nome: 'Enviar o DFD', grupo: 'Demanda', setor: 'Demandante' },
  { id: 'E02', nome: 'Recepcionar a demanda', grupo: 'Demanda', setor: 'DGA' },
  { id: 'E03', nome: 'Despachar demanda', grupo: 'Demanda', setor: 'DAL' },
  { id: 'E04', nome: 'Inserir na plataforma de controle de andamento', grupo: 'Demanda', setor: 'DAL-SAS' },
  { id: 'E05', nome: 'Solicitar confecção de artefatos', grupo: 'Artefatos', setor: 'DAL-SAS' },
  { id: 'E06', nome: 'Definir o rito processual', grupo: 'Artefatos', setor: 'DAL-SIPC' },
  { id: 'E07', nome: 'Confeccionar artefatos', grupo: 'Artefatos', setor: 'DAL-SIPC' },
  { id: 'E08', nome: 'Analisar artefatos', grupo: 'Artefatos', setor: 'DAL-SAS' },
  { id: 'E09', nome: 'Solicitar dotação orçamentária', grupo: 'Dotação', setor: 'DAL-SAS' },
  { id: 'E10', nome: 'Informar a dotação orçamentária', grupo: 'Dotação', setor: 'DF/BM6/CEDEC' },
  { id: 'E11', nome: 'Elaborar minutas (contrato, ata, aditivo, dispensa, inexigibilidade, conforme o caso)', grupo: 'Autorização', setor: 'DCA' },
  { id: 'E12', nome: 'Solicitar autorização do Ordenador de Despesas', grupo: 'Autorização', setor: 'DCA' },
  { id: 'E13', nome: 'Autorizar a despesa', grupo: 'Autorização', setor: 'Ord. Despesas' },
  { id: 'E14', nome: 'Emitir parecer jurídico', grupo: 'Jurídico', setor: 'CONJUR' },
  { id: 'E15', nome: 'Submeter à aprovação do Cmte Geral', grupo: 'Jurídico', setor: 'CONJUR' },
  { id: 'E16', nome: 'Ajustar artefatos ou minutas (DAL solicita autorização à SEPLAD/GTAF, conforme o caso)', grupo: 'Jurídico', setor: 'DCA' },
  { id: 'E17', nome: 'Realizar licitação ou contratação', grupo: 'Contratação', setor: 'DCA' },
  { id: 'E18', nome: 'Realizar licitação/dispensa eletrônica (fase externa)', grupo: 'Contratação', setor: 'DCA' },
  { id: 'E19', nome: 'Realizar contratação', grupo: 'Contratação', setor: 'DCA' },
  { id: 'E20', nome: 'Fazer PRD (Pedido de Realização de Despesa)', grupo: 'Empenho', setor: 'DAL-SIPC' },
  { id: 'E21', nome: 'Emitir Nota de Empenho (sempre emitida na DF)', grupo: 'Empenho', setor: 'DF/BM6/CEDEC' },
  { id: 'E22', nome: 'Assinar Nota de Empenho', grupo: 'Empenho', setor: 'Ord. Despesas' },
  { id: 'E23', nome: 'Enviar Nota de Empenho ao Gestor de Contratos', grupo: 'Execução', setor: 'DAL' },
  { id: 'E24', nome: 'Gerenciar o contrato', grupo: 'Execução', setor: 'Gestor de Contratos' },
  { id: 'E25', nome: 'Receber NE e contrato', grupo: 'Execução', setor: 'Fiscal' },
  { id: 'E26', nome: 'Enviar empenho à contratada', grupo: 'Execução', setor: 'Fiscal' },
  { id: 'E27', nome: 'Conferir o bem/serviço', grupo: 'Execução', setor: 'Fiscal' },
  { id: 'E28', nome: 'Atestar Nota Fiscal', grupo: 'Execução', setor: 'Fiscal' },
  { id: 'E29', nome: 'Apensar as certidões de regularidade fiscal', grupo: 'Execução', setor: 'Fiscal' },
  { id: 'E30', nome: 'Receber Nota Fiscal no SIMAS', grupo: 'Pagamento', setor: 'Cent. Patr.' },
  { id: 'E31', nome: 'Patrimoniar, caso necessário', grupo: 'Pagamento', setor: 'Cent. Patr.', opcional: true },
  { id: 'E32', nome: 'Realizar o pagamento', grupo: 'Pagamento', setor: 'DF/BM6/CEDEC' },
  { id: 'E33', nome: 'Preparar processo para auditoria', grupo: 'Encerramento', setor: 'Contr. Interna' },
  { id: 'E34', nome: 'Digitalizar processo, caso necessário', grupo: 'Encerramento', setor: 'Contr. Interna', opcional: true },
  { id: 'E35', nome: 'Arquivar', grupo: 'Encerramento', setor: 'Contr. Interna' },
];

/** Etapas com papel especial no motor. */
export const ETAPA_DEFINIR_RITO = 'E06';
export const ETAPA_ARTEFATOS = 'E07';
export const ETAPA_PRD = 'E20';
export const ETAPA_CONTRATACAO = 'E19';
export const ETAPA_FINAL = 'E35';

/** Para onde vai o processo depois de ajustar artefatos (E16). Padrão: E17. Troque por 'E14' para voltar ao CONJUR. */
export const APOS_AJUSTES_E16 = 'E17';

/** Uma decisão: o campo do processo decide o desvio (sim → `sim`, não → `nao`). */
export interface Desvio {
  campo: CampoDecisao;
  sim: string;
  nao: string;
}

/**
 * Depois de cada etapa: o id da próxima, um desvio por decisão, ou null (fim).
 * Quem não está aqui segue a ordem numérica (E19→E20→…→E35).
 */
export const TRANSICOES: Record<string, string | Desvio | null> = {
  E08: { campo: 'necessitaDotacao', sim: 'E09', nao: 'E11' },
  E13: { campo: 'cbmGerenciadorOuParticipeArp', sim: 'E19', nao: 'E14' },
  E15: { campo: 'parecerJuridicoAprovadoSemRecomendacoes', sim: 'E17', nao: 'E16' },
  E16: APOS_AJUSTES_E16,
  E17: { campo: 'haveraFaseExterna', sim: 'E18', nao: 'E19' },
  E35: null,
};

export interface PerguntaFluxo {
  campo: CampoDecisao;
  texto: string;
}

export const PERGUNTAS: Record<CampoDecisao, PerguntaFluxo> = {
  necessitaDotacao: { campo: 'necessitaDotacao', texto: 'É necessário dotação orçamentária?' },
  cbmGerenciadorOuParticipeArp: { campo: 'cbmGerenciadorOuParticipeArp', texto: 'O CBM é Gerenciador ou Partícipe de ARP?' },
  parecerJuridicoAprovadoSemRecomendacoes: { campo: 'parecerJuridicoAprovadoSemRecomendacoes', texto: 'Parecer jurídico aprovado e sem recomendações?' },
  haveraFaseExterna: { campo: 'haveraFaseExterna', texto: 'Haverá fase externa?' },
  dispensaAteMetadeLimite: { campo: 'dispensaAteMetadeLimite', texto: 'Valor estimado até 50% do limite da dispensa por valor?' },
};

/** Ritos que perguntam `dispensaAteMetadeLimite` (decisão que muda só o checklist da E07). */
export const RITOS_COM_PERGUNTA_DISPENSA: RitoCompras[] = ['dispensa_eletronica'];

export const ROTULO_RITO: Record<RitoCompras, string> = {
  pregao_srp: 'Pregão Eletrônico para Registro de Preços (SRP)',
  pregao: 'Pregão Eletrônico',
  concorrencia: 'Concorrência',
  dispensa_eletronica: 'Dispensa Eletrônica',
  inexigibilidade: 'Inexigibilidade',
  gerenciador_ata: 'Gerenciador da Ata de Registro de Preços',
  participe_ata: 'Partícipe de Ata de Registro de Preços',
  adesao_ata: 'Adesão à Ata de Registro de Preços',
};

/** Item exigido na E07. `apelidos` = jeitos de o checklist do sistema/planilha chamar o mesmo item (sem acento, minúsculo). */
export interface ItemE07 {
  id: string;
  rotulo: string;
  apelidos: string[];
}

const ETP: ItemE07 = { id: 'etp', rotulo: 'ETP', apelidos: ['estudo tecnico preliminar', 'etp'] };
const AR: ItemE07 = { id: 'ar', rotulo: 'AR', apelidos: ['analise de risco', 'analise de riscos', 'matriz de risco', 'matriz de riscos'] };
const TR: ItemE07 = { id: 'tr', rotulo: 'TR', apelidos: ['termo de referencia', 'tr'] };
const PROJETO_BASICO: ItemE07 = { id: 'pb', rotulo: 'Projeto Básico', apelidos: ['projeto basico'] };
const SIMAS: ItemE07 = { id: 'simas', rotulo: 'Pesquisa e codificação no SIMAS', apelidos: ['simas'] };
const PESQUISA_PRECOS: ItemE07 = { id: 'pesquisa', rotulo: 'Pesquisa de preços', apelidos: ['pesquisa de precos', 'pesquisa de preco'] };
const OE: ItemE07 = { id: 'oe', rotulo: 'Orçamento Estimado (OE)', apelidos: ['orcamento estimado', 'oe'] };
const SEPLAD: ItemE07 = { id: 'seplad', rotulo: 'Solicitar autorização da SEPLAD', apelidos: ['seplad'] };
const IRP: ItemE07 = { id: 'irp', rotulo: 'Fazer IRP', apelidos: ['irp', 'intencao de registro de precos'] };
const AJUSTAR_TR_OE: ItemE07 = { id: 'ajuste', rotulo: 'Ajustar TR e OE', apelidos: ['ajustar tr', 'ajustar o tr', 'ajuste do tr', 'ajustar termo de referencia'] };
const MAPA: ItemE07 = { id: 'mapa', rotulo: 'Mapa de Demanda', apelidos: ['mapa de demanda'] };
const JUNTAR_DEMANDA_PAE: ItemE07 = { id: 'pae_original', rotulo: 'Juntar demanda ao PAE original', apelidos: ['pae original', 'demanda ao pae'] };
const JUNTAR_SRP: ItemE07 = { id: 'doc_srp', rotulo: 'Juntar documentação do SRP (edital e anexos)', apelidos: ['documentacao do srp', 'edital e anexos'] };
const ACEITE_EMPRESA: ItemE07 = { id: 'aceite_empresa', rotulo: 'Juntar solicitação de aceite e aceite da empresa', apelidos: ['aceite da empresa', 'aceite do fornecedor'] };
const AUTORIZACAO_ORGAO: ItemE07 = { id: 'autorizacao_orgao', rotulo: 'Juntar solicitação de autorização e autorização do órgão', apelidos: ['autorizacao do orgao'] };

/** Checklist da E07 por rito, na ordem. A dispensa tem uma variação (≤ 50% do limite) logo abaixo. */
export const CHECKLIST_E07: Record<RitoCompras, ItemE07[]> = {
  pregao_srp: [ETP, AR, TR, SIMAS, PESQUISA_PRECOS, OE, SEPLAD, IRP, AJUSTAR_TR_OE],
  pregao: [ETP, AR, TR, SIMAS, PESQUISA_PRECOS, OE],
  concorrencia: [ETP, AR, PROJETO_BASICO, PESQUISA_PRECOS, OE],
  dispensa_eletronica: [ETP, AR, TR, SIMAS, PESQUISA_PRECOS, OE],
  inexigibilidade: [ETP, AR, TR, SIMAS, PESQUISA_PRECOS, OE],
  gerenciador_ata: [JUNTAR_DEMANDA_PAE, MAPA],
  participe_ata: [JUNTAR_SRP, MAPA],
  adesao_ata: [ETP, AR, TR, SIMAS, PESQUISA_PRECOS, JUNTAR_SRP, ACEITE_EMPRESA, AUTORIZACAO_ORGAO, OE],
};

/** Dispensa com valor até 50% do limite (`dispensaAteMetadeLimite = true`). */
export const CHECKLIST_E07_DISPENSA_ATE_METADE: ItemE07[] = [TR, SIMAS, PESQUISA_PRECOS, OE];

/**
 * Nome canônico do rito antigo (ver RITOS_CANONICOS em src/lib/ritosProcessuais.ts)
 * → rito do fluxo. Um teste garante que estes nomes existem lá.
 */
export const MAPA_RITO_ANTIGO: Record<string, RitoCompras> = {
  'Pregão Eletrônico': 'pregao',
  'Pregão Eletrônico p/ Registro de preços': 'pregao_srp',
  'Gerenciador da Ata de Registro de Preços': 'gerenciador_ata',
  'Partícipe de uma ata de registro de preços': 'participe_ata',
  'Adesão à ata de registro de preços': 'adesao_ata',
  Inexigibilidade: 'inexigibilidade',
  'Inexigibilidade p/ Cursos': 'inexigibilidade',
  'Dispensa em Situação de Emergência': 'dispensa_eletronica',
  'Dispensa por legislação (IOEPA - Lei 14.133, Art. 75, IX)': 'dispensa_eletronica',
  'Dispensa por valor (Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)': 'dispensa_eletronica',
  'Dispensa por valor irrisório (Dec. N°2.787/22, Art. 3º, §6º)': 'dispensa_eletronica',
};

/** Ritos que não são compras (não seguem este fluxo). Nomes canônicos. */
export const RITOS_FORA_DO_FLUXO: string[] = [
  'Prorrogação de contrato',
  'Acréscimo ou supressão',
  'Reequilíbrio, Repacotamento ....',
  'Cotação Deserta / Fracassada por 3 vezes',
  'Outro',
];

/**
 * Localização (texto livre da planilha, ex.: "CBM > DAL > SIPC") → etapas em
 * que o processo costuma estar lá. A PRIMEIRA regra que casar vale; por isso
 * os mais específicos vêm antes. Padrões sem acento e em minúsculas.
 */
export interface RegraLocalizacao {
  setor: string;
  padroes: RegExp[];
  etapas: string[];
}

export const REGRAS_LOCALIZACAO: RegraLocalizacao[] = [
  { setor: 'DAL-SIPC', padroes: [/\bsipc\b/], etapas: ['E06', 'E07', 'E20'] },
  { setor: 'DAL-SAS', padroes: [/\bsas\b/], etapas: ['E04', 'E05', 'E08', 'E09'] },
  { setor: 'CONJUR', padroes: [/\bconjur\b/, /consultoria juridica/], etapas: ['E14', 'E15'] },
  { setor: 'Ord. Despesas', padroes: [/ordenador/, /ord\.? despesas?/], etapas: ['E13', 'E22'] },
  { setor: 'DCA', padroes: [/\bdca\b/], etapas: ['E11', 'E12', 'E16', 'E17', 'E18', 'E19'] },
  { setor: 'DF/BM6/CEDEC', padroes: [/\bdf\b/, /\bbm\s?-?6\b/, /\bcedec\b/, /financas/], etapas: ['E10', 'E21', 'E32'] },
  { setor: 'Cent. Patr.', padroes: [/patrimonio/, /cent\.? patr/], etapas: ['E30', 'E31'] },
  { setor: 'Contr. Interna', padroes: [/controle interno/, /contr\.? interna/], etapas: ['E33', 'E34', 'E35'] },
  { setor: 'Fiscal', padroes: [/\bfiscal\b/], etapas: ['E25', 'E26', 'E27', 'E28', 'E29'] },
  { setor: 'Gestor de Contratos', padroes: [/gestao de contratos/, /gestor de contratos/], etapas: ['E24'] },
  { setor: 'DGA', padroes: [/\bdga\b/], etapas: ['E02'] },
  { setor: 'DAL', padroes: [/\bdal\b/], etapas: ['E03', 'E23'] },
];

/**
 * Pistas no texto do andamento. Só desempatam entre etapas que a localização
 * já indicou — NUNCA decidem sozinhas (o texto é livre e pode enganar).
 */
export const PISTAS_ANDAMENTO: Array<{ padrao: RegExp; etapaId: string }> = [
  { padrao: /parecer juridico/, etapaId: 'E14' },
  { padrao: /comandante geral|cmte geral/, etapaId: 'E15' },
  { padrao: /nota de empenho|\bne\b/, etapaId: 'E21' },
  { padrao: /pagamento/, etapaId: 'E32' },
  { padrao: /\bprd\b/, etapaId: 'E20' },
  { padrao: /dotacao/, etapaId: 'E10' },
  { padrao: /autoriza/, etapaId: 'E13' },
  { padrao: /minuta/, etapaId: 'E11' },
];

/**
 * Ao definir o rito pela tela do fluxo, se o campo antigo `rito_processual`
 * estiver vazio ele é preenchido com este nome (para o checklist atual do
 * sistema aparecer). Concorrência não tem equivalente antigo: fica de fora.
 * Nomes iguais aos de RITOS_CANONICOS (src/lib/ritosProcessuais.ts).
 */
export const RITO_ANTIGO_EQUIVALENTE: Partial<Record<RitoCompras, string>> = {
  pregao: 'Pregão Eletrônico',
  pregao_srp: 'Pregão Eletrônico p/ Registro de preços',
  dispensa_eletronica: 'Dispensa por valor (Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)',
  inexigibilidade: 'Inexigibilidade',
  gerenciador_ata: 'Gerenciador da Ata de Registro de Preços',
  participe_ata: 'Partícipe de uma ata de registro de preços',
  adesao_ata: 'Adesão à ata de registro de preços',
};

/** Perfis que podem confirmar etapa, corrigir e responder as perguntas do fluxo (as Rules repetem esta lista). */
export const PERFIS_QUE_CONFIRMAM_FLUXO = ['master', 'apoio', 'contratos'];

// ---------------------------------------------------------------------------
// PRAZOS (Fase C). Valores PROVISÓRIOS: DAL e Master os ajustam na tela
// "Prazos do fluxo"; o que for salvo lá (coleção `config_fluxo`) vale no lugar
// destes. Dias corridos.

export interface MarcoFluxo {
  id: string;
  nome: string;
  /** Etapa em que o marco é atingido (ao concluí-la). */
  etapaId: string;
}

/** Marcos acompanhados. Para mudar a etapa de um marco, troque o `etapaId`. */
export const MARCOS: MarcoFluxo[] = [
  { id: 'contrato', nome: 'Contrato', etapaId: 'E19' },
  { id: 'empenho', nome: 'Empenho', etapaId: 'E22' },
  { id: 'entrega', nome: 'Entrega', etapaId: 'E27' },
  { id: 'pagamento', nome: 'Pagamento', etapaId: 'E32' },
];

/** Última etapa da fase em que o prazo total do rito é repartido (a contratação). */
export const ETAPA_FIM_PRAZO_RITO = 'E19';

/**
 * Dias de referência por etapa (PROVISÓRIOS).
 * - E01–E19: servem de PESO. O prazo total do rito até a contratação (ex.: pregão
 *   120 dias, em src/lib/prazosProcesso.ts) é repartido entre as etapas do
 *   caminho do processo na proporção destes valores. Sem prazo total para o
 *   rito (ex.: concorrência), valem estes dias como estão.
 * - E20–E35: dias fixos de cada etapa.
 */
export const DIAS_PADRAO_ETAPA: Record<string, number> = {
  E01: 1, E02: 2, E03: 2, E04: 2, E05: 2, E06: 3, E07: 20, E08: 5, E09: 3, E10: 7,
  E11: 10, E12: 3, E13: 5, E14: 15, E15: 5, E16: 10, E17: 25, E18: 25, E19: 7,
  E20: 3, E21: 5, E22: 3, E23: 2, E24: 1, E25: 2, E26: 2, E27: 15, E28: 5, E29: 3,
  E30: 2, E31: 3, E32: 15, E33: 10, E34: 5, E35: 2,
};

/** Faltando até este nº de dias (ou menos) para o prazo, a situação vira "atenção". */
export const DIAS_ATENCAO = 5;

/** Etapas "caso necessário" entram na contagem e nos dias? Padrão: não (considera-se que foram puladas). */
export const CONTAR_ETAPAS_OPCIONAIS = false;

/** Mínimo de passagens FECHADAS de uma etapa para usar a mediana real (Fase D); abaixo disso fica "poucos dados". */
export const MIN_CASOS_HISTORICO = 5;

/** Máximo de passagens guardadas por processo (as Rules também limitam). */
export const MAX_PASSAGENS_POR_PROCESSO = 80;
