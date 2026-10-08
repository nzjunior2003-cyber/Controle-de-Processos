import { describe, expect, it } from 'vitest';
import { haQuantoTempo, parseDataHoraRobo, parseLogRobo, parseVigiasRobo, resumirStatusRobo } from './statusRobo';

const CAB_LOG = ['Data/Hora', 'Máquina', 'Situação', 'Total', 'Sucesso', 'Mudaram de setor', 'Erros/Não encontrados', 'Minutos', 'Motivo'];
const CAB_STATUS = ['Máquina', 'Último sinal', 'Estado'];
const AGORA = new Date('2026-10-07T15:00:00-03:00');

describe('parseDataHoraRobo', () => {
  it('lê data e hora no fuso de Brasília', () => {
    expect(parseDataHoraRobo('07/10/2026 14:30:15')?.toISOString()).toBe('2026-10-07T17:30:15.000Z');
    expect(parseDataHoraRobo('lixo')).toBeNull();
  });
});

describe('parseLogRobo / parseVigiasRobo', () => {
  it('lê as linhas em ordem cronológica', () => {
    const log = parseLogRobo([
      CAB_LOG,
      ['07/10/2026 12:00:00', 'PC', 'CONCLUIDO', '169', '160', '5', '9', '42,5', ''],
      ['06/10/2026 12:00:00', 'NOTE', 'FALHOU', '169', '0', '0', '0', '1', 'login'],
    ]);
    expect(log.map((l) => l.maquina)).toEqual(['NOTE', 'PC']);
    expect(log[1]).toMatchObject({ situacao: 'CONCLUIDO', mudaram: 5, erros: 9, minutos: 42.5 });
  });

  it('ignora a aba errada (o Google devolve outra aba quando a pedida não existe)', () => {
    expect(parseLogRobo([['N° PAE', 'OBJETO'], ['2026/1', 'x']])).toEqual([]);
    expect(parseVigiasRobo([['N° PAE', 'OBJETO']])).toEqual([]);
  });

  it('lê os sinais do vigia', () => {
    const v = parseVigiasRobo([CAB_STATUS, ['PC', '07/10/2026 14:59:00', 'aguardando'], ['', '07/10/2026 14:00:00', 'x']]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ maquina: 'PC', estado: 'AGUARDANDO' });
  });
});

describe('resumirStatusRobo', () => {
  const exec = (situacao: string, quando: string, extra = {}) => ({
    quando: new Date(quando), maquina: 'PC', situacao, total: 10, sucesso: 8, mudaram: 2, erros: 2, minutos: 5, motivo: '', ...extra,
  });
  const vigiaLigado = [{ maquina: 'PC', ultimoSinal: new Date('2026-10-07T14:59:00-03:00'), estado: 'AGUARDANDO' }];

  it('sem registro: desconhecido', () => {
    expect(resumirStatusRobo([], [], AGORA).nivel).toBe('desconhecido');
  });

  it('concluído recente: ok, com o vigia', () => {
    const r = resumirStatusRobo([exec('CONCLUIDO', '2026-10-07T10:00:00-03:00')], vigiaLigado, AGORA);
    expect(r.nivel).toBe('ok');
    expect(r.vigiaLigado).toBe(true);
    expect(r.detalhe).toContain('2 mudaram de setor');
  });

  it('concluído há mais de 36 h: atenção', () => {
    expect(resumirStatusRobo([exec('CONCLUIDO', '2026-10-05T10:00:00-03:00')], [], AGORA).nivel).toBe('atencao');
  });

  it('falhou / interrompido: erro com o motivo', () => {
    const r = resumirStatusRobo([exec('FALHOU', '2026-10-07T12:00:00-03:00', { motivo: 'PAE fora do ar' })], [], AGORA);
    expect(r.nivel).toBe('erro');
    expect(r.detalhe).toContain('PAE fora do ar');
    expect(r.vigiaLigado).toBe(false);
  });

  it('executando: ok se recente, atenção se passou de 3 h sem terminar', () => {
    expect(resumirStatusRobo([exec('EXECUTANDO', '2026-10-07T14:00:00-03:00')], [], AGORA).nivel).toBe('ok');
    expect(resumirStatusRobo([exec('EXECUTANDO', '2026-10-07T09:00:00-03:00')], [], AGORA).nivel).toBe('atencao');
  });

  it('vigia sem sinal há mais de 3 min conta como desligado', () => {
    const velho = [{ maquina: 'PC', ultimoSinal: new Date('2026-10-07T14:50:00-03:00'), estado: 'AGUARDANDO' }];
    expect(resumirStatusRobo([exec('CONCLUIDO', '2026-10-07T10:00:00-03:00')], velho, AGORA).vigiaLigado).toBe(false);
  });
});

describe('haQuantoTempo', () => {
  it('minutos, horas e dias', () => {
    expect(haQuantoTempo(new Date('2026-10-07T14:55:00-03:00'), AGORA)).toBe('há 5 min');
    expect(haQuantoTempo(new Date('2026-10-07T12:00:00-03:00'), AGORA)).toBe('há 3 h');
    expect(haQuantoTempo(new Date('2026-10-02T12:00:00-03:00'), AGORA)).toBe('há 5 dias');
  });
});
