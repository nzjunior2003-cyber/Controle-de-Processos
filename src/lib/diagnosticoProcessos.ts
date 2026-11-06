/**
 * Diagnóstico (só leitura) dos processos do sistema contra a planilha de
 * controle: quantos têm linha correspondente, quais estão em duplicidade
 * (mesmo PAE, vários registros) e quais não têm mais linha na planilha.
 * A sincronização só cria e atualiza — nunca apaga —, então registros
 * criados em duplicidade ou cuja linha saiu da planilha ficam no banco.
 */
import type { Processo } from '../types';
import { chavesPae } from './ordemProcesso';

export interface LinhaDaPlanilha {
  numero_processo: string;
  paes_vinculados?: string[];
}

export interface DocDiagnostico {
  id: string;
  numero_processo: string;
  objeto: string;
  criado_em: string;
  ordem?: number;
  /** Quanto o registro tem de dado "de verdade" (checklist, dotação, PAEs acessórios...) — o mais completo é o sugerido para ficar. */
  pontos: number;
  motivos: string[];
}

export interface GrupoDuplicado {
  chave: string;
  docs: DocDiagnostico[];
  /** Id do registro sugerido para ficar (o mais completo; empate: o mais antigo). */
  manter: string;
}

export interface Diagnostico {
  totalApp: number;
  linhasPlanilha: number;
  /** Registros do app com linha correspondente na planilha. */
  casados: number;
  duplicados: GrupoDuplicado[];
  /** Registros a mais por causa das duplicidades (soma de tamanho-1 de cada grupo). */
  excedenteDuplicado: number;
  /** Registros sem linha correspondente na planilha. */
  orfaos: DocDiagnostico[];
  /** Registros criados por dia (mais antigo primeiro) — rajadas num mesmo dia indicam sincronização repetida. */
  porDia: { dia: string; quantidade: number }[];
}

type ProcessoParaDiagnostico = Pick<
  Processo,
  'id' | 'numero_processo' | 'objeto' | 'criado_em' | 'ordem' | 'checklist_rito' | 'dotacoes_orcamentarias' | 'paes_acessorios' | 'prd' | 'andamento_editado_em'
>;

function avaliar(p: ProcessoParaDiagnostico): DocDiagnostico {
  const motivos: string[] = [];
  let pontos = 0;
  const marcar = (condicao: boolean, valor: number, texto: string) => {
    if (!condicao) return;
    pontos += valor;
    motivos.push(texto);
  };
  marcar((p.checklist_rito?.length ?? 0) > 0, p.checklist_rito?.length ?? 0, `checklist (${p.checklist_rito?.length ?? 0})`);
  marcar((p.dotacoes_orcamentarias?.length ?? 0) > 0, 5, 'dotação');
  marcar((p.paes_acessorios?.length ?? 0) > 0, 5, 'PAEs acessórios');
  marcar(!!p.prd, 5, 'PRD');
  marcar(!!p.andamento_editado_em, 3, 'andamento editado no sistema');
  return {
    id: p.id,
    numero_processo: p.numero_processo,
    objeto: p.objeto ?? '',
    criado_em: p.criado_em ?? '',
    ordem: p.ordem,
    pontos,
    motivos,
  };
}

/** Chave do processo: o primeiro PAE "AAAA/NNNN" do número (ou o próprio texto, sem espaços, se não houver). */
const chaveDoProcesso = (numero: string) => chavesPae(numero)[0] ?? numero.trim().toUpperCase();

export function diagnosticarProcessos(processos: ProcessoParaDiagnostico[], linhas: LinhaDaPlanilha[]): Diagnostico {
  const chavesDaPlanilha = new Set<string>();
  const textosDaPlanilha = new Set<string>();
  linhas.forEach((l) => {
    chavesPae(l.numero_processo).forEach((c) => chavesDaPlanilha.add(c));
    (l.paes_vinculados ?? []).forEach((c) => chavesDaPlanilha.add(c));
    textosDaPlanilha.add(l.numero_processo.trim().toUpperCase());
  });

  const avaliados = processos.map((p) => ({ p, d: avaliar(p) }));

  const orfaos = avaliados
    .filter(({ p }) => {
      const chaves = chavesPae(p.numero_processo);
      return chaves.length > 0
        ? !chaves.some((c) => chavesDaPlanilha.has(c))
        : !textosDaPlanilha.has(p.numero_processo.trim().toUpperCase());
    })
    .map(({ d }) => d);

  const grupos = new Map<string, DocDiagnostico[]>();
  avaliados.forEach(({ p, d }) => {
    const chave = chaveDoProcesso(p.numero_processo);
    grupos.set(chave, [...(grupos.get(chave) ?? []), d]);
  });
  const duplicados: GrupoDuplicado[] = [...grupos.entries()]
    .filter(([, docs]) => docs.length > 1)
    .map(([chave, docs]) => {
      const ordenados = [...docs].sort((a, b) => b.pontos - a.pontos || a.criado_em.localeCompare(b.criado_em));
      return { chave, docs: ordenados, manter: ordenados[0].id };
    })
    .sort((a, b) => b.docs.length - a.docs.length || a.chave.localeCompare(b.chave));

  const porDiaMapa = new Map<string, number>();
  processos.forEach((p) => {
    const dia = (p.criado_em ?? '').slice(0, 10) || 'sem data';
    porDiaMapa.set(dia, (porDiaMapa.get(dia) ?? 0) + 1);
  });

  return {
    totalApp: processos.length,
    linhasPlanilha: linhas.length,
    casados: processos.length - orfaos.length,
    duplicados,
    excedenteDuplicado: duplicados.reduce((soma, g) => soma + g.docs.length - 1, 0),
    orfaos,
    porDia: [...porDiaMapa.entries()].map(([dia, quantidade]) => ({ dia, quantidade })).sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

export interface VinculosParaLimpeza {
  /** PAEs (texto) dos contratos e dos procedimentos/atas do sistema — um processo ligado a eles não é apagado. */
  paesVinculados: string[];
}

export interface PlanoDeLimpeza {
  /** Sem linha na planilha, sem dados próprios e sem vínculo: podem ser excluídos (com confirmação). */
  excluiveis: DocDiagnostico[];
  /** Sem linha na planilha, mas com dados ou vínculo: ficam para revisão manual. */
  revisar: DocDiagnostico[];
}

/** Separa os registros sem linha na planilha entre os que podem ser excluídos com segurança e os que pedem revisão. */
export function planoDeLimpeza(
  orfaos: DocDiagnostico[],
  statusPorId: Map<string, string | undefined>,
  vinculos: VinculosParaLimpeza,
): PlanoDeLimpeza {
  const chavesVinculadas = new Set(vinculos.paesVinculados.flatMap((t) => chavesPae(t)));
  const excluiveis: DocDiagnostico[] = [];
  const revisar: DocDiagnostico[] = [];
  orfaos.forEach((d) => {
    const vinculado = chavesPae(d.numero_processo).some((c) => chavesVinculadas.has(c));
    const contratado = statusPorId.get(d.id) === 'contratado_aditivado';
    (d.pontos === 0 && !vinculado && !contratado ? excluiveis : revisar).push(d);
  });
  return { excluiveis, revisar };
}
