/**
 * Similaridade de texto livre entre o objeto de um novo processo e objetos
 * já cadastrados (IRPs em que somos partícipe, ARPs vigentes) — usada pro
 * alerta "já existe uma IRP/ARP com objeto semelhante" ao abrir um
 * processo em Apoio e Suprimento (item 17 do plano de melhorias). Não há
 * catálogo de materiais/serviços no sistema, então a comparação é por
 * sobreposição de palavras significativas (tipo Jaccard), sem dependência
 * externa.
 */

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'por', 'com',
  'sem', 'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às',
  'que', 'ou', 'se', 'sua', 'seu', 'suas', 'seus', 'pelo', 'pela', 'pelos', 'pelas',
]);

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
}

function tokenizar(texto: string): Set<string> {
  return new Set(
    normalizar(texto)
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function similaridadeJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let interseccao = 0;
  for (const token of a) {
    if (b.has(token)) interseccao++;
  }
  const uniao = a.size + b.size - interseccao;
  return uniao === 0 ? 0 : interseccao / uniao;
}

export interface CandidatoObjeto<T> {
  item: T;
  objeto: string;
}

export interface CorrespondenciaObjeto<T> {
  item: T;
  score: number;
}

/**
 * Compara `objeto` com cada candidato e devolve os que passam do limiar de
 * similaridade (0 a 1), ordenados do mais parecido pro menos parecido.
 */
export function encontrarObjetosSemelhantes<T>(
  objeto: string,
  candidatos: CandidatoObjeto<T>[],
  limiar = 0.4,
): CorrespondenciaObjeto<T>[] {
  const tokensObjeto = tokenizar(objeto);
  if (tokensObjeto.size === 0) return [];

  return candidatos
    .map((candidato) => ({ item: candidato.item, score: similaridadeJaccard(tokensObjeto, tokenizar(candidato.objeto)) }))
    .filter((resultado) => resultado.score >= limiar)
    .sort((a, b) => b.score - a.score);
}
