/**
 * PAEs acessórios: protocolos abertos à parte para pedir análise a outro órgão
 * do Estado (ligados ao processo) ou para acompanhar fatura, recebimento de
 * objeto e pagamento (ligados ao contrato). O sistema guarda a lista e a
 * publica na aba PAES_ACESSORIOS da planilha; o robô consulta cada PAE e grava
 * lá o setor atual, que o sistema lê de volta.
 */
import type { Contrato, PaeAcessorio, Processo } from '../types';

export const ABA_PAES_ACESSORIOS = 'PAES_ACESSORIOS';

/** Só esta finalidade entra no relatório de mudanças de setor enviado por e-mail. */
export const FINALIDADE_SOLICITACAO_ORGAO = 'Solicitação de análise a outro órgão';

export const FINALIDADES_PROCESSO = [FINALIDADE_SOLICITACAO_ORGAO] as const;
export const FINALIDADES_CONTRATO = ['Fatura', 'Recebimento de objeto', 'Pagamento'] as const;

export type EscopoPae = 'processo' | 'contrato';

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const minusculo = (t: string) => semAcento(t).trim().toLowerCase();

/** O robô só entende PAE no formato AAAA/NNNN (aceita "E-", hífen e espaços). */
const PADRAO_PAE = /(\d{4})\s*[/-]\s*(\d+)/;

export function paeValido(texto: string): boolean {
  return PADRAO_PAE.test(texto);
}

/** "e-2026-2617141" → "E-2026/2617141". Devolve '' se não for um PAE. */
export function normalizarPae(texto: string): string {
  const m = texto.match(PADRAO_PAE);
  return m ? `E-${m[1]}/${m[2]}` : '';
}

/** Chave de comparação (só dígitos): "E-2026/2617141" = "2026-2617141". */
export const chavePae = (texto: string) => normalizarPae(texto).replace(/\D/g, '');

export const ehSolicitacaoOutroOrgao = (finalidade: string) =>
  minusculo(finalidade) === minusculo(FINALIDADE_SOLICITACAO_ORGAO);

export interface NovoPaeAcessorio {
  numero: string;
  finalidade: string;
  observacao?: string;
}

/** Acrescenta um PAE à lista; recusa número inválido, finalidade vazia e PAE repetido (nesta lista ou nas outras informadas). */
export function adicionarPaeAcessorio(
  lista: PaeAcessorio[] | undefined,
  novo: NovoPaeAcessorio,
  agora: Date = new Date(),
  jaExistentes: string[] = [],
): { lista: PaeAcessorio[]; erro?: string } {
  const atual = lista ?? [];
  const numero = normalizarPae(novo.numero);
  const finalidade = novo.finalidade.trim();
  if (!numero) return { lista: atual, erro: 'Informe o PAE no formato 2026/1234567.' };
  if (!finalidade) return { lista: atual, erro: 'Informe a finalidade do PAE.' };
  const chave = chavePae(numero);
  if (atual.some((p) => chavePae(p.numero) === chave) || jaExistentes.some((n) => chavePae(n) === chave)) {
    return { lista: atual, erro: `O PAE ${numero} já está cadastrado.` };
  }
  const observacao = novo.observacao?.trim();
  const pae: PaeAcessorio = {
    id: `${chave}-${agora.getTime()}`,
    numero,
    finalidade,
    ...(observacao ? { observacao } : {}),
    criado_em: agora.toISOString(),
  };
  return { lista: [...atual, pae] };
}

export const removerPaeAcessorio = (lista: PaeAcessorio[] | undefined, id: string) =>
  (lista ?? []).filter((p) => p.id !== id);

/** Linha enviada ao Apps Script (aba PAES_ACESSORIOS) para o robô consultar. */
export interface ItemRastreioPae {
  pae: string;
  escopo: EscopoPae;
  /** Nº do processo (PAE principal) ou do contrato a que o PAE está ligado. */
  referencia: string;
  finalidade: string;
  /** Entra no relatório de mudanças de setor por e-mail? Só as solicitações a outros órgãos. */
  relatorio: boolean;
}

/** Todos os PAEs acessórios do sistema, sem repetição (o mesmo PAE só é consultado uma vez). */
export function montarItensRastreio(
  processos: Pick<Processo, 'numero_processo' | 'paes_acessorios'>[],
  contratos: Pick<Contrato, 'numero' | 'paes_acessorios'>[],
): ItemRastreioPae[] {
  const vistos = new Set<string>();
  const itens: ItemRastreioPae[] = [];
  const incluir = (escopo: EscopoPae, referencia: string, paes?: PaeAcessorio[]) =>
    (paes ?? []).forEach((p) => {
      const chave = chavePae(p.numero);
      if (!chave || vistos.has(chave)) return;
      vistos.add(chave);
      itens.push({ pae: normalizarPae(p.numero), escopo, referencia, finalidade: p.finalidade, relatorio: ehSolicitacaoOutroOrgao(p.finalidade) });
    });
  processos.forEach((p) => incluir('processo', p.numero_processo, p.paes_acessorios));
  contratos.forEach((c) => incluir('contrato', c.numero, c.paes_acessorios));
  return itens;
}

/** O que o robô achou na última consulta de um PAE acessório. */
export interface SituacaoPae {
  setorAtual: string;
  ultimaTramitacao: string;
  situacao: string;
  consultadoEm: string;
}

const CABECALHO_ABA = ['pae', 'escopo', 'referencia', 'finalidade', 'relatorio', 'setor_atual', 'ultima_tramitacao', 'situacao', 'consultado_em'];

/** Lê a aba PAES_ACESSORIOS (CSV já separado em linhas); o Google devolve outra aba quando a pedida não existe, então o cabeçalho tem que conferir. */
export function parseAbaPaesAcessorios(linhas: string[][]): Map<string, SituacaoPae> {
  const resultado = new Map<string, SituacaoPae>();
  const cabecalho = linhas[0];
  if (!cabecalho || CABECALHO_ABA.some((titulo, i) => minusculo(cabecalho[i] ?? '') !== titulo)) return resultado;
  linhas.slice(1).forEach((l) => {
    const chave = chavePae(l[0] ?? '');
    if (!chave) return;
    resultado.set(chave, {
      setorAtual: (l[5] ?? '').trim(),
      ultimaTramitacao: (l[6] ?? '').trim(),
      situacao: (l[7] ?? '').trim(),
      consultadoEm: (l[8] ?? '').trim(),
    });
  });
  return resultado;
}
