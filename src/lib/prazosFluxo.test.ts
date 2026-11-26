import { describe, expect, it } from 'vitest';
import { DIAS_PADRAO_ETAPA, ETAPAS, MARCOS } from '../config/fluxoCompras';
import {
  calcularPrazos,
  caminhosAteMarco,
  contarEtapasAteMarco,
  diasPorEtapaDoProcesso,
  inicioDaEtapaAtual,
  prazoTotalDoRito,
  textoFaixa,
} from './prazosFluxo';

const respondido = {
  necessitaDotacao: true,
  cbmGerenciadorOuParticipeArp: false,
  parecerJuridicoAprovadoSemRecomendacoes: true,
  haveraFaseExterna: true,
};
const semDotacaoSemExterna = { ...respondido, necessitaDotacao: false, haveraFaseExterna: false };
const contrato = MARCOS.find((m) => m.id === 'contrato')!;
const pagamento = MARCOS.find((m) => m.id === 'pagamento')!;

describe('catálogo de prazos', () => {
  it('todo marco aponta para uma etapa que existe e toda etapa tem dias padrão', () => {
    MARCOS.forEach((m) => expect(ETAPAS.some((e) => e.id === m.etapaId)).toBe(true));
    ETAPAS.forEach((e) => expect(DIAS_PADRAO_ETAPA[e.id]).toBeGreaterThanOrEqual(0));
    expect(MARCOS.map((m) => m.etapaId)).toEqual(['E19', 'E22', 'E27', 'E32']);
  });
});

describe('caminhos e contagem de etapas', () => {
  it('decisões respondidas dão um único caminho; em aberto dão mais de um', () => {
    expect(caminhosAteMarco({ ...respondido, ritoProcessual: 'pregao' }, 'E19')).toHaveLength(1);
    expect(caminhosAteMarco({}, 'E19').length).toBeGreaterThan(1);
  });

  it('sem dotação e sem fase externa o caminho até o contrato é E01–E08, E11–E15, E17, E19', () => {
    const [caminho] = caminhosAteMarco(semDotacaoSemExterna, 'E19');
    expect(caminho).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E11', 'E12', 'E13', 'E14', 'E15', 'E17', 'E19']);
  });

  it('conta restantes e porcentagem até o contrato', () => {
    const c = contarEtapasAteMarco(semDotacaoSemExterna, contrato, 'E07');
    expect(c.total).toEqual({ min: 15, max: 15 });
    expect(c.concluidas).toEqual({ min: 6, max: 6 });
    expect(c.restantes).toEqual({ min: 9, max: 9 });
    expect(c.percentual).toEqual({ min: 40, max: 40 });
    expect(c.incerto).toBe(false);
    expect(c.concluido).toBe(false);
  });

  it('decisão em aberto vira faixa e é marcada como incerta', () => {
    const c = contarEtapasAteMarco({}, contrato, 'E07');
    expect(c.incerto).toBe(true);
    expect(c.total.min).toBeLessThan(c.total.max);
    expect(textoFaixa({ min: 6, max: 8 })).toBe('6 a 8');
    expect(textoFaixa({ min: 6, max: 6 })).toBe('6');
  });

  it('ARP pula jurídico e licitação (caminho mais curto até o contrato)', () => {
    const arp = contarEtapasAteMarco({ ...semDotacaoSemExterna, cbmGerenciadorOuParticipeArp: true }, contrato, 'E07');
    const normal = contarEtapasAteMarco(semDotacaoSemExterna, contrato, 'E07');
    expect(arp.total.max).toBeLessThan(normal.total.max);
  });

  it('marco já passado = concluído; no marco ainda não', () => {
    expect(contarEtapasAteMarco(respondido, contrato, 'E20').concluido).toBe(true);
    expect(contarEtapasAteMarco(respondido, contrato, 'E19').concluido).toBe(false);
  });

  it('etapa opcional (E31) não entra na contagem até o pagamento', () => {
    const [caminho] = caminhosAteMarco(respondido, 'E32');
    expect(caminho).toContain('E31');
    const c = contarEtapasAteMarco(respondido, pagamento, null);
    expect(c.total.max).toBe(caminho.length - 1);
  });

  it('sem etapa atual, nada foi concluído', () => {
    expect(contarEtapasAteMarco(respondido, contrato, null).concluidas).toEqual({ min: 0, max: 0 });
  });
});

describe('dias por etapa', () => {
  it('a soma de E01 até E19 bate com o prazo total do rito (pregão = 120 dias)', () => {
    const p = { ...respondido, ritoProcessual: 'pregao' as const };
    expect(prazoTotalDoRito(p)).toBe(120);
    const dias = diasPorEtapaDoProcesso(p);
    const [caminho] = caminhosAteMarco(p, 'E19');
    expect(Math.round(caminho.reduce((a, id) => a + dias[id], 0))).toBe(120);
  });

  it('sem prazo total para o rito (concorrência) valem os dias de referência', () => {
    const p = { ...respondido, ritoProcessual: 'concorrencia' as const };
    expect(prazoTotalDoRito(p)).toBeNull();
    expect(diasPorEtapaDoProcesso(p).E07).toBe(DIAS_PADRAO_ETAPA.E07);
  });

  it('DAL/Master podem trocar o prazo total do rito e os dias de uma etapa', () => {
    const p = { ...respondido, ritoProcessual: 'pregao' as const };
    expect(prazoTotalDoRito(p, { prazoAteContratoPorRito: { pregao: 90 } })).toBe(90);
    expect(diasPorEtapaDoProcesso(p, { diasPorEtapa: { E20: 10 } }).E20).toBe(10);
  });

  it('etapas depois do contrato têm dias fixos e as opcionais valem 0', () => {
    const dias = diasPorEtapaDoProcesso({ ...respondido, ritoProcessual: 'pregao' });
    expect(dias.E32).toBe(DIAS_PADRAO_ETAPA.E32);
    expect(dias.E31).toBe(0);
  });

  it('usa o prazo do rito antigo quando o processo só tem o texto antigo', () => {
    expect(prazoTotalDoRito({ rito_processual: 'Dispensa por valor' })).toBe(30);
  });
});

describe('datas e situação do prazo', () => {
  const base = {
    ...respondido,
    ritoProcessual: 'pregao' as const,
    data_entrada: '2026-01-01T00:00:00Z',
    etapaAtualId: 'E07',
    etapaOrigem: 'manual' as const,
    etapaConfirmadaPor: 'u1',
  };
  const cont = (r: ReturnType<typeof calcularPrazos>) => r.marcos.find((m) => m.marco.id === 'contrato')!;

  it('prazo do contrato = abertura + 120 dias', () => {
    const r = calcularPrazos({ ...base, etapaConfirmadaEm: '2026-01-05T00:00:00Z' }, [], undefined, new Date('2026-01-06T00:00:00Z'));
    expect(cont(r).prazo?.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect(r.prazoTotalRito).toBe(120);
  });

  it('no prazo: começou a etapa cedo e ainda tem folga', () => {
    const r = calcularPrazos({ ...base, etapaConfirmadaEm: '2026-01-05T00:00:00Z' }, [], undefined, new Date('2026-01-06T00:00:00Z'));
    expect(cont(r).situacao).toBe('no_prazo');
    expect(r.principal).toBe('no_prazo');
  });

  it('atenção: folga de poucos dias', () => {
    const r = calcularPrazos({ ...base, etapaConfirmadaEm: '2026-01-10T00:00:00Z' }, [], undefined, new Date('2026-01-10T00:00:00Z'));
    expect(['atencao', 'atrasado']).toContain(cont(r).situacao);
    const folga = Math.floor((cont(r).prazo!.getTime() - cont(r).previsao!.getTime()) / 86_400_000);
    expect(folga).toBeLessThanOrEqual(5);
  });

  it('atrasado: etapa atual parada há meses', () => {
    const r = calcularPrazos({ ...base, etapaConfirmadaEm: '2026-01-10T00:00:00Z' }, [], undefined, new Date('2026-08-01T00:00:00Z'));
    expect(cont(r).situacao).toBe('atrasado');
    expect(cont(r).diasAtraso).toBeGreaterThan(0);
    expect(r.etapaAtual?.situacao).toBe('atrasado');
    expect(r.principal).toBe('atrasado');
  });

  it('etapa atual: dias na etapa e meta', () => {
    const r = calcularPrazos({ ...base, etapaConfirmadaEm: '2026-01-10T00:00:00Z' }, [], undefined, new Date('2026-01-15T00:00:00Z'));
    expect(r.etapaAtual).toMatchObject({ etapaId: 'E07', diasNaEtapa: 5 });
    expect(r.etapaAtual!.metaDias).toBeGreaterThan(0);
  });

  it('sem data de abertura: situação "sem_data", sem quebrar', () => {
    const r = calcularPrazos({ ...base, data_entrada: undefined }, [], undefined, new Date('2026-02-01T00:00:00Z'));
    expect(cont(r).situacao).toBe('sem_data');
    expect(cont(r).prazo).toBeNull();
    expect(cont(r).contagem.restantes.max).toBeGreaterThan(0);
  });

  it('marcos já atingidos ficam concluídos e o principal passa para o próximo', () => {
    const r = calcularPrazos({ ...base, etapaAtualId: 'E24', etapaConfirmadaEm: '2026-06-01T00:00:00Z' }, [], undefined, new Date('2026-06-02T00:00:00Z'));
    expect(r.marcos.find((m) => m.marco.id === 'contrato')?.situacao).toBe('concluido');
    expect(r.marcos.find((m) => m.marco.id === 'empenho')?.situacao).toBe('concluido');
    expect(r.principal).not.toBe('concluido');
  });

  it('tudo concluído quando está em E35', () => {
    expect(calcularPrazos({ ...base, etapaAtualId: 'E35' }, [], undefined, new Date('2026-12-01T00:00:00Z')).principal).toBe('concluido');
  });

  it('processo sem rito não quebra e não tem prazo total', () => {
    const r = calcularPrazos({ data_entrada: '2026-01-01T00:00:00Z' }, [], undefined, new Date('2026-01-10T00:00:00Z'));
    expect(r.prazoTotalRito).toBeNull();
    expect(r.marcos).toHaveLength(4);
  });

  it('início da etapa atual: confirmação, depois tramitação em curso, depois última tramitação, depois abertura', () => {
    const abertura = new Date('2026-01-01T00:00:00Z');
    expect(inicioDaEtapaAtual({ etapaAtualId: 'E07', etapaConfirmadaEm: '2026-03-01T00:00:00Z' }, [], abertura)?.toISOString().slice(0, 10)).toBe('2026-03-01');
    expect(inicioDaEtapaAtual({}, [{ localizacao: 'X', data_inicio: '2026-02-01T00:00:00Z', data_fim: null }], abertura)?.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(inicioDaEtapaAtual({ ultima_tramitacao: '2026-01-20T00:00:00Z' }, [], abertura)?.toISOString().slice(0, 10)).toBe('2026-01-20');
    expect(inicioDaEtapaAtual({}, [], abertura)).toBe(abertura);
  });
});
