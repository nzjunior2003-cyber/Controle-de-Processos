import type { Timestamp } from 'firebase/firestore';

export type AcaoAuditoria = 'CREATE' | 'UPDATE' | 'DELETE';

/** Registro de uma tentativa de login (sucesso ou falha). */
export interface LogAcesso {
  id: string;
  userId: string | null;
  email: string;
  sucesso: boolean;
  dataHora: Timestamp | null;
  userAgent: string;
}

/** Registro de uma alteração de dados (criação, edição ou remoção). */
export interface LogAuditoria {
  id: string;
  colecao: string;
  documentoId: string;
  acao: AcaoAuditoria;
  usuarioId: string;
  usuarioNome: string;
  dataHora: Timestamp | null;
  resumo: string;
}

/** Campos que nunca entram no resumo (ruído: sempre mudam ou são internos). */
const CAMPOS_IGNORADOS = new Set(['id', 'criado_em', 'atualizado_em', 'senha']);

const TAMANHO_MAX_VALOR = 80;
const TAMANHO_MAX_RESUMO = 1000;

function formatarValor(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return '—';
  const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  return texto.length > TAMANHO_MAX_VALOR ? `${texto.slice(0, TAMANHO_MAX_VALOR)}…` : texto;
}

function camposRelevantes(dados: Record<string, unknown>): string[] {
  return Object.keys(dados).filter((campo) => !CAMPOS_IGNORADOS.has(campo));
}

/**
 * Monta um resumo simples e legível do que mudou, para o log de
 * auditoria. Em UPDATE, compara antes/depois quando `anterior` está
 * disponível; sem isso, cai para apenas listar os campos enviados.
 */
export function resumirAuditoria(
  acao: AcaoAuditoria,
  dados: object,
  anterior?: object,
): string {
  const novo = dados as Record<string, unknown>;

  if (acao === 'DELETE') {
    return 'Documento removido';
  }

  if (acao === 'CREATE' || !anterior) {
    const campos = camposRelevantes(novo);
    return campos.length ? `Campos informados: ${campos.join(', ')}` : 'Nenhum campo informado';
  }

  const antigo = anterior as Record<string, unknown>;
  const alterados = camposRelevantes(novo).filter(
    (campo) => JSON.stringify(novo[campo]) !== JSON.stringify(antigo[campo]),
  );

  if (alterados.length === 0) return 'Nenhuma alteração detectada';

  const resumo = alterados
    .map((campo) => `${campo}: ${formatarValor(antigo[campo])} -> ${formatarValor(novo[campo])}`)
    .join('; ');

  return resumo.length > TAMANHO_MAX_RESUMO ? `${resumo.slice(0, TAMANHO_MAX_RESUMO)}…` : resumo;
}
