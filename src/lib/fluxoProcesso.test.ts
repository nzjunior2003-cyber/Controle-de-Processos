import { describe, expect, it } from 'vitest';
import {
  agruparEstadasPorProcesso,
  calcularDiasEstada,
  calcularMediaDiasPorLocalizacao,
  calcularMediaDiasPorRito,
  calcularTempoTotal,
  localizacaoEfetiva,
  montarLinhaDoTempo,
  type EstadaProcesso,
} from './fluxoProcesso';
import type { Processo } from '../types';

const agora = new Date('2026-09-07T00:00:00Z');

const estada = (over: Partial<EstadaProcesso>): EstadaProcesso => ({
  id: over.id ?? 'e1',
  processo_id: over.processo_id ?? 'p1',
  localizacao: over.localizacao ?? 'DTIC',
  data_inicio: over.data_inicio ?? '2026-09-01T00:00:00Z',
  data_fim: over.data_fim ?? null,
  ...over,
});

describe('calcularDiasEstada', () => {
  it('calcula os dias até agora quando a estadia está em curso (data_fim null)', () => {
    expect(calcularDiasEstada(estada({ data_inicio: '2026-09-01T00:00:00Z' }), agora)).toBe(6);
  });

  it('calcula os dias até data_fim quando a estadia já terminou', () => {
    expect(
      calcularDiasEstada(
        estada({ data_inicio: '2026-09-01T00:00:00Z', data_fim: '2026-09-04T00:00:00Z' }),
        agora,
      ),
    ).toBe(3);
  });

  it('nunca devolve negativo', () => {
    expect(calcularDiasEstada(estada({ data_inicio: '2026-09-10T00:00:00Z' }), agora)).toBe(0);
  });
});

describe('montarLinhaDoTempo', () => {
  it('ordena as estadias por data de início e calcula a duração de cada uma', () => {
    const linha = montarLinhaDoTempo(
      [
        estada({ id: 'e2', localizacao: 'CONJUR', data_inicio: '2026-09-04T00:00:00Z' }),
        estada({ id: 'e1', localizacao: 'DTIC', data_inicio: '2026-09-01T00:00:00Z', data_fim: '2026-09-04T00:00:00Z' }),
      ],
      agora,
    );

    expect(linha.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(linha[0].dias).toBe(3);
    expect(linha[1].dias).toBe(3);
  });
});

describe('calcularTempoTotal', () => {
  it('soma a duração de todas as estadias do processo', () => {
    const total = calcularTempoTotal(
      [
        estada({ id: 'e1', data_inicio: '2026-09-01T00:00:00Z', data_fim: '2026-09-03T00:00:00Z' }),
        estada({ id: 'e2', data_inicio: '2026-09-03T00:00:00Z', data_fim: '2026-09-05T00:00:00Z' }),
      ],
      agora,
    );
    expect(total).toBe(4);
  });
});

describe('calcularMediaDiasPorLocalizacao', () => {
  it('agrupa por localização e calcula a média de dias, do mais lento pro mais rápido', () => {
    const resultado = calcularMediaDiasPorLocalizacao(
      [
        estada({ localizacao: 'CONJUR', data_inicio: '2026-08-01T00:00:00Z', data_fim: '2026-08-11T00:00:00Z' }), // 10d
        estada({ localizacao: 'CONJUR', data_inicio: '2026-08-01T00:00:00Z', data_fim: '2026-08-21T00:00:00Z' }), // 20d
        estada({ localizacao: 'DTIC', data_inicio: '2026-08-01T00:00:00Z', data_fim: '2026-08-03T00:00:00Z' }), // 2d
      ],
      agora,
    );

    expect(resultado).toEqual([
      { localizacao: 'CONJUR', mediaDias: 15, ocorrencias: 2 },
      { localizacao: 'DTIC', mediaDias: 2, ocorrencias: 1 },
    ]);
  });
});

describe('calcularMediaDiasPorRito', () => {
  const processoBase: Processo = {
    id: 'p1',
    numero_processo: '2026/1',
    objeto: 'Objeto',
    demandante_id: '',
    unidade_demandante: 'DTIC',
    status: 'concluido',
    fase_atual_id: '1',
    possui_alerta: false,
    data_abertura: '2026-01-01T00:00:00Z',
    criado_em: '2026-01-01T00:00:00Z',
    atualizado_em: '2026-01-01T00:00:00Z',
  };

  it('só considera processos concluídos/arquivados, agrupando por rito', () => {
    const p1: Processo = { ...processoBase, id: 'p1', rito_processual: 'PREGÃO ELETRÔNICO', status: 'concluido' };
    const p2: Processo = { ...processoBase, id: 'p2', rito_processual: 'PREGÃO ELETRÔNICO', status: 'concluido' };
    const p3: Processo = { ...processoBase, id: 'p3', rito_processual: 'PREGÃO ELETRÔNICO', status: 'em_andamento' };

    const estadasPorProcesso = new Map<string, EstadaProcesso[]>([
      ['p1', [estada({ processo_id: 'p1', data_inicio: '2026-01-01T00:00:00Z', data_fim: '2026-01-11T00:00:00Z' })]], // 10d
      ['p2', [estada({ processo_id: 'p2', data_inicio: '2026-01-01T00:00:00Z', data_fim: '2026-01-21T00:00:00Z' })]], // 20d
      ['p3', [estada({ processo_id: 'p3', data_inicio: '2026-01-01T00:00:00Z' })]],
    ]);

    const resultado = calcularMediaDiasPorRito([p1, p2, p3], estadasPorProcesso, agora);
    expect(resultado).toEqual([{ rito: 'PREGÃO ELETRÔNICO', mediaDias: 15, ocorrencias: 2 }]);
  });

  it('ignora processos sem estadias registradas', () => {
    const p1: Processo = { ...processoBase, rito_processual: 'DISPENSA', status: 'concluido' };
    const resultado = calcularMediaDiasPorRito([p1], new Map(), agora);
    expect(resultado).toEqual([]);
  });
});

describe('localizacaoEfetiva', () => {
  const siglaDoSetor = (id: string) => ({ '1': 'DEM', '2': 'DF/FEBOM' })[id];

  it('usa a localização real quando disponível', () => {
    expect(
      localizacaoEfetiva({ localizacao_atual: 'CBM > DTIC > QCG', fase_atual_id: '1' }, siglaDoSetor),
    ).toBe('CBM > DTIC > QCG');
  });

  it('cai para a sigla do setor fixo quando não há localização real', () => {
    expect(localizacaoEfetiva({ fase_atual_id: '2' }, siglaDoSetor)).toBe('DF/FEBOM');
  });

  it('usa "Desconhecido" como último recurso', () => {
    expect(localizacaoEfetiva({ fase_atual_id: '99' }, siglaDoSetor)).toBe('Desconhecido');
  });
});

describe('agruparEstadasPorProcesso', () => {
  it('agrupa as estadias pelo processo_id', () => {
    const mapa = agruparEstadasPorProcesso([
      estada({ id: 'a', processo_id: 'p1' }),
      estada({ id: 'b', processo_id: 'p2' }),
      estada({ id: 'c', processo_id: 'p1' }),
    ]);
    expect(mapa.get('p1')?.map((e) => e.id)).toEqual(['a', 'c']);
    expect(mapa.get('p2')?.map((e) => e.id)).toEqual(['b']);
  });
});
