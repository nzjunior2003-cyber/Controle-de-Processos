import { describe, expect, it } from 'vitest';
import { ehPerfilDiretoria, PERFIL_LABELS, PERFIS_DIRETORIA, type Perfil } from '../types';

describe('ehPerfilDiretoria', () => {
  it('reconhece DGA, DAL, DF, DCA e BM4', () => {
    (['dga', 'dal', 'df', 'dca', 'bm4'] as Perfil[]).forEach((perfil) => {
      expect(ehPerfilDiretoria(perfil)).toBe(true);
    });
  });

  it('não inclui master nem os perfis donos de módulo', () => {
    (['master', 'apoio', 'contratos', 'gestao', 'fiscal', 'financeiro', 'demandante'] as Perfil[]).forEach(
      (perfil) => {
        expect(ehPerfilDiretoria(perfil)).toBe(false);
      },
    );
  });

  it('devolve false para perfil ausente', () => {
    expect(ehPerfilDiretoria(undefined)).toBe(false);
  });

  it('todo perfil da diretoria tem rótulo cadastrado', () => {
    PERFIS_DIRETORIA.forEach((perfil) => {
      expect(PERFIL_LABELS[perfil]).toBeTruthy();
    });
  });
});
