import { describe, expect, it } from 'vitest';
import { encontrarObjetosSemelhantes } from './correspondenciaTexto';

describe('encontrarObjetosSemelhantes', () => {
  it('encontra objetos com palavras significativas em comum', () => {
    const resultado = encontrarObjetosSemelhantes(
      'Aquisição de viaturas para o Corpo de Bombeiros',
      [
        { item: 'a', objeto: 'Aquisição de viaturas operacionais' },
        { item: 'b', objeto: 'Contratação de serviço de limpeza' },
      ],
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0].item).toBe('a');
  });

  it('não considera correspondência quando não há sobreposição relevante', () => {
    const resultado = encontrarObjetosSemelhantes(
      'Aquisição de coletes balísticos',
      [{ item: 'a', objeto: 'Serviço de manutenção de piscina' }],
    );
    expect(resultado).toHaveLength(0);
  });

  it('ignora acentuação e maiúsculas/minúsculas na comparação', () => {
    const resultado = encontrarObjetosSemelhantes(
      'AQUISIÇÃO DE ALVOS DE TIRO',
      [{ item: 'a', objeto: 'aquisicao de alvos de tiro' }],
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0].score).toBeGreaterThan(0.8);
  });

  it('devolve lista vazia para objeto sem palavras significativas', () => {
    expect(encontrarObjetosSemelhantes('de a o', [{ item: 'a', objeto: 'qualquer coisa' }])).toHaveLength(0);
  });

  it('ordena do mais parecido pro menos parecido', () => {
    const resultado = encontrarObjetosSemelhantes(
      'Aquisição de material de expediente para o quartel',
      [
        { item: 'pouco-parecido', objeto: 'Aquisição de material' },
        { item: 'muito-parecido', objeto: 'Aquisição de material de expediente para o quartel geral' },
      ],
    );
    expect(resultado[0].item).toBe('muito-parecido');
  });
});
