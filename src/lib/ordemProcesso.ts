/**
 * Nº de ordem (coluna A da planilha de processos). Processos criados no
 * sistema antes de o número ser gravado, ou cujo PAE não bate exatamente com o
 * da planilha (prefixo "E-", várias PAEs na mesma célula, espaço sobrando),
 * ficam sem número; aqui se descobre o que cada um deve receber.
 */
import type { Processo } from '../types';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Chaves "AAAA/NNNN" de todas as PAEs achadas num texto (aceita "E-", espaços e várias PAEs). */
export function chavesPae(texto: string | undefined): string[] {
  return [...(texto ?? '').matchAll(/(\d{4})\s*\/\s*(\d+)/g)].map((m) => `${m[1]}/${m[2]}`);
}

export const normalizarObjeto = (t: string | undefined) =>
  semAcento(t ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface LinhaComOrdem {
  /** Texto da célula do PAE (pode ter prefixo ou mais de uma PAE). */
  numero_processo: string;
  objeto?: string;
  ordem?: number;
}

type ProcessoParaOrdem = Pick<Processo, 'id' | 'numero_processo' | 'objeto' | 'ordem' | 'criado_em'>;

/** Só vale a correspondência quando é única (nem dois processos nem duas linhas disputando o mesmo número). */
function mapaUnico(entradas: [string, number][]): Map<string, number> {
  const mapa = new Map<string, number>();
  const repetidas = new Set<string>();
  for (const [chave, ordem] of entradas) {
    if (!chave) continue;
    if (mapa.has(chave) && mapa.get(chave) !== ordem) repetidas.add(chave);
    mapa.set(chave, ordem);
  }
  repetidas.forEach((c) => mapa.delete(c));
  return mapa;
}

/**
 * Devolve o nº de ordem de cada processo que ainda não tem: o da linha
 * correspondente da planilha (pelo objeto, depois pelo PAE) ou, se não houver,
 * o próximo da sequência. Nunca repete um número já usado.
 */
export function ordensFaltantes(processos: ProcessoParaOrdem[], linhas: LinhaComOrdem[]): Map<string, number> {
  const comOrdem = linhas.filter((l): l is LinhaComOrdem & { ordem: number } => typeof l.ordem === 'number');
  const porObjeto = mapaUnico(comOrdem.map((l) => [normalizarObjeto(l.objeto), l.ordem]));
  const porPae = mapaUnico(comOrdem.flatMap((l) => chavesPae(l.numero_processo).map((c): [string, number] => [c, l.ordem])));

  const usadas = new Set<number>();
  let maior = 0;
  for (const p of processos) if (p.ordem) { usadas.add(p.ordem); maior = Math.max(maior, p.ordem); }
  for (const l of comOrdem) maior = Math.max(maior, l.ordem);

  const resultado = new Map<string, number>();
  const semOrdem = processos
    .filter((p) => !p.ordem)
    .sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? ''));

  for (const p of semOrdem) {
    const candidatos = [porObjeto.get(normalizarObjeto(p.objeto)), ...chavesPae(p.numero_processo).slice(0, 1).map((c) => porPae.get(c))];
    const achado = candidatos.find((o): o is number => o !== undefined && !usadas.has(o));
    const ordem = achado ?? ++maior;
    usadas.add(ordem);
    resultado.set(p.id, ordem);
  }
  return resultado;
}
