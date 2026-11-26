import { describe, expect, it } from 'vitest';
import {
  diasDaPassagem,
  historicoEfetivo,
  linhaDoTempo,
  medianaPorEtapa,
  passagemEmAndamento,
  registrarEtapa,
  validarChegada,
  type PassagemEtapa,
} from './historicoEtapas';

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const agora = d('2026-12-01');

describe('registrar etapas', () => {
  it('primeira confirmação abre uma passagem', () => {
    const h = registrarEtapa([], 'E07', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ etapaId: 'E07', por: 'u1', origem: 'auto' });
    expect(h[0].fim).toBeUndefined();
  });

  it('avançar fecha a etapa em andamento na data de chegada da próxima', () => {
    const h1 = registrarEtapa([], 'E07', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora);
    const h2 = registrarEtapa(h1, 'E08', 'avancar', d('2026-11-20'), 'u1', 'manual', agora);
    expect(h2).toHaveLength(2);
    expect(h2[0].fim).toBe(d('2026-11-20').toISOString());
    expect(h2[1]).toMatchObject({ etapaId: 'E08', origem: 'manual' });
    expect(passagemEmAndamento(h2)?.etapaId).toBe('E08');
    expect(h1[0].fim).toBeUndefined(); // não altera o original
  });

  it('corrigir substitui a passagem em andamento (não conta como etapa percorrida)', () => {
    const h1 = registrarEtapa([], 'E07', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora);
    const h2 = registrarEtapa(h1, 'E12', 'corrigir', d('2026-11-12'), 'u1', 'manual', agora);
    expect(h2).toHaveLength(1);
    expect(h2[0].etapaId).toBe('E12');
  });

  it('corrigir mantém as passagens anteriores já fechadas', () => {
    let h = registrarEtapa([], 'E07', 'confirmar', d('2026-11-01'), 'u1', 'auto', agora);
    h = registrarEtapa(h, 'E08', 'avancar', d('2026-11-10'), 'u1', 'auto', agora);
    h = registrarEtapa(h, 'E11', 'corrigir', d('2026-11-11'), 'u1', 'manual', agora);
    expect(h.map((p) => p.etapaId)).toEqual(['E07', 'E11']);
    expect(h[0].fim).toBeDefined();
  });

  it('reconfirmar a mesma etapa não muda nada', () => {
    const h1 = registrarEtapa([], 'E07', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora);
    expect(registrarEtapa(h1, 'E07', 'confirmar', d('2026-11-15'), 'u1', 'auto', agora)).toEqual(h1);
  });

  it('etapa que se repete (volta ao CONJUR) vira outra passagem', () => {
    let h = registrarEtapa([], 'E14', 'confirmar', d('2026-10-01'), 'u1', 'auto', agora);
    h = registrarEtapa(h, 'E16', 'avancar', d('2026-10-10'), 'u1', 'auto', agora);
    h = registrarEtapa(h, 'E14', 'avancar', d('2026-10-20'), 'u1', 'manual', agora);
    expect(h.filter((p) => p.etapaId === 'E14')).toHaveLength(2);
  });

  it('recusa etapa inexistente', () => {
    expect(() => registrarEtapa([], 'E99', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora)).toThrow();
  });
});

describe('datas de chegada', () => {
  it('não aceita data futura nem inválida', () => {
    expect(() => validarChegada(d('2026-12-10'), [], 'confirmar', agora)).toThrow(/futuro/);
    expect(() => validarChegada(new Date('x'), [], 'confirmar', agora)).toThrow(/inválida/);
  });
  it('não aceita chegada anterior ao início da etapa anterior', () => {
    const h = registrarEtapa([], 'E07', 'confirmar', d('2026-11-10'), 'u1', 'auto', agora);
    expect(() => validarChegada(d('2026-11-05'), h, 'avancar', agora)).toThrow(/anterior/);
    expect(() => validarChegada(d('2026-11-10'), h, 'avancar', agora)).not.toThrow();
  });
  it('ao corrigir, o limite é o fim da passagem anterior (não o início da que será substituída)', () => {
    let h = registrarEtapa([], 'E07', 'confirmar', d('2026-11-01'), 'u1', 'auto', agora);
    h = registrarEtapa(h, 'E08', 'avancar', d('2026-11-10'), 'u1', 'auto', agora);
    expect(() => validarChegada(d('2026-11-10'), h, 'corrigir', agora)).not.toThrow();
    expect(() => validarChegada(d('2026-11-12'), h, 'corrigir', agora)).not.toThrow();
    expect(() => validarChegada(d('2026-11-05'), h, 'corrigir', agora)).toThrow();
  });
});
});

describe('histórico efetivo e linha do tempo', () => {
  it('processo confirmado antes da Fase D vira uma passagem em andamento, sem gravar', () => {
    const h = historicoEfetivo({ etapaAtualId: 'E07', etapaConfirmadaEm: '2026-11-10T12:00:00Z', etapaConfirmadaPor: 'u1', etapaOrigem: 'auto' });
    expect(h).toEqual([{ etapaId: 'E07', inicio: '2026-11-10T12:00:00Z', por: 'u1', origem: 'auto' }]);
  });
  it('sem nada confirmado, o histórico é vazio; entradas inválidas são ignoradas', () => {
    expect(historicoEfetivo({})).toEqual([]);
    expect(historicoEfetivo({ historicoEtapas: [{ etapaId: 'E99', inicio: '2026-01-01' }, { etapaId: 'E07', inicio: 'x' }] })).toEqual([]);
  });
  it('linha do tempo traz dias e marca a etapa em andamento', () => {
    const historicoEtapas: PassagemEtapa[] = [
      { etapaId: 'E07', inicio: d('2026-11-01').toISOString(), fim: d('2026-11-16').toISOString() },
      { etapaId: 'E08', inicio: d('2026-11-16').toISOString() },
    ];
    const linha = linhaDoTempo({ historicoEtapas }, agora);
    expect(linha[0]).toMatchObject({ etapaId: 'E07', dias: 15, emAndamento: false });
    expect(linha[1]).toMatchObject({ etapaId: 'E08', dias: 15, emAndamento: true });
    expect(diasDaPassagem(historicoEtapas[0])).toBe(15);
  });
});

describe('mediana por etapa', () => {
  const proc = (dias: number): { historicoEtapas: PassagemEtapa[] } => ({
    historicoEtapas: [{ etapaId: 'E07', inicio: d('2026-01-01').toISOString(), fim: new Date(d('2026-01-01').getTime() + dias * 86_400_000).toISOString() }],
  });

  it('usa a mediana e conta os casos; abaixo do mínimo = poucos dados', () => {
    const m = medianaPorEtapa([proc(10), proc(20), proc(30)]);
    expect(m.get('E07')).toMatchObject({ mediana: 20, casos: 3, suficiente: false });
  });
  it('com casos suficientes, marca como suficiente (mediana de quantidade par = média dos dois do meio)', () => {
    const m = medianaPorEtapa([proc(10), proc(12), proc(14), proc(100), proc(16), proc(18)]);
    expect(m.get('E07')).toMatchObject({ casos: 6, suficiente: true, mediana: 15 });
  });
  it('um caso extremo não distorce (mediana, não média)', () => {
    const m = medianaPorEtapa([proc(10), proc(11), proc(12), proc(13), proc(400)]);
    expect(m.get('E07')?.mediana).toBe(12);
  });
  it('só conta passagens fechadas', () => {
    const aberta = { historicoEtapas: [{ etapaId: 'E07', inicio: d('2026-01-01').toISOString() }] };
    expect(medianaPorEtapa([aberta]).size).toBe(0);
  });
  it('etapas sem dados não aparecem', () => {
    expect(medianaPorEtapa([]).size).toBe(0);
  });
  it('o mínimo de casos pode ser ajustado', () => {
    expect(medianaPorEtapa([proc(10), proc(20)], 2).get('E07')?.suficiente).toBe(true);
  });
});
