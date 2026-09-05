import { useMemo, useState } from 'react';
import { CheckCircle, History, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { LogAcesso, LogAuditoria } from '../../lib/auditoria';

const ACAO_LABELS: Record<LogAuditoria['acao'], string> = {
  CREATE: 'Criação',
  UPDATE: 'Edição',
  DELETE: 'Remoção',
};

const ACAO_CORES: Record<LogAuditoria['acao'], string> = {
  CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  UPDATE: 'bg-amber-100 text-amber-800 border-amber-200',
  DELETE: 'bg-red-100 text-red-800 border-red-200',
};

function formatarDataHora(timestamp: { toDate: () => Date } | null | undefined): string {
  if (!timestamp) return 'Agora mesmo';
  try {
    return timestamp.toDate().toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function aoMilissegundos(timestamp: { toDate: () => Date } | null | undefined): number {
  if (!timestamp) return Date.now();
  try {
    return timestamp.toDate().getTime();
  } catch {
    return 0;
  }
}

const LIMITE_LINHAS = 200;

export default function Auditoria() {
  const { usuarioAtual, logsAuditoria, logsAcesso } = useApp();

  const [aba, setAba] = useState<'dados' | 'acesso'>('dados');
  const [filtroColecao, setFiltroColecao] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const colecoesDisponiveis = useMemo(
    () => Array.from(new Set(logsAuditoria.map((log) => log.colecao))).sort(),
    [logsAuditoria],
  );

  const auditoriaFiltrada = useMemo(() => {
    const termo = filtroUsuario.trim().toLowerCase();
    return logsAuditoria
      .filter((log) => !filtroColecao || log.colecao === filtroColecao)
      .filter((log) => !termo || (log.usuarioNome ?? '').toLowerCase().includes(termo))
      .slice()
      .sort((a, b) => aoMilissegundos(b.dataHora) - aoMilissegundos(a.dataHora))
      .slice(0, LIMITE_LINHAS);
  }, [logsAuditoria, filtroColecao, filtroUsuario]);

  const acessoFiltrado = useMemo(() => {
    const termo = filtroUsuario.trim().toLowerCase();
    return logsAcesso
      .filter((log) => !termo || (log.email ?? '').toLowerCase().includes(termo))
      .slice()
      .sort((a, b) => aoMilissegundos(b.dataHora) - aoMilissegundos(a.dataHora))
      .slice(0, LIMITE_LINHAS);
  }, [logsAcesso, filtroUsuario]);

  if (usuarioAtual?.perfil !== 'master') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <History className="w-6 h-6 mr-2 text-red-700" />
          Auditoria
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Log de auditoria de dados (criação, edição e remoção) e log de acesso (login) do sistema.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setAba('dados')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              aba === 'dados'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Log de Auditoria de Dados
          </button>
          <button
            onClick={() => setAba('acesso')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              aba === 'acesso'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Log de Acesso
          </button>
        </nav>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
            placeholder={aba === 'dados' ? 'Filtrar por usuário...' : 'Filtrar por e-mail...'}
          />
        </div>
        {aba === 'dados' && (
          <select
            value={filtroColecao}
            onChange={(e) => setFiltroColecao(e.target.value)}
            className="block w-full sm:w-56 rounded-md border-gray-300 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
          >
            <option value="">Todas as coleções</option>
            {colecoesDisponiveis.map((colecao) => (
              <option key={colecao} value={colecao}>{colecao}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {aba === 'dados' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coleção</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resumo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditoriaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  auditoriaFiltrada.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 align-top">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarDataHora(log.dataHora)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ACAO_CORES[log.acao]}`}>
                          {ACAO_LABELS[log.acao] ?? log.acao}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.colecao}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.usuarioNome}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md">{log.resumo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resultado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-mail</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Navegador</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {acessoFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      Nenhum registro de acesso encontrado.
                    </td>
                  </tr>
                ) : (
                  acessoFiltrado.map((log: LogAcesso) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarDataHora(log.dataHora)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.sucesso ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Falha
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.userAgent}>
                        {log.userAgent}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-start text-xs text-gray-400">
        <ShieldAlert className="w-4 h-4 mr-1.5 flex-shrink-0" />
        Exibindo os {LIMITE_LINHAS} registros mais recentes de cada log.
      </div>
    </div>
  );
}
