/**
 * ARPs e atas (adesão, gerenciadas por nós e as que somos partícipes): quanto
 * foi registrado, quanto os contratos derivados já consumiram e quanto sobra
 * pra compras futuras.
 */
import { parseCurrencyBR } from './csv';
import type { ArpUtilizada, Contrato, ItemUtilizadoArp, ProcedimentoLicitatorio, Processo } from '../types';
import { chavesPae } from './ordemProcesso';

/** Procedimento que é uma ata de registro de preços (adesão, partícipe, gerenciador ou SRP). */
export function ehProcedimentoArp(proc: Pick<ProcedimentoLicitatorio, 'modalidade' | 'registroPrecos'>): boolean {
  const modalidade = (proc.modalidade ?? '').toLowerCase();
  return (
    !!proc.registroPrecos ||
    modalidade.includes('adesão') ||
    modalidade.includes('adesao') ||
    modalidade.includes('partícipe') ||
    modalidade.includes('participe') ||
    modalidade.includes('gerenciador') ||
    modalidade.includes('registro de pre')
  );
}

/** Valor registrado na ata: o valor homologado informado; sem ele, a soma de quantidade × valor dos itens. */
export function valorRegistradoDaArp(
  proc: Pick<ProcedimentoLicitatorio, 'valorHomologado' | 'itens'>,
): number {
  const informado = proc.valorHomologado ? parseCurrencyBR(proc.valorHomologado) : 0;
  if (informado > 0) return informado;
  return (proc.itens ?? []).reduce((acc, item) => {
    const valor = item.valorHomologado ? parseCurrencyBR(item.valorHomologado) : 0;
    const quantidade = Number(String(item.quantidade).replace(',', '.')) || 1;
    return acc + valor * quantidade;
  }, 0);
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Item da ata com quantidade e valor unitário já em número. */
export interface ItemDaArp {
  idx: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

/** Itens cadastrados na ata (ata de serviço, só com valor total, não tem). */
export function itensDaArp(ata: Pick<ProcedimentoLicitatorio, 'itens'>): ItemDaArp[] {
  return (ata.itens ?? [])
    .map((item, idx) => ({
      idx,
      descricao: (item.descricao ?? '').trim(),
      quantidade: Number(String(item.quantidade).replace(',', '.')) || 0,
      valorUnitario: item.valorHomologado ? parseCurrencyBR(item.valorHomologado) : 0,
    }))
    .filter((item) => item.descricao);
}

/** Posição do item usado na lista de itens da ata: pelo índice (se a descrição bate) ou pela descrição. */
function acharItemDaArp(itens: ItemDaArp[], uso: ItemUtilizadoArp): ItemDaArp | undefined {
  const porIndice = itens.find((item) => item.idx === uso.idx);
  if (porIndice && semAcento(porIndice.descricao) === semAcento(uso.descricao)) return porIndice;
  return itens.find((item) => semAcento(item.descricao) === semAcento(uso.descricao));
}

/** Valor que o processo declarou usar da ata: itens (quantidade × valor unitário) ou o valor informado. */
export function valorUtilizadoNaArp(uso: Pick<ArpUtilizada, 'valor' | 'itens'>): number {
  const itens = uso.itens ?? [];
  if (itens.length > 0) return arredondar(itens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0));
  return uso.valor ?? 0;
}

export interface ConsumoDeProcesso {
  processoId: string;
  pae: string;
  objeto: string;
  valor: number;
  itens: ItemUtilizadoArp[];
  /** Contrato do processo (mesmo PAE). `vinculadoAAta`: o contrato já está ligado a esta ata (aí vale o valor dele). */
  contrato?: { id: string; numero: string; empresa: string; valorGlobal: number; vinculadoAAta: boolean };
  /** Contrato menos processo, quando o contrato ligado à ata não tem o mesmo valor que o processo indicou. */
  divergencia?: number;
}

type ProcessoParaConsumo = Pick<Processo, 'id' | 'numero_processo' | 'objeto' | 'arpUtilizada'>;
type ContratoParaConsumo = Pick<Contrato, 'id' | 'numero' | 'empresa' | 'valorGlobal' | 'arpId'> & { pae?: string };

/** Processos que declararam usar a ata, cada um com o contrato dele (se já existir) e se o valor do contrato confere. */
export function consumosDeProcessos(
  ata: Pick<ProcedimentoLicitatorio, 'id'>,
  processos: ProcessoParaConsumo[],
  contratos: ContratoParaConsumo[],
): ConsumoDeProcesso[] {
  return processos
    .filter((p) => p.arpUtilizada?.arpId === ata.id)
    .map((p) => {
      const uso = p.arpUtilizada as ArpUtilizada;
      const valor = valorUtilizadoNaArp(uso);
      const chave = chavesPae(p.numero_processo)[0];
      const doProcesso = chave ? contratos.filter((c) => chavesPae(c.pae)[0] === chave) : [];
      const contrato = doProcesso.find((c) => c.arpId === ata.id) ?? doProcesso[0];
      const vinculado = !!contrato && contrato.arpId === ata.id;
      const diferenca = contrato ? arredondar((contrato.valorGlobal || 0) - valor) : 0;
      return {
        processoId: p.id,
        pae: p.numero_processo,
        objeto: p.objeto,
        valor,
        itens: uso.itens ?? [],
        ...(contrato
          ? { contrato: { id: contrato.id, numero: contrato.numero, empresa: contrato.empresa, valorGlobal: contrato.valorGlobal || 0, vinculadoAAta: vinculado } }
          : {}),
        ...(vinculado && Math.abs(diferenca) > 0.01 ? { divergencia: diferenca } : {}),
      };
    });
}

export interface SaldoItemArp {
  idx: number;
  descricao: string;
  registrada: number;
  utilizada: number;
  /** Pode ficar negativo se os processos pediram mais do que a ata registrou. */
  saldo: number;
  valorUnitario: number;
}

/** Saldo por item (quantidade) das atas com itens: registrada menos o que os processos pediram. */
export function saldoItensDaArp(ata: Pick<ProcedimentoLicitatorio, 'itens'>, consumos: Pick<ConsumoDeProcesso, 'itens'>[]): SaldoItemArp[] {
  const itens = itensDaArp(ata);
  return itens.map((item) => {
    const utilizada = consumos
      .flatMap((c) => c.itens)
      .filter((uso) => acharItemDaArp(itens, uso)?.idx === item.idx)
      .reduce((acc, uso) => acc + uso.quantidade, 0);
    return {
      idx: item.idx,
      descricao: item.descricao,
      registrada: item.quantidade,
      utilizada,
      saldo: item.quantidade - utilizada,
      valorUnitario: item.valorUnitario,
    };
  });
}

export interface SaldoArp {
  registrado: number;
  /** Contratos ligados à ata + o que os processos declararam usar (processo com contrato já ligado à ata conta só pelo contrato). */
  utilizado: number;
  /** Pode ficar negativo se os contratos e processos passaram do registrado. */
  saldo: number;
  contratos: Pick<Contrato, 'id' | 'numero' | 'empresa' | 'valorGlobal'>[];
  processos: ConsumoDeProcesso[];
  itens: SaldoItemArp[];
}

/** Contratos originados da ata (campo `arpId`) e processos que a utilizam, e o saldo que sobra dela. */
export function saldoDaArp(
  proc: Pick<ProcedimentoLicitatorio, 'id' | 'valorHomologado' | 'itens'>,
  contratos: ContratoParaConsumo[],
  processos: ProcessoParaConsumo[] = [],
): SaldoArp {
  const derivados = contratos.filter((c) => c.arpId === proc.id);
  const consumos = consumosDeProcessos(proc, processos, contratos);
  const registrado = valorRegistradoDaArp(proc);
  const utilizadoContratos = derivados.reduce((acc, c) => acc + (c.valorGlobal || 0), 0);
  const utilizadoProcessos = consumos.filter((c) => !c.contrato?.vinculadoAAta).reduce((acc, c) => acc + c.valor, 0);
  const utilizado = utilizadoContratos + utilizadoProcessos;
  return {
    registrado,
    utilizado,
    saldo: registrado - utilizado,
    contratos: derivados,
    processos: consumos,
    itens: saldoItensDaArp(proc, consumos),
  };
}
