import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { idAjusteRito } from '../lib/ajustesRito';

const mesmoItem = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Master: inclui/exclui etapas direto no checklist de um rito (na tela do
 * processo). A mudança vale pro rito inteiro — todos os processos daquele rito
 * passam a ter (ou deixam de ter) a etapa. Fica guardada como ajuste sobre a
 * lista da planilha (ver lib/ajustesRito.ts).
 */
export function useAjustarChecklistRito() {
  const { usuarioAtual, ajustesRito, salvarAjusteRito } = useApp();
  const podeAjustar = usuarioAtual?.perfil === 'master';

  const ajusteDo = useCallback(
    (rito: string) => ajustesRito.find((a) => a.id === idAjusteRito(rito)),
    [ajustesRito],
  );

  const incluirEtapa = useCallback(
    async (rito: string, item: string) => {
      const texto = item.trim();
      if (!texto) return;
      const ajuste = ajusteDo(rito);
      const adicionar = ajuste?.adicionar ?? [];
      const remover = ajuste?.remover ?? [];
      const removidoIgual = remover.find((r) => mesmoItem(r, texto));
      if (removidoIgual) return salvarAjusteRito(rito, adicionar, remover.filter((r) => r !== removidoIgual));
      if (adicionar.some((a) => mesmoItem(a, texto))) return;
      return salvarAjusteRito(rito, [...adicionar, texto], remover);
    },
    [ajusteDo, salvarAjusteRito],
  );

  const excluirEtapa = useCallback(
    async (rito: string, item: string) => {
      const ajuste = ajusteDo(rito);
      const adicionar = ajuste?.adicionar ?? [];
      const remover = ajuste?.remover ?? [];
      if (adicionar.some((a) => mesmoItem(a, item))) {
        return salvarAjusteRito(rito, adicionar.filter((a) => !mesmoItem(a, item)), remover);
      }
      if (remover.some((r) => mesmoItem(r, item))) return;
      return salvarAjusteRito(rito, adicionar, [...remover, item]);
    },
    [ajusteDo, salvarAjusteRito],
  );

  return { podeAjustar, incluirEtapa, excluirEtapa };
}
