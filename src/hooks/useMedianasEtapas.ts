import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { medianaPorEtapa, type MedianaEtapa } from '../lib/historicoEtapas';

/** Mediana real de dias por etapa, calculada com as passagens fechadas de todos os processos. */
export function useMedianasEtapas(): Map<string, MedianaEtapa> {
  const { processos } = useApp();
  return useMemo(() => medianaPorEtapa(processos), [processos]);
}
