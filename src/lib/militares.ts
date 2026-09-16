/**
 * Busca de militares (Cargo/Posto, Nome, MF e UBM) na planilha "Militares
 * e matrícula BM" — usada pra preencher Fiscal Titular/Suplente de um
 * contrato com um buscador, sem deixar de permitir digitação livre pelo
 * Gestor (ver `BuscaMilitarInput`).
 */
import type { LinhaPlanilha } from './csv';
import { celula } from './csv';

export const ID_PLANILHA_MILITARES = '1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg';

/**
 * Mensagem lançada por `login` (AppContext) quando o valor digitado
 * parece uma MF mas não há `matriculas/{mf}` gravada ainda — sinal de
 * "primeiro acesso", não de senha errada. `LoginModal` reconhece esse
 * texto pra decidir se tenta a busca ao vivo na planilha de militares
 * em vez de só mostrar o erro de login.
 */
export const ERRO_MATRICULA_NAO_ENCONTRADA =
  'Matrícula não encontrada. Verifique o número ou entre com seu e-mail.';

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

/** Busca exata por MF — usada na validação de matrícula do "Buscar meu acesso". */
export function buscarMilitarPorMf(militares: Militar[], mf: string): Militar | undefined {
  const alvo = mf.trim().toLowerCase();
  if (!alvo) return undefined;
  return militares.find((m) => m.mf.trim().toLowerCase() === alvo);
}

/**
 * Baixa e interpreta a planilha "Militares e matrícula BM" (pública, sem
 * autenticação) — usada tanto no buscador de Fiscal/Suplente do contrato
 * (`BuscaMilitarInput`) quanto na validação de MF do "Buscar meu acesso"
 * (`LoginModal`, antes mesmo de haver login).
 */
export async function carregarMilitares(): Promise<Militar[]> {
  const resposta = await fetch(
    `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_MILITARES}/gviz/tq?tqx=out:csv`,
  );
  if (!resposta.ok) return [];
  const csv = await resposta.text();
  const Papa = (await import('papaparse')).default;
  const linhas = await new Promise<LinhaPlanilha[]>((resolve) => {
    Papa.parse<LinhaPlanilha>(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => resolve(resultado.data),
    });
  });
  return linhas.map(mapLinhaMilitar).filter((m): m is Militar => m !== null);
}
