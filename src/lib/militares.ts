/**
 * Busca de militares (Cargo/Posto, Nome, MF e UBM) na planilha "Militares
 * e matrícula BM" — usada pra preencher Fiscal Titular/Suplente de um
 * contrato com um buscador, sem deixar de permitir digitação livre pelo
 * Gestor (ver `BuscaMilitarInput`).
 */
import type { LinhaPlanilha } from './csv';
import { celula } from './csv';

export const ID_PLANILHA_MILITARES = '1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg';

export interface Militar {
  cargo: string;
  nome: string;
  mf: string;
  ubm: string;
}

/** Mapeia uma linha (com cabeçalho) da planilha de militares. Devolve null quando não há nome (linha em branco/título de seção). */
export function mapLinhaMilitar(linha: LinhaPlanilha): Militar | null {
  const nome = celula(linha, 'NOME');
  if (!nome) return null;
  return {
    cargo: celula(linha, 'CARGO'),
    nome,
    mf: celula(linha, 'MF'),
    ubm: celula(linha, 'UBM'),
  };
}

/** "Cargo Nome" — o mesmo padrão de nomenclatura militar já usado nos contratos (ex.: "1º TEN QOABM JOELMIR"). */
export function formatarNomeMilitar(militar: Pick<Militar, 'cargo' | 'nome'>): string {
  return [militar.cargo, militar.nome].filter(Boolean).join(' ').trim();
}

/** Busca por substring em cargo, nome, MF ou UBM — usada pelas sugestões do buscador. */
export function buscarMilitares(militares: Militar[], termo: string, limite = 8): Militar[] {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return [];
  return militares
    .filter(
      (m) =>
        m.nome.toLowerCase().includes(alvo) ||
        m.cargo.toLowerCase().includes(alvo) ||
        m.mf.toLowerCase().includes(alvo) ||
        m.ubm.toLowerCase().includes(alvo),
    )
    .slice(0, limite);
}
