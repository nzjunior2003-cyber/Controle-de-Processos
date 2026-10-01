/**
 * Prazos-alvo por rito processual, definidos pelo Gestor (mistura de meta
 * institucional do CBMPA e prazo legal, conforme o rito) — usados pra
 * desenhar a raia "Planejado" do Gantt (item 4) e estimar a data de
 * efetivação do contrato (item 7). Em dias corridos, contados a partir da
 * data de abertura do processo (`data_entrada`).
 *
 * Ritos sem entrada aqui (ex.: "Cotação Deserta / Fracassada por 3 vezes")
 * ainda não têm meta definida — nesse caso não há "planejado" pra esse
 * processo, só o andamento real.
 */
import { normalizarRito, RITO_ADESAO_ARP, RITO_GERENCIADOR_ARP, RITO_PARTICIPE_ARP } from './ritosProcessuais';

export const PRAZOS_ALVO_POR_RITO: Record<string, number> = {
  'Pregão Eletrônico': 120,
  'Pregão Eletrônico p/ Registro de preços': 120,
  [RITO_GERENCIADOR_ARP]: 10,
  [RITO_PARTICIPE_ARP]: 15,
  [RITO_ADESAO_ARP]: 30,
  Inexigibilidade: 60,
  'Inexigibilidade p/ Cursos': 60,
  'Dispensa em Situação de Emergência': 30,
  'Dispensa por legislação (IOEPA - Lei 14.133, Art. 75, IX)': 30,
  'Dispensa por valor (Decreto 2.787, Art. 3º, II. Lei 14.133, Art. 75, II.)': 30,
  'Dispensa por valor irrisório (Dec. N°2.787/22, Art. 3º, §6º)': 30,
  'Prorrogação de contrato': 30,
  'Acréscimo ou supressão': 30,
  'Reequilíbrio, Repacotamento ....': 30,
};

/** Prazo-alvo (em dias) do rito, aceitando também os nomes antigos/alternativos; `undefined` sem meta definida. */
export function prazoAlvoDoRito(rito: string | undefined): number | undefined {
  const canonico = normalizarRito(rito);
  return canonico ? PRAZOS_ALVO_POR_RITO[canonico] : undefined;
}

/** Data prevista de efetivação (fim do prazo-alvo), a partir da abertura do processo. `null` sem meta definida pro rito. */
export function calcularDataPrevista(dataEntrada: string | undefined, rito: string | undefined): Date | null {
  if (!dataEntrada || !rito) return null;
  const prazoDias = prazoAlvoDoRito(rito);
  if (prazoDias == null) return null;
  const data = new Date(dataEntrada);
  data.setDate(data.getDate() + prazoDias);
  return data;
}
