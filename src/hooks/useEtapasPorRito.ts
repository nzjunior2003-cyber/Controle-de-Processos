import { useEffect, useMemo, useState } from 'react';
import { CHECKLISTS_RITOS } from '../types';
import { unificarEtapasPorRito } from '../lib/ritosProcessuais';
import { aplicarAjustesRito } from '../lib/ajustesRito';
import { useApp } from '../context/AppContext';
import { ABA_RITO_DE_PROCESSOS, ID_PLANILHA_PROCESSOS, mapAbaRitoDeProcessos } from '../lib/csv';

/**
 * Etapas de cada rito processual, lidas da aba "RITO DE PROCESSOS" da
 * planilha de controle — fonte de verdade oficial, mais completa que o
 * dicionário hardcoded `CHECKLISTS_RITOS`. Enquanto a planilha carrega (ou
 * se a leitura falhar), usa o dicionário hardcoded como fallback; depois de
 * carregada, os ritos da planilha têm prioridade (mas os ritos antigos que
 * só existem no dicionário — usados por processos já cadastrados antes
 * desta mudança — continuam disponíveis).
 */
export function useEtapasOficiaisPorRito(): Record<string, string[]> {
  const [etapasDaPlanilha, setEtapasDaPlanilha] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_PROCESSOS}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(ABA_RITO_DE_PROCESSOS)}`;
        const resposta = await fetch(url);
        if (!resposta.ok) return;
        const csv = await resposta.text();
        const Papa = (await import('papaparse')).default;
        const linhas = await new Promise<Record<string, string | undefined>[]>((resolve) => {
          Papa.parse<Record<string, string | undefined>>(csv, {
            header: true,
            skipEmptyLines: true,
            complete: (resultado) => resolve(resultado.data),
          });
        });
        if (!cancelado) setEtapasDaPlanilha(mapAbaRitoDeProcessos(linhas));
      } catch (erro) {
        console.error('Erro ao carregar a aba "RITO DE PROCESSOS":', erro);
      }
    };
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Ritos unificados por nome canônico; em cada um fica o checklist com mais itens (planilha ou código).
  return useMemo(() => unificarEtapasPorRito(CHECKLISTS_RITOS, etapasDaPlanilha), [etapasDaPlanilha]);
}

/** Etapas de cada rito já com os ajustes do master (itens incluídos/excluídos) — é o que o resto do sistema usa. */
export function useEtapasPorRito(): Record<string, string[]> {
  const oficiais = useEtapasOficiaisPorRito();
  const { ajustesRito } = useApp();
  return useMemo(() => aplicarAjustesRito(oficiais, ajustesRito), [oficiais, ajustesRito]);
}
