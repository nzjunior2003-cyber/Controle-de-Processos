/**
 * Ritos processuais unificados. O sistema tinha duas listas de ritos que se
 * sobrepunham: a antiga, escrita no código (`CHECKLISTS_RITOS`, em
 * types.ts), e a oficial, lida da aba "RITO DE PROCESSOS" da planilha — o
 * menu mostrava os dois, com quase tudo duplicado ("Pregão Eletrônico
 * (SRP)" e "Pregão Eletrônico p/ Registro de preços", etc.). Aqui cada rito
 * tem um nome canônico e uma lista de nomes alternativos que apontam pra
 * ele; o checklist de cada rito é o que tiver mais itens entre as duas
 * fontes.
 */
import { CHECKLISTS_RITOS } from '../types';

export const RITO_ADESAO_ARP = 'Adesão à ata de registro de preços';
export const RITO_GERENCIADOR_ARP = 'Gerenciador da Ata de Registro de Preços';
export const RITO_PARTICIPE_ARP = 'Partícipe de uma ata de registro de preços';

/**
 * Nome canônico → nomes alternativos (os antigos do código e as grafias da
 * planilha). Os dois ritos de dispensa "por valor" não levam mais o valor
 * em reais no nome — ele muda todo ano; a comparação ignora qualquer
 * "R$ ..." (ver `chave`), então continua casando se a planilha atualizar o
 * valor no cabeçalho. A ordem das chaves é a ordem do menu.
 */
export const RITOS_CANONICOS: Record<string, string[]> = {
  'Pregão Eletrônico': [],
  'Pregão Eletrônico p/ Registro de preços': ['Pregão Eletrônico (SRP)', 'Pregão Eletrônico para Registro de Preços'],
  [RITO_GERENCIADOR_ARP]: ['Gerenciador da ARP', 'Gerenciador da Ata'],
  [RITO_PARTICIPE_ARP]: ['Partícipe de ARP', 'Participação em Ata'],
  [RITO_ADESAO_ARP]: ['Adesão ARP', 'Adesão à Ata'],
  Inexigibilidade: ['Inexigibilidade (com as suas variantes)'],
  'Inexigibilidade p/ Cursos': ['Inexigibilidade (p/ Curso)'],
  'Dispensa em Situação de Emergência': [],
  'Dispensa por legislação (IOEPA - Lei 14.133, Art. 75, IX)': [],
  'Dispensa por valor (Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)': ['Dispensa por valor'],
  'Dispensa por valor irrisório (Dec. N°2.787/22, Art. 3º, §6º)': ['Dispensa por valor irrisório'],
  'Prorrogação de contrato': ['Prorrogação'],
  'Acréscimo ou supressão': ['Acréscimo'],
  'Reequilíbrio, Repacotamento ....': [],
  'Cotação Deserta / Fracassada por 3 vezes': [],
  Outro: [],
};

/**
 * Ritos genéricos antigos sem equivalente único na planilha (a planilha
 * separa dispensa em 4 tipos e aditivo em Prorrogação / Acréscimo /
 * Reequilíbrio) — saem do menu; processos antigos que usam esses nomes
 * continuam com o texto salvo, só sem checklist até escolherem um rito
 * específico.
 */
const RITOS_REMOVIDOS_DO_MENU = [
  'Dispensa de Licitação (com suas variantes)',
  'Aditivo Contratual (Tempo, Valor ou tempo e valor)',
];

/**
 * Chave de comparação: sem acentos, caixa, pontuação, espaços/quebras de
 * linha nem valores em reais — as grafias da planilha variam nisso tudo.
 */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/r\$\s*[\d.,]+/g, '')
    .replace(/[º°]/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

const CANONICO_POR_CHAVE = new Map<string, string>();
Object.entries(RITOS_CANONICOS).forEach(([canonico, alternativos]) => {
  CANONICO_POR_CHAVE.set(chave(canonico), canonico);
  alternativos.forEach((alternativo) => CANONICO_POR_CHAVE.set(chave(alternativo), canonico));
});

const CHAVES_REMOVIDAS = new Set(RITOS_REMOVIDOS_DO_MENU.map(chave));

/** Devolve o nome canônico do rito; nome desconhecido volta como está (só sem espaços nas pontas). */
export function normalizarRito(nome: string | undefined): string | undefined {
  if (nome === undefined) return undefined;
  const texto = nome.trim();
  if (!texto) return texto;
  return CANONICO_POR_CHAVE.get(chave(texto)) ?? texto;
}

/**
 * Junta as listas de etapas de várias fontes numa só, por rito canônico,
 * ficando com a lista que tiver mais itens (empate: a fonte que vier por
 * último). Ritos fora do conjunto canônico (ex.: um novo rito acrescentado
 * na planilha) são mantidos, depois dos canônicos.
 */
export function unificarEtapasPorRito(...fontes: Record<string, string[]>[]): Record<string, string[]> {
  const porRito = new Map<string, string[]>();
  fontes.forEach((fonte) => {
    Object.entries(fonte).forEach(([nome, itens]) => {
      if (CHAVES_REMOVIDAS.has(chave(nome))) return;
      const canonico = normalizarRito(nome) as string;
      const atual = porRito.get(canonico);
      if (!atual || itens.length >= atual.length) porRito.set(canonico, itens);
    });
  });

  const resultado: Record<string, string[]> = {};
  Object.keys(RITOS_CANONICOS).forEach((canonico) => {
    const itens = porRito.get(canonico);
    if (itens) resultado[canonico] = itens;
  });
  porRito.forEach((itens, canonico) => {
    if (!(canonico in resultado)) resultado[canonico] = itens;
  });
  return resultado;
}

/** Etapas de cada rito usando só o dicionário do código — fallback enquanto a planilha não carregou. */
export const ETAPAS_PADRAO: Record<string, string[]> = unificarEtapasPorRito(CHECKLISTS_RITOS);
