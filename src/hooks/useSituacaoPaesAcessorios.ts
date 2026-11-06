import { useCallback, useEffect, useState } from 'react';
import { ID_PLANILHA_PROCESSOS } from '../lib/csv';
import { ABA_PAES_ACESSORIOS, parseAbaPaesAcessorios, type SituacaoPae } from '../lib/paesAcessorios';

const INTERVALO_MS = 2 * 60 * 1000;

/** Lê (a cada 2 minutos) a aba PAES_ACESSORIOS, onde o robô grava o setor atual de cada PAE acessório. */
export function useSituacaoPaesAcessorios() {
  const [situacoes, setSituacoes] = useState<Map<string, SituacaoPae>>(new Map());

  const recarregar = useCallback(async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_PROCESSOS}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(ABA_PAES_ACESSORIOS)}`;
      const resposta = await fetch(url);
      if (!resposta.ok) return;
      const Papa = (await import('papaparse')).default;
      const linhas = Papa.parse<string[]>(await resposta.text(), { header: false, skipEmptyLines: true }).data;
      setSituacoes(parseAbaPaesAcessorios(linhas));
    } catch (erro) {
      console.error('Erro ao ler a aba dos PAEs acessórios:', erro);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const id = window.setInterval(() => void recarregar(), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [recarregar]);

  return situacoes;
}
