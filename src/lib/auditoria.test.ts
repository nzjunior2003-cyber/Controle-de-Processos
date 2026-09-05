import { describe, expect, it } from 'vitest';
import { resumirAuditoria } from './auditoria';

describe('resumirAuditoria', () => {
  it('lista os campos informados na criação', () => {
    const resumo = resumirAuditoria('CREATE', { numero: '015/2026', empresa: 'ACME LTDA' });
    expect(resumo).toBe('Campos informados: numero, empresa');
  });

  it('indica quando nenhum campo foi informado na criação', () => {
    expect(resumirAuditoria('CREATE', {})).toBe('Nenhum campo informado');
  });

  it('sempre indica remoção simples no DELETE, independente dos dados', () => {
    expect(resumirAuditoria('DELETE', {}, { numero: '015/2026' })).toBe('Documento removido');
  });

  it('compara antes/depois no UPDATE e mostra só os campos alterados', () => {
    const resumo = resumirAuditoria(
      'UPDATE',
      { empresa: 'NOVA EMPRESA LTDA', valorGlobal: 2000 },
      { empresa: 'ACME LTDA', valorGlobal: 2000, pae: '2020/1' },
    );
    expect(resumo).toBe('empresa: ACME LTDA -> NOVA EMPRESA LTDA');
  });

  it('indica quando nenhuma alteração foi detectada no UPDATE', () => {
    const resumo = resumirAuditoria('UPDATE', { empresa: 'ACME LTDA' }, { empresa: 'ACME LTDA' });
    expect(resumo).toBe('Nenhuma alteração detectada');
  });

  it('sem "anterior", cai para listar os campos enviados no UPDATE', () => {
    const resumo = resumirAuditoria('UPDATE', { ativo: false, perfil: 'gestao' });
    expect(resumo).toBe('Campos informados: ativo, perfil');
  });

  it('ignora campos de ruído (id, criado_em, atualizado_em, senha)', () => {
    const resumo = resumirAuditoria('CREATE', {
      id: 'x1',
      criado_em: '2026-01-01',
      atualizado_em: '2026-01-01',
      senha: '123456',
      numero: '015/2026',
    });
    expect(resumo).toBe('Campos informados: numero');
  });

  it('trata valores ausentes/vazios como "—" no diff', () => {
    const resumo = resumirAuditoria('UPDATE', { cargo: 'Fiscal' }, { cargo: '' });
    expect(resumo).toBe('cargo: — -> Fiscal');
  });
});
