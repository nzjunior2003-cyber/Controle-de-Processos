import { describe, expect, it } from 'vitest';
import { filtrarItensPca } from './pca';
import type { PCA } from '../types';

const item = (overrides: Partial<PCA>): PCA => ({
  id: 'x',
  codigo_pca: '1',
  objeto_pca: 'Aquisição de uniformes',
  exercicio: 2026,
  unidade_responsavel: 'DGCEP',
  valor_previsto: 100,
  item_pca: '',
  grupo_pca: '',
  fonte_recurso: '',
  ...overrides,
});

const itens = [
  item({ id: 'a', codigo_pca: '10', exercicio: 2026, prioridade: 'ALTA' }),
  item({ id: 'b', codigo_pca: '2', exercicio: 2026, prioridade: 'BAIXA', objeto_pca: 'Câmeras de segurança', origem: 'CEINT' }),
  item({ id: 'c', codigo_pca: '3', exercicio: 2027, prioridade: 'ALTA' }),
];

describe('filtrarItensPca', () => {
  it('filtra por exercício e ordena pela ordem numérica do PCA', () => {
    const resultado = filtrarItensPca(itens, { exercicio: 2026, prioridade: '', busca: '' });
    expect(resultado.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('"todos os exercícios" não filtra por ano', () => {
    expect(filtrarItensPca(itens, { exercicio: '', prioridade: '', busca: '' })).toHaveLength(3);
  });

  it('filtra por prioridade', () => {
    const resultado = filtrarItensPca(itens, { exercicio: '', prioridade: 'ALTA', busca: '' });
    expect(resultado.map((p) => p.id)).toEqual(['c', 'a']);
  });

  it('busca em objeto, setor/origem, ordem e PAE, ignorando caixa', () => {
    expect(filtrarItensPca(itens, { exercicio: '', prioridade: '', busca: 'CÂMERAS' }).map((p) => p.id)).toEqual(['b']);
    expect(filtrarItensPca(itens, { exercicio: '', prioridade: '', busca: 'ceint' }).map((p) => p.id)).toEqual(['b']);
  });
});
