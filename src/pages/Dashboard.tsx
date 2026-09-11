import React from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell, Legend } from 'recharts';
import {
  agruparEstadasPorProcesso,
  calcularMediaDiasPorLocalizacao,
  calcularMediaDiasPorRito,
  localizacaoEfetiva,
} from '../lib/fluxoProcesso';

const TOOLTIP_STYLE = {
  borderRadius: '0.5rem',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

export default function Dashboard() {
  const { processos, setores, estadasProcesso } = useApp();

  const total = processos.length;
  const concluidos = processos.filter(p => p.status === 'concluido').length;
  const contratadosAditivados = processos.filter(p => p.status === 'contratado_aditivado').length;
  const emAndamento = processos.filter(p => p.status === 'em_andamento').length;
  const comAlerta = processos.filter(p => p.possui_alerta).length;

  const siglaDoSetor = (id: string) => setores.find(s => s.id === id)?.sigla;

  // Top 8 localizações reais com mais processos em aberto agora — sem
  // isso, contar por fase_atual_id (fluxo fixo de 7 setores) mostraria
  // quase tudo empilhado em "Demandante" pros processos vindos da planilha.
  // "Contratado/Aditivado" também sai da conta de "em aberto": a fase de
  // Instrução (responsabilidade do Apoio) já terminou nesses processos.
  const contagemPorLocalizacao = new Map<string, number>();
  processos
    .filter(p => p.status !== 'concluido' && p.status !== 'arquivado' && p.status !== 'contratado_aditivado')
    .forEach(p => {
      const loc = localizacaoEfetiva(p, siglaDoSetor);
      contagemPorLocalizacao.set(loc, (contagemPorLocalizacao.get(loc) ?? 0) + 1);
    });
  const dataFases = Array.from(contagemPorLocalizacao.entries())
    .map(([name, Processos]) => ({ name, Processos }))
    .sort((a, b) => b.Processos - a.Processos)
    .slice(0, 8);

  const dataStatus = [
    { name: 'Em Andamento', value: emAndamento },
    { name: 'Contratado/Aditivado', value: contratadosAditivados },
    { name: 'Concluídos', value: concluidos },
    { name: 'Com Pendência', value: processos.filter(p => p.status === 'pendente').length },
  ];

  const COLORS = ['#0284c7', '#7c3aed', '#059669', '#d97706'];

  const estadasPorProcesso = agruparEstadasPorProcesso(estadasProcesso);
  const mediaPorLocalizacao = calcularMediaDiasPorLocalizacao(estadasProcesso).slice(0, 8);
  const mediaPorRito = calcularMediaDiasPorRito(processos, estadasPorProcesso);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Gerencial</h1>
        <p className="mt-1 text-sm text-gray-500">Monitore o fluxo e identificação de gargalos.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total de Processos</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Em Andamento</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{emAndamento}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Concluídos</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{concluidos}</p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-red-600">Com Alerta / Atraso</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{comAlerta}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Processos por Localização (Gargalo Atual)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataFases} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="Processos" fill="#b91c1c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Proporção por Status (Geral)</h2>
          <div className="h-80 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tempo médio: onde os processos demoram mais, e estimativa por tipo de contratação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Setores com Maior Tempo Médio</h2>
          <p className="text-xs text-gray-500 mb-6">Média de dias que os processos passam em cada localização (histórico completo).</p>
          {mediaPorLocalizacao.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Ainda não há histórico suficiente. Sincronize a planilha ou aguarde os processos tramitarem.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mediaPorLocalizacao.map(i => ({ name: i.localizacao, Dias: Math.round(i.mediaDias), amostras: i.ocorrencias }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, _n, item) => [`${value} dias (${item.payload.amostras} amostra(s))`, 'Média']}
                  />
                  <Bar dataKey="Dias" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Estimativa de Tempo por Tipo de Contratação</h2>
          <p className="text-xs text-gray-500 mb-6">Tempo médio total, do início ao fim, considerando só processos concluídos/arquivados.</p>
          {mediaPorRito.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Ainda não há processos concluídos com histórico suficiente pra estimar.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mediaPorRito.map(i => ({ name: i.rito, Dias: Math.round(i.mediaDias), amostras: i.ocorrencias }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, _n, item) => [`${value} dias (${item.payload.amostras} amostra(s))`, 'Média']}
                  />
                  <Bar dataKey="Dias" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
