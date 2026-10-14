import { describe, expect, it } from 'vitest';
import { chavesPae, ordensFaltantes } from './ordemProcesso';

const proc = (id: string, numero: string, objeto: string, ordem?: number, criado = '2026-01-01') => ({
  id, numero_processo: numero, objeto, ordem, criado_em: criado,
});

describe('chavesPae', () => {
  it('acha as PAEs com ou sem E-, espaços e várias na mesma célula', () => {
    expect(chavesPae('E-2026/353535 ')).toEqual(['2026/353535']);
    expect(chavesPae('E-2026/2379178 E-2026/3155997  E-2025/2517810')).toEqual(['2026/2379178', '2026/3155997', '2025/2517810']);
    expect(chavesPae('')).toEqual([]);
  });
});

describe('ordensFaltantes', () => {
  const linhas = [
    { numero_processo: 'E-2026/353535 ', objeto: 'Aquisição de bateria portátil', ordem: 157 },
    { numero_processo: 'E-2026/2379178 E-2026/3155997', objeto: 'Revisão da Ata 023/2025', ordem: 120 },
    { numero_processo: 'E-2025/3152619', objeto: 'ADITIVO DE 25% AO CONTRATO N°408/2026', ordem: 127 },
    { numero_processo: 'E-2026/3544804', objeto: 'ALUGUEL DE ÔNIBUS', ordem: 171 },
  ];

  it('pega o número da planilha pelo objeto ou pelo PAE, mesmo com formato diferente', () => {
    const r = ordensFaltantes(
      [
        proc('a', '2026/3544804', 'Aluguel de onibus'),
        proc('b', '2026/3152619', 'ADITIVO DE 25% AO CONTRATO N°408/2026'), // ano diferente: casa pelo objeto
        proc('c', '2026/3155997', 'Revisão da Ata 023/2025'),
      ],
      linhas,
    );
    expect(r.get('a')).toBe(171);
    expect(r.get('b')).toBe(127);
    expect(r.get('c')).toBe(120);
  });

  it('dois processos com o mesmo PAE: o do objeto igual leva o número da planilha, o outro segue a sequência', () => {
    const r = ordensFaltantes(
      [
        proc('porteira', '2026/353535', 'Aquisição de porteira', undefined, '2026-02-02'),
        proc('bateria', '2026/353535', 'Aquisição de bateria portátil', undefined, '2026-02-01'),
      ],
      linhas,
    );
    expect(r.get('bateria')).toBe(157);
    expect(r.get('porteira')).toBe(172);
  });

  it('sem linha na planilha, continua a sequência pela data de criação e não repete números', () => {
    const r = ordensFaltantes(
      [proc('x', '2026/1', 'X', 5), proc('novo2', '2026/3', 'Z', undefined, '2026-03-02'), proc('novo1', '2026/2', 'Y', undefined, '2026-03-01')],
      [{ numero_processo: 'E-2026/9', objeto: 'Outro', ordem: 10 }],
    );
    expect(r.get('novo1')).toBe(11);
    expect(r.get('novo2')).toBe(12);
    expect(r.has('x')).toBe(false);
  });
});
