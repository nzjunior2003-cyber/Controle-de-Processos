import { describe, expect, it } from 'vitest';
import { corDoSetor } from './coresSetor';

describe('corDoSetor', () => {
  it('devolve sempre a mesma cor para o mesmo nome', () => {
    const primeira = corDoSetor('DGCEP');
    const segunda = corDoSetor('DGCEP');
    expect(primeira).toEqual(segunda);
  });

  it('devolve cores diferentes para nomes diferentes (na maioria dos casos)', () => {
    const cores = ['DGCEP', 'CEINT', 'CFAE', 'ASCOM', 'DTIC', 'AJG'].map((nome) => corDoSetor(nome).bg);
    const distintas = new Set(cores);
    expect(distintas.size).toBeGreaterThan(1);
  });

  it('devolve uma cor neutra para nome vazio ou indefinido', () => {
    expect(corDoSetor('').bg).toBe('bg-gray-50');
    expect(corDoSetor(undefined).bg).toBe('bg-gray-50');
  });

  it('ignora espaços extras ao redor do nome', () => {
    expect(corDoSetor('  DGCEP  ')).toEqual(corDoSetor('DGCEP'));
  });
});
