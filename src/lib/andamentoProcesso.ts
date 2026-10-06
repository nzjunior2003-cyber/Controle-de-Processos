/**
 * Sincronização do "Andamento" (coluna S da planilha de processos) nos dois
 * sentidos. Como a planilha não informa quando cada célula foi editada, o
 * sistema guarda um "retrato" do último valor que sabe estar na planilha
 * (`andamento_planilha`): se a célula é diferente do retrato, a planilha foi
 * editada; se o andamento do sistema é diferente do retrato, o sistema foi
 * editado. Quem mudou, vale; se mudaram os dois, vale a edição mais recente.
 */
import type { Processo } from '../types';

export interface EstadoAndamento {
  /** Andamento atual no sistema. */
  andamento?: string;
  /** Último valor sabidamente presente na planilha (lido ou gravado por nós). */
  andamento_planilha?: string;
  /** Quando o retrato acima foi tirado. */
  andamento_planilha_em?: string;
  /** Quando o andamento foi editado no sistema pela última vez. */
  andamento_editado_em?: string;
}

export interface ResolucaoAndamento {
  /** Valor que deve ficar no sistema. */
  valor: string;
  /** De onde veio. 'igual' = nada a fazer. */
  origem: 'planilha' | 'sistema' | 'igual';
  /** Campos de controle a gravar no processo. */
  controle: Pick<Processo, 'andamento_planilha' | 'andamento_planilha_em'>;
  /** O sistema venceu e a planilha ainda não tem o valor — falta gravar na coluna S. */
  pendenteNaPlanilha: boolean;
}

const texto = (valor?: string) => (valor ?? '').trim();

export function resolverAndamento(
  estado: EstadoAndamento,
  andamentoDaPlanilha: string | undefined,
  agora: string,
): ResolucaoAndamento {
  const sistema = texto(estado.andamento);
  const planilha = texto(andamentoDaPlanilha);
  const retrato = estado.andamento_planilha === undefined ? undefined : texto(estado.andamento_planilha);

  const doSistema = (): ResolucaoAndamento => ({
    valor: sistema,
    origem: 'sistema',
    controle: {
      andamento_planilha: retrato ?? planilha,
      andamento_planilha_em: estado.andamento_planilha_em ?? agora,
    },
    pendenteNaPlanilha: sistema !== planilha,
  });
  const daPlanilha = (): ResolucaoAndamento => ({
    valor: planilha,
    origem: 'planilha',
    controle: { andamento_planilha: planilha, andamento_planilha_em: agora },
    pendenteNaPlanilha: false,
  });

  if (sistema === planilha) {
    return {
      valor: sistema,
      origem: 'igual',
      controle: { andamento_planilha: planilha, andamento_planilha_em: estado.andamento_planilha_em ?? agora },
      pendenteNaPlanilha: false,
    };
  }

  // Sem retrato (processo antigo): a planilha manda, a não ser que o sistema tenha sido editado e ainda não chegou lá.
  if (retrato === undefined) return estado.andamento_editado_em ? doSistema() : daPlanilha();

  const planilhaMudou = planilha !== retrato;
  const sistemaMudou = sistema !== retrato;

  if (planilhaMudou && !sistemaMudou) return daPlanilha();
  if (!planilhaMudou && sistemaMudou) return doSistema();

  // Mudaram os dois lados: vale o mais recente — a edição do sistema (com data) contra a observação da planilha.
  const editadoEm = estado.andamento_editado_em ?? '';
  const retratoEm = estado.andamento_planilha_em ?? '';
  return editadoEm > retratoEm ? doSistema() : daPlanilha();
}
