/**
 * Status do robô de atualização de processos (RPA que consulta o PAE e grava
 * na planilha). O robô registra cada execução na aba ROBO_LOG da planilha e o
 * "vigia" dele (que aceita pedidos e horários) dá um sinal na aba ROBO_STATUS;
 * o sistema só lê essas duas abas — nada do robô precisa chegar ao Firestore.
 */

export const ABA_ROBO_LOG = 'ROBO_LOG';
export const ABA_ROBO_STATUS = 'ROBO_STATUS';

const CABECALHO_LOG = ['data/hora', 'maquina', 'situacao'];
const CABECALHO_STATUS = ['maquina', 'ultimo sinal', 'estado'];

export type SituacaoRobo = 'EXECUTANDO' | 'CONCLUIDO' | 'INTERROMPIDO' | 'FALHOU' | string;

export interface ExecucaoRobo {
  quando: Date;
  maquina: string;
  situacao: SituacaoRobo;
  total: number;
  sucesso: number;
  mudaram: number;
  erros: number;
  minutos: number;
  motivo: string;
}

export interface VigiaRobo {
  maquina: string;
  ultimoSinal: Date;
  estado: string;
}

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** A aba pedida pode não existir — o Google devolve outra aba no lugar; só vale se o cabeçalho for o esperado. */
const cabecalhoConfere = (linha: string[] | undefined, esperado: string[]) =>
  !!linha && esperado.every((titulo, i) => semAcento(linha[i] ?? '') === titulo);

/** 'dd/MM/yyyy HH:mm:ss' (horário de Brasília, que é como o Apps Script grava) -> Date. */
export function parseDataHoraRobo(texto: string): Date | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, dia, mes, ano, hora = '00', minuto = '00', segundo = '00'] = m;
  const data = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}-03:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

const numero = (texto: string | undefined) => Number(String(texto ?? '').replace(',', '.')) || 0;

export function parseLogRobo(linhas: string[][]): ExecucaoRobo[] {
  if (!cabecalhoConfere(linhas[0], CABECALHO_LOG)) return [];
  return linhas
    .slice(1)
    .map((l): ExecucaoRobo | null => {
      const quando = parseDataHoraRobo(l[0] ?? '');
      if (!quando) return null;
      return {
        quando,
        maquina: (l[1] ?? '').trim(),
        situacao: (l[2] ?? '').trim().toUpperCase(),
        total: numero(l[3]),
        sucesso: numero(l[4]),
        mudaram: numero(l[5]),
        erros: numero(l[6]),
        minutos: numero(l[7]),
        motivo: (l[8] ?? '').trim(),
      };
    })
    .filter((e): e is ExecucaoRobo => e !== null)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

export function parseVigiasRobo(linhas: string[][]): VigiaRobo[] {
  if (!cabecalhoConfere(linhas[0], CABECALHO_STATUS)) return [];
  return linhas
    .slice(1)
    .map((l): VigiaRobo | null => {
      const ultimoSinal = parseDataHoraRobo(l[1] ?? '');
      return ultimoSinal && (l[0] ?? '').trim()
        ? { maquina: l[0].trim(), ultimoSinal, estado: (l[2] ?? '').trim().toUpperCase() }
        : null;
    })
    .filter((v): v is VigiaRobo => v !== null);
}

/** "há 5 min", "há 3 h", "há 2 dias". */
export function haQuantoTempo(data: Date, agora: Date): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - data.getTime()) / 60000));
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `há ${horas} h`;
  return `há ${Math.round(horas / 24)} dias`;
}

export type NivelRobo = 'ok' | 'atencao' | 'erro' | 'desconhecido';

export interface ResumoRobo {
  nivel: NivelRobo;
  texto: string;
  detalhe: string;
  /** Alguma máquina com o vigia ligado (sinal nos últimos 3 min) — o botão "Atualizar agora" funciona. */
  vigiaLigado: boolean;
}

const LIMITE_VIGIA_MIN = 3;
const LIMITE_EXECUCAO_H = 3;
const LIMITE_DESATUALIZADO_H = 36;

export function resumirStatusRobo(execucoes: ExecucaoRobo[], vigias: VigiaRobo[], agora: Date = new Date()): ResumoRobo {
  const vigiaAtivo = vigias.find((v) => agora.getTime() - v.ultimoSinal.getTime() <= LIMITE_VIGIA_MIN * 60000);
  const vigiaLigado = !!vigiaAtivo;
  const detalheVigia = vigiaAtivo ? `Vigia ligado em ${vigiaAtivo.maquina}.` : 'Nenhum vigia ligado — o botão "Atualizar agora" não funciona até ligar o robô em modo vigia.';

  const ultima = execucoes[execucoes.length - 1];
  if (!ultima) {
    return { nivel: 'desconhecido', texto: 'Robô PAE: sem registro de execução', detalhe: detalheVigia, vigiaLigado };
  }

  const idadeH = (agora.getTime() - ultima.quando.getTime()) / 3600000;
  const quando = haQuantoTempo(ultima.quando, agora);
  const onde = ultima.maquina ? ` em ${ultima.maquina}` : '';

  if (ultima.situacao === 'EXECUTANDO') {
    if (idadeH >= LIMITE_EXECUCAO_H) {
      return {
        nivel: 'atencao',
        texto: `Robô PAE: execução iniciada ${quando}${onde} e sem término`,
        detalhe: `Pode ter travado ou sido fechado. ${detalheVigia}`,
        vigiaLigado,
      };
    }
    return { nivel: 'ok', texto: `Robô PAE: executando desde ${quando}${onde}`, detalhe: detalheVigia, vigiaLigado };
  }

  if (ultima.situacao === 'FALHOU' || ultima.situacao === 'INTERROMPIDO') {
    return {
      nivel: 'erro',
      texto: `Robô PAE: ${ultima.situacao === 'FALHOU' ? 'falhou' : 'interrompido'} ${quando}${onde}`,
      detalhe: `${ultima.motivo || 'Sem motivo informado.'} ${detalheVigia}`,
      vigiaLigado,
    };
  }

  const resultado = `${ultima.mudaram} mudaram de setor, ${ultima.erros} com erro/não encontrados, ${ultima.minutos} min`;
  if (idadeH >= LIMITE_DESATUALIZADO_H) {
    return {
      nivel: 'atencao',
      texto: `Robô PAE: última atualização ${quando}${onde}`,
      detalhe: `${resultado}. Os setores podem estar desatualizados. ${detalheVigia}`,
      vigiaLigado,
    };
  }
  return { nivel: 'ok', texto: `Robô PAE: atualizado ${quando}${onde}`, detalhe: `${resultado}. ${detalheVigia}`, vigiaLigado };
}
