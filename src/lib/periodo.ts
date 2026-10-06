/** Filtro por vários anos e/ou vários meses (listas vazias = sem restrição). */
export interface FiltroPeriodo {
  anos: number[];
  /** 1 a 12. */
  meses: number[];
}

export const FILTRO_PERIODO_VAZIO: FiltroPeriodo = { anos: [], meses: [] };

export const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const filtroPeriodoAtivo = (f: FiltroPeriodo) => f.anos.length > 0 || f.meses.length > 0;

/** Compara uma competência 'AAAA-MM' (ou data ISO) com o filtro; competência vazia só passa sem filtro. */
export function competenciaNoPeriodo(competencia: string | undefined, filtro: FiltroPeriodo): boolean {
  if (!filtroPeriodoAtivo(filtro)) return true;
  const ano = Number((competencia ?? '').slice(0, 4));
  const mes = Number((competencia ?? '').slice(5, 7));
  if (!ano || !mes) return false;
  if (filtro.anos.length > 0 && !filtro.anos.includes(ano)) return false;
  if (filtro.meses.length > 0 && !filtro.meses.includes(mes)) return false;
  return true;
}

/** Liga/desliga um valor numa lista (ordenada). */
export const alternarValor = (lista: number[], valor: number) =>
  (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]).sort((a, b) => a - b);
