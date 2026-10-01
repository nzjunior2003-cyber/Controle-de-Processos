import type { PCA } from '../types';

export interface FiltroPca {
  /** Ano do exercício; '' = todos. */
  exercicio: number | '';
  /** 'ALTA' | 'MÉDIA' | 'BAIXA'; '' = qualquer. */
  prioridade: string;
  busca: string;
}

/**
 * Filtra e ordena (pela ordem do PCA) os itens do plano — compartilhado
 * pela listagem e pelo relatório em PDF, pra os dois mostrarem sempre os
 * mesmos itens pros mesmos filtros.
 */
export function filtrarItensPca(pcas: PCA[], filtro: FiltroPca): PCA[] {
  const buscaNormalizada = filtro.busca.toLowerCase();
  return pcas
    .filter((p) => (filtro.exercicio === '' ? true : p.exercicio === filtro.exercicio))
    .filter((p) => (filtro.prioridade ? p.prioridade === filtro.prioridade : true))
    .filter((p) => {
      if (!buscaNormalizada) return true;
      return [p.codigo_pca, p.objeto_pca, p.unidade_responsavel, p.origem, p.numero_pae].some((campo) =>
        (campo || '').toLowerCase().includes(buscaNormalizada),
      );
    })
    .sort((a, b) => Number(a.codigo_pca) - Number(b.codigo_pca));
}
