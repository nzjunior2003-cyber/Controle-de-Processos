import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { useEtapasPorRito } from '../../hooks/useEtapasPorRito';
import { calcularProgressoChecklist } from '../../lib/fluxoProcesso';
import { calcularDataPrevista } from '../../lib/prazosProcesso';
import { calcularStatusContrato, encontrarVinculosPorPae, formatarMoeda, marcoAlertaVencimento } from '../../lib/contratos';
import { totalPagoPorFonte } from '../../lib/financeiro';

const TOOLTIP_STYLE = { borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const CORES_PIZZA = ['#dc2626', '#d97706', '#059669', '#2563eb', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

/**
 * Dashboard executivo da DGA (Departamento Geral de Administração):
 * cruza dados de PCA, Processos, Contratos e Financeiro pra dar visão de
 * planejamento x execução, saldos, vigências e prazos — todos os cálculos
 * reaproveitam funções já existentes nos demais módulos (nenhum dado é
 * recalculado com regra própria).
 */
export default function DashboardDga() {
  const { pcas, processos, contratos, procedimentos, pagamentos } = useApp();
  const etapasPorRito = useEtapasPorRito();

  const exerciciosDisponiveis = useMemo(
    () => Array.from(new Set(pcas.map((p) => p.exercicio))).sort((a, b) => b - a),
    [pcas],
  );
  const [exercicio, setExercicio] = useState<number | ''>(exerciciosDisponiveis[0] ?? '');

  const pcasDoExercicio = useMemo(
    () => pcas.filter((p) => (exercicio === '' ? true : p.exercicio === exercicio)),
    [pcas, exercicio],
  );

  // Bloco 1: planejado por setor e por fonte
  const planejadoPorSetor = useMemo(() => {
    const agrupado = pcasDoExercicio.reduce<Record<string, number>>((acc, p) => {
      const setor = p.origem || p.unidade_responsavel || 'Não informado';
      acc[setor] = (acc[setor] || 0) + (p.valor_previsto || 0);
      return acc;
    }, {});
    return Object.entries(agrupado)
      .map(([name, Valor]) => ({ name, Valor }))
      .sort((a, b) => b.Valor - a.Valor)
      .slice(0, 8);
  }, [pcasDoExercicio]);

  const planejadoPorFonte = useMemo(() => {
    const agrupado = pcasDoExercicio.reduce<Record<string, number>>((acc, p) => {
      const fonte = p.fonte_recurso || 'Não informado';
      acc[fonte] = (acc[fonte] || 0) + (p.valor_previsto || 0);
      return acc;
    }, {});
    return Object.entries(agrupado).map(([name, value]) => ({ name, value }));
  }, [pcasDoExercicio]);

  const totalPlanejado = pcasDoExercicio.reduce((acc, p) => acc + (p.valor_previsto || 0), 0);

  // Bloco 2: planejado x contratado (via PCA -> Processo -> Contrato)
  const totalContratadoDoPlanejado = useMemo(() => {
    const idsPca = new Set(pcasDoExercicio.map((p) => p.id));
    const processosDoPca = processos.filter((proc) => proc.pca_id && idsPca.has(proc.pca_id));
    const idsContratosContados = new Set<string>();
    let total = 0;
    for (const proc of processosDoPca) {
      const { contrato } = encontrarVinculosPorPae(proc.numero_processo, { contratos, procedimentos });
      if (contrato && !idsContratosContados.has(contrato.id)) {
        idsContratosContados.add(contrato.id);
        total += contrato.valorGlobal || 0;
      }
    }
    return total;
  }, [pcasDoExercicio, processos, contratos, procedimentos]);

  const percentualExecutado = totalPlanejado > 0 ? (totalContratadoDoPlanejado / totalPlanejado) * 100 : 0;

  // Bloco 3: pago por fonte (Financeiro)
  const pagoPorFonte = useMemo(
    () => Object.entries(totalPagoPorFonte(pagamentos)).map(([name, value]) => ({ name, value })),
    [pagamentos],
  );

  // Bloco 4: saldos de contratos
  const contratosAtivos = useMemo(() => contratos.filter((c) => !c.concluido), [contratos]);
  const saldoTotalFinanceiro = contratosAtivos.reduce((acc, c) => acc + (c.saldoAtualFinanceiro ?? 0), 0);
  const contratosComSaldoBaixo = contratosAtivos.filter(
    (c) => c.valorGlobal > 0 && ((c.saldoAtualFinanceiro ?? 0) / c.valorGlobal) * 100 <= 20,
  );

  // Bloco 5: vigências próximas do vencimento
  const contratosComStatus = useMemo(() => contratos.map((c) => calcularStatusContrato(c)), [contratos]);
  const vigenciasProximas = useMemo(() => {
    const hoje = new Date();
    return contratosComStatus
      .filter((c) => !c.concluido)
      .map((c) => {
        const fim = new Date(c.fimVigencia);
        const dias = Number.isNaN(fim.getTime()) ? null : Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const marco = dias != null ? marcoAlertaVencimento(dias) : null;
        return { ...c, diasRestantes: dias, marco };
      })
      .filter((c) => c.marco !== null)
      .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0));
  }, [contratosComStatus]);

  // Bloco 6: andamento dos processos (percentual do checklist)
  const processosAtivos = useMemo(() => processos.filter((p) => p.status === 'em_andamento'), [processos]);
  const distribuicaoAndamento = useMemo(() => {
    const faixas = { '0-25%': 0, '25-50%': 0, '50-75%': 0, '75-100%': 0, 'Sem meta': 0 };
    processosAtivos.forEach((proc) => {
      const percentual = calcularProgressoChecklist(proc, etapasPorRito);
      if (percentual == null) faixas['Sem meta']++;
      else if (percentual < 25) faixas['0-25%']++;
      else if (percentual < 50) faixas['25-50%']++;
      else if (percentual < 75) faixas['50-75%']++;
      else faixas['75-100%']++;
    });
    return Object.entries(faixas).map(([name, Quantidade]) => ({ name, Quantidade }));
  }, [processosAtivos, etapasPorRito]);

  // Bloco 7: previsão de execução no prazo
  const previsaoExecucao = useMemo(() => {
    const hoje = new Date();
    const resultado = { dentroDoPrazo: 0, foraDoPrazo: 0, semMeta: 0 };
    processosAtivos.forEach((proc) => {
      const dataPrevista = calcularDataPrevista(proc.data_entrada, proc.rito_processual);
      if (!dataPrevista) resultado.semMeta++;
      else if (hoje <= dataPrevista) resultado.dentroDoPrazo++;
      else resultado.foraDoPrazo++;
    });
    return resultado;
  }, [processosAtivos]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Executivo — DGA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Visão consolidada de planejamento, execução, saldos e prazos pra apoio à decisão.
          </p>
        </div>
        <select
          value={exercicio}
          onChange={(e) => setExercicio(e.target.value ? Number(e.target.value) : '')}
          className="block w-full sm:w-40 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
        >
          <option value="">Todos os exercícios</option>
          {exerciciosDisponiveis.map((ano) => (
            <option key={ano} value={ano}>{ano}</option>
          ))}
        </select>
      </div>

      {/* Bloco 1 e 2: Planejado x Contratado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Planejado no PCA</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatarMoeda(totalPlanejado)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Já Contratado</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{formatarMoeda(totalContratadoDoPlanejado)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">% do Plano Executado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{percentualExecutado.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Planejado por Setor (Top 8)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={planejadoPorSetor} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => formatarMoeda(v)} fontSize={11} />
              <YAxis type="category" dataKey="name" width={90} fontSize={11} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="Valor" fill="#dc2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Planejado por Fonte de Recurso</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={planejadoPorFonte} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {planejadoPorFonte.map((_, idx) => (
                  <Cell key={idx} fill={CORES_PIZZA[idx % CORES_PIZZA.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bloco 3: Pago por fonte */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Pago por Fonte de Recurso (Financeiro)</h2>
        {pagoPorFonte.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum pagamento lançado ainda.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={pagoPorFonte}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis tickFormatter={(v) => formatarMoeda(v)} fontSize={11} width={90} />
              <Tooltip formatter={(v: number) => formatarMoeda(v)} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" name="Valor Pago" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bloco 4: Saldos de contratos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Saldo Financeiro em Aberto (Contratos Ativos)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatarMoeda(saldoTotalFinanceiro)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Contratos com Saldo ≤ 20%</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{contratosComSaldoBaixo.length}</p>
        </div>
      </div>

      {/* Bloco 5: Vigências próximas */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <h2 className="text-lg font-medium text-gray-900 p-6 pb-0">Vigências Próximas do Vencimento</h2>
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fim da Vigência</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dias Restantes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vigenciasProximas.slice(0, 15).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{c.numero} — {c.empresa}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{new Date(c.fimVigencia).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-amber-700">{c.diasRestantes} dias</td>
                </tr>
              ))}
              {vigenciasProximas.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma vigência próxima do vencimento.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bloco 6: Andamento dos processos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Andamento dos Processos Ativos (% do Checklist)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={distribuicaoAndamento}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="Quantidade" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bloco 7: Previsão de execução no prazo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-emerald-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Dentro do Prazo Previsto</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{previsaoExecucao.dentroDoPrazo}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Fora do Prazo Previsto</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{previsaoExecucao.foraDoPrazo}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Sem Meta Definida pro Rito</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">{previsaoExecucao.semMeta}</p>
        </div>
      </div>
    </div>
  );
}
