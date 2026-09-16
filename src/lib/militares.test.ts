import { describe, expect, it } from 'vitest';
import {
  buscarMilitares,
  buscarMilitarPorMf,
  formatarNomeMilitar,
  mapLinhaMilitar,
  type Militar,
} from './militares';

describe('mapLinhaMilitar', () => {
  it('mapeia uma linha com cabeçalho pros campos de Militar', () => {
    const resultado = mapLinhaMilitar({
      CARGO: '1º TEN QOABM',
      NOME: 'JOELMIR',
      MF: '123456',
      UBM: 'CSMV',
    });
    expect(resultado).toEqual({ cargo: '1º TEN QOABM', nome: 'JOELMIR', mf: '123456', ubm: 'CSMV' });
  });

  it('tolera espaço extra e caixa diferente no cabeçalho', () => {
    const resultado = mapLinhaMilitar({ ' nome ': 'JOELMIR', cargo: '1º TEN' });
    expect(resultado).toEqual({ cargo: '1º TEN', nome: 'JOELMIR', mf: '', ubm: '' });
  });

  it('lê a MF da coluna "matricula" — o nome real da coluna na planilha (não "MF")', () => {
    const resultado = mapLinhaMilitar({
      nome: 'ABDIAS DO NASCIMENTO NETO',
      matricula: '57189387',
      cargo: '2 SARGENTO / BM',
    });
    expect(resultado).toEqual({
      cargo: '2 SARGENTO / BM',
      nome: 'ABDIAS DO NASCIMENTO NETO',
      mf: '57189387',
      ubm: '',
    });
  });

  it('devolve null quando não há nome (linha em branco/título de seção)', () => {
    expect(mapLinhaMilitar({ CARGO: '1º TEN' })).toBeNull();
  });
});

describe('formatarNomeMilitar', () => {
  it('junta cargo e nome', () => {
    expect(formatarNomeMilitar({ cargo: '1º TEN QOABM', nome: 'JOELMIR' })).toBe('1º TEN QOABM JOELMIR');
  });

  it('usa só o nome quando não há cargo', () => {
    expect(formatarNomeMilitar({ cargo: '', nome: 'JOELMIR' })).toBe('JOELMIR');
  });
});

describe('buscarMilitares', () => {
  const militares: Militar[] = [
    { cargo: '1º TEN QOABM', nome: 'JOELMIR', mf: '111', ubm: 'CSMV' },
    { cargo: 'CB BM', nome: 'SOUTO', mf: '222', ubm: 'QCG' },
    { cargo: 'TCEL BM', nome: 'SOUTO JUNIOR', mf: '333', ubm: 'DTIC' },
  ];

  it('busca por nome', () => {
    expect(buscarMilitares(militares, 'joelmir')).toEqual([militares[0]]);
  });

  it('busca por cargo, MF ou UBM', () => {
    expect(buscarMilitares(militares, 'tcel')).toEqual([militares[2]]);
    expect(buscarMilitares(militares, '222')).toEqual([militares[1]]);
    expect(buscarMilitares(militares, 'dtic')).toEqual([militares[2]]);
  });

  it('devolve lista vazia pra termo vazio, em vez de tudo', () => {
    expect(buscarMilitares(militares, '  ')).toEqual([]);
  });

  it('respeita o limite de resultados', () => {
    expect(buscarMilitares(militares, 'souto', 1)).toHaveLength(1);
  });
});

describe('buscarMilitarPorMf', () => {
  const militares: Militar[] = [
    { cargo: '1º TEN QOABM', nome: 'JOELMIR', mf: '111', ubm: 'CSMV' },
    { cargo: 'CB BM', nome: 'SOUTO', mf: '222', ubm: 'QCG' },
  ];

  it('acha por MF exata, ignorando caixa/espaço', () => {
    expect(buscarMilitarPorMf(militares, ' 222 ')).toEqual(militares[1]);
  });

  it('não acha por substring (diferente de buscarMilitares)', () => {
    expect(buscarMilitarPorMf(militares, '22')).toBeUndefined();
  });

  it('devolve undefined pra MF vazia ou não encontrada', () => {
    expect(buscarMilitarPorMf(militares, '')).toBeUndefined();
    expect(buscarMilitarPorMf(militares, '999')).toBeUndefined();
  });
});
