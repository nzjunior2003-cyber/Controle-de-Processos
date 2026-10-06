/**
 * Ajustes do master nos checklists dos ritos processuais. A lista oficial vem
 * da planilha (aba "RITO DE PROCESSOS") e é recarregada sempre — por isso o
 * que o master inclui ou exclui é guardado à parte, como diferença sobre ela:
 * `adicionar` (itens extras, no fim da lista) e `remover` (itens da lista
 * oficial que não valem pra esse rito aqui).
 */
import { normalizarRito } from './ritosProcessuais';

export interface AjusteRito {
  id: string;
  rito: string;
  adicionar: string[];
  remover: string[];
  atualizado_em?: string;
}

/** Id do documento: o mesmo rito (mesmo escrito de outro jeito) sempre cai no mesmo ajuste. */
export function idAjusteRito(rito: string): string {
  const canonico = normalizarRito(rito) ?? rito;
  return canonico
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

const mesmoItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Aplica os ajustes sobre as etapas oficiais (ajustes de rito que não existe mais são ignorados). */
export function aplicarAjustesRito(
  etapasPorRito: Record<string, string[]>,
  ajustes: Pick<AjusteRito, 'rito' | 'adicionar' | 'remover'>[],
): Record<string, string[]> {
  const resultado: Record<string, string[]> = { ...etapasPorRito };
  ajustes.forEach((ajuste) => {
    const rito = normalizarRito(ajuste.rito) ?? ajuste.rito;
    const base = resultado[rito];
    if (!base) return;
    const lista = base.filter((item) => !(ajuste.remover ?? []).some((r) => mesmoItem(r, item)));
    (ajuste.adicionar ?? []).forEach((item) => {
      if (item.trim() && !lista.some((existente) => mesmoItem(existente, item))) lista.push(item.trim());
    });
    resultado[rito] = lista;
  });
  return resultado;
}
