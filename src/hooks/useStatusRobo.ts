import { useCallback, useEffect, useState } from 'react';
import { ID_PLANILHA_PROCESSOS } from '../lib/csv';
import {
  ABA_ROBO_LOG,
  ABA_ROBO_STATUS,
  parseLogRobo,
  parseVigiasRobo,
  type ExecucaoRobo,
  type VigiaRobo,
} from '../lib/statusRobo';

const INTERVALO_MS = 2 * 60 * 1000;

async function lerAba(nome: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_PROCESSOS}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nome)}`;
  const resposta = await fetch(url);
  if (!resposta.ok) return [];
  const csv = await resposta.text();
  const Papa = (await import('papaparse')).default;
  return Papa.parse<string[]>(csv, { header: false, skipEmptyLines: true }).data;
}

/**
 * Lê (a cada 2 minutos) as abas ROBO_LOG e ROBO_STATUS da planilha de
 * processos, onde o robô e o vigia dele registram o que estão fazendo.
 */
export function useStatusRobo() {
  const [execucoes, setExecucoes] = useState<ExecucaoRobo[]>([]);
  const [vigias, setVigias] = useState<VigiaRobo[]>([]);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [log, status] = await Promise.all([lerAba(ABA_ROBO_LOG), lerAba(ABA_ROBO_STATUS)]);
      setExecucoes(parseLogRobo(log));
      setVigias(parseVigiasRobo(status));
    } catch (erro) {
      console.error('Erro ao ler o status do robô:', erro);
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    const id = window.setInterval(() => void recarregar(), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [recarregar]);

  return { execucoes, vigias, carregado, recarregar };
}
