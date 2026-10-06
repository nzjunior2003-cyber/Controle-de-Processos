/**
 * Busca que atravessa os módulos: processo (Apoio e Suprimento), procedimento/
 * ata (Contratos e ARP's) e contrato (Gestão/Contratos e ARP's) são o mesmo
 * assunto visto de lados diferentes, ligados pelo PAE (e, no contrato, pela
 * ata de origem). Procurar por qualquer dado de um deles — número do
 * processo, fornecedor, objeto, fiscal, nº do contrato — acha os três.
 */
import type { Contrato, ProcedimentoLicitatorio, Processo } from '../types';

type ProcessoBusca = Pick<
  Processo,
  'numero_processo' | 'objeto' | 'descricao' | 'unidade_demandante' | 'rito_processual' | 'natureza_despesa' | 'fonte' | 'prd' | 'localizacao_atual' | 'andamento' | 'fornecedorArp' | 'orgaoGerenciadorArp'
>;
type ContratoBusca = Pick<
  Contrato,
  'id' | 'pae' | 'numero' | 'objeto' | 'empresa' | 'cnpj' | 'fiscalTitular' | 'fiscalSuplente' | 'portaria' | 'fonteRecurso' | 'arpId' | 'contatoEmail'
>;
type ProcedimentoBusca = Pick<
  ProcedimentoLicitatorio,
  'id' | 'pae' | 'numero' | 'modalidade' | 'objeto' | 'fornecedor' | 'orgaoGerenciador' | 'numeroContrato' | 'prd' | 'fiscal' | 'suplente'
>;

/** Sem acento, em minúsculas — a busca não distingue "Pregão" de "pregao". */
export const normalizarParaBusca = (texto: unknown) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const juntar = (...partes: unknown[]) => partes.map(normalizarParaBusca).filter(Boolean).join(' | ');

/** Todos os termos digitados (separados por espaço) precisam aparecer no texto. */
export function casaBusca(texto: string, busca: string): boolean {
  const termos = normalizarParaBusca(busca).split(/\s+/).filter(Boolean);
  return termos.every((t) => texto.includes(t));
}

const textoProcesso = (p: ProcessoBusca) =>
  juntar(p.numero_processo, p.objeto, p.descricao, p.unidade_demandante, p.rito_processual, p.natureza_despesa, p.fonte, p.prd, p.localizacao_atual, p.andamento, p.fornecedorArp, p.orgaoGerenciadorArp);
const textoContrato = (c: ContratoBusca) =>
  juntar(c.numero, c.empresa, c.cnpj, c.objeto, c.pae, c.fiscalTitular, c.fiscalSuplente, c.portaria, c.fonteRecurso, c.contatoEmail);
const textoProcedimento = (p: ProcedimentoBusca) =>
  juntar(p.modalidade, p.numero, p.pae, p.objeto, p.fornecedor, p.orgaoGerenciador, p.numeroContrato, p.prd, p.fiscal, p.suplente);

export interface Universo {
  processos: ProcessoBusca[];
  contratos: ContratoBusca[];
  procedimentos: ProcedimentoBusca[];
}

/**
 * Monta os índices uma vez (por PAE) e devolve filtros que olham também os
 * registros ligados aos que estão sendo filtrados.
 */
export function criarBuscaVinculada({ processos, contratos, procedimentos }: Universo) {
  const processoPorPae = new Map(processos.map((p) => [p.numero_processo, p]));
  const contratosPorPae = new Map<string, ContratoBusca[]>();
  contratos.forEach((c) => {
    if (c.pae) contratosPorPae.set(c.pae, [...(contratosPorPae.get(c.pae) ?? []), c]);
  });
  const procedimentosPorPae = new Map<string, ProcedimentoBusca[]>();
  procedimentos.forEach((p) => {
    if (p.pae) procedimentosPorPae.set(p.pae, [...(procedimentosPorPae.get(p.pae) ?? []), p]);
  });
  const procedimentoPorId = new Map(procedimentos.map((p) => [p.id, p]));
  const contratosPorAta = new Map<string, ContratoBusca[]>();
  contratos.forEach((c) => {
    if (c.arpId) contratosPorAta.set(c.arpId, [...(contratosPorAta.get(c.arpId) ?? []), c]);
  });

  const cache = new WeakMap<object, string>();
  const memo = (chave: object, calcular: () => string) => {
    const guardado = cache.get(chave);
    if (guardado !== undefined) return guardado;
    const texto = calcular();
    cache.set(chave, texto);
    return texto;
  };

  const textoDoProcesso = (p: ProcessoBusca) =>
    memo(p, () =>
      juntar(
        textoProcesso(p),
        ...(contratosPorPae.get(p.numero_processo) ?? []).map(textoContrato),
        ...(procedimentosPorPae.get(p.numero_processo) ?? []).map(textoProcedimento),
      ),
    );

  const textoDoContrato = (c: ContratoBusca) =>
    memo(c, () => {
      const processo = processoPorPae.get(c.pae);
      const ata = c.arpId ? procedimentoPorId.get(c.arpId) : undefined;
      return juntar(
        textoContrato(c),
        processo ? textoProcesso(processo) : '',
        ...(procedimentosPorPae.get(c.pae) ?? []).map(textoProcedimento),
        ata ? textoProcedimento(ata) : '',
      );
    });

  const textoDoProcedimento = (p: ProcedimentoBusca) =>
    memo(p, () => {
      const processo = processoPorPae.get(p.pae);
      return juntar(
        textoProcedimento(p),
        processo ? textoProcesso(processo) : '',
        ...(contratosPorPae.get(p.pae) ?? []).map(textoContrato),
        ...(contratosPorAta.get(p.id) ?? []).map(textoContrato),
      );
    });

  return {
    processos: <T extends ProcessoBusca>(lista: T[], busca: string): T[] =>
      busca.trim() ? lista.filter((p) => casaBusca(textoDoProcesso(p), busca)) : lista,
    contratos: <T extends ContratoBusca>(lista: T[], busca: string): T[] =>
      busca.trim() ? lista.filter((c) => casaBusca(textoDoContrato(c), busca)) : lista,
    procedimentos: <T extends ProcedimentoBusca>(lista: T[], busca: string): T[] =>
      busca.trim() ? lista.filter((p) => casaBusca(textoDoProcedimento(p), busca)) : lista,
    /** Texto pesquisável de um contrato (para telas que filtram por conta própria, como o Financeiro). */
    textoDoContrato,
  };
}
