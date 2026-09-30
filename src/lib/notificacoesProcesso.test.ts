import { describe, expect, it } from 'vitest';
import { destinatariosEventoProcesso, montarNotificacao } from './notificacoesProcesso';
import type { Processo, Usuario } from '../types';

const usuario = (overrides: Partial<Usuario>): Usuario => ({
  id: 'u1',
  nome: 'Fulano',
  email: 'fulano@cbmpa.pa.gov.br',
  setor_id: '1',
  perfil: 'demandante',
  ativo: true,
  ...overrides,
});

const processo: Pick<Processo, 'unidade_demandante'> = { unidade_demandante: 'DGCEP' };

describe('destinatariosEventoProcesso', () => {
  it('mudanca_setor: inclui demandantes do setor e toda a equipe de apoio/master', () => {
    const usuarios: Usuario[] = [
      usuario({ id: 'd1', perfil: 'demandante', unidadeDemandante: 'DGCEP' }),
      usuario({ id: 'd2', perfil: 'demandante', unidadeDemandante: 'CEINT' }),
      usuario({ id: 'a1', perfil: 'apoio' }),
      usuario({ id: 'a2', perfil: 'apoio', ativo: false }),
      usuario({ id: 'm1', perfil: 'master' }),
      usuario({ id: 'f1', perfil: 'fiscal' }),
    ];
    const destinatarios = destinatariosEventoProcesso('mudanca_setor', processo, usuarios);
    const ids = destinatarios.map((u) => u.id).sort();
    expect(ids).toEqual(['a1', 'd1', 'm1']);
  });

  it('mudanca_fase e conclusao: só demandantes ativos do setor', () => {
    const usuarios: Usuario[] = [
      usuario({ id: 'd1', perfil: 'demandante', unidadeDemandante: 'DGCEP' }),
      usuario({ id: 'd2', perfil: 'demandante', unidadeDemandante: 'DGCEP', ativo: false }),
      usuario({ id: 'd3', perfil: 'demandante', unidadeDemandante: 'CEINT' }),
      usuario({ id: 'a1', perfil: 'apoio' }),
    ];
    expect(destinatariosEventoProcesso('mudanca_fase', processo, usuarios).map((u) => u.id)).toEqual(['d1']);
    expect(destinatariosEventoProcesso('conclusao', processo, usuarios).map((u) => u.id)).toEqual(['d1']);
  });

  it('devolve lista vazia quando não há usuário correspondente', () => {
    const usuarios: Usuario[] = [usuario({ id: 'd1', perfil: 'demandante', unidadeDemandante: 'CEINT' })];
    expect(destinatariosEventoProcesso('mudanca_fase', processo, usuarios)).toEqual([]);
  });
});

describe('montarNotificacao', () => {
  const processoCompleto: Pick<Processo, 'id' | 'numero_processo' | 'objeto' | 'localizacao_atual'> = {
    id: 'p1',
    numero_processo: 'E-2026/123456',
    objeto: 'Aquisição de viaturas',
    localizacao_atual: 'CONJUR',
  };

  it('monta título/corpo/url por tipo de evento', () => {
    const notificacao = montarNotificacao('mudanca_setor', processoCompleto, 'u1');
    expect(notificacao.destinatarioId).toBe('u1');
    expect(notificacao.tipo).toBe('mudanca_setor');
    expect(notificacao.titulo).toContain('E-2026/123456');
    expect(notificacao.corpo).toContain('CONJUR');
    expect(notificacao.url).toBe('/sistema/processos/p1');
    expect(notificacao.lida).toBe(false);
  });

  it('monta corpo de conclusão sem mencionar localização', () => {
    const notificacao = montarNotificacao('conclusao', processoCompleto, 'u1');
    expect(notificacao.corpo).toContain('concluído');
  });
});
