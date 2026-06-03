import React from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell, Legend } from 'recharts';

export default function Dashboard() {
  const { processos, setores } = useApp();

  const total = processos.length;
  const concluidos = processos.filter(p => p.status === 'concluido').length;
  const emAndamento = processos.filter(p => p.status === 'em_andamento').length;
  const comAlerta = processos.filter(p => p.possui_alerta).length;

  const dataFases = setores.map(s => ({
    name: s.sigla,
    Processos: processos.filter(p => p.fase_atual_id === s.id && p.status !== 'concluido').length
  }));

  const dataStatus = [
    { name: 'Em Andamento', value: emAndamento },
    { name: 'Concluídos', value: concluidos },
    { name: 'Com Pendência', value: processos.filter(p => p.status === 'pendente').length },
  ];

  const COLORS = ['#0284c7', '#059669', '#d97706'];

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
          <h2 className="text-lg font-medium text-gray-900 mb-6">Processos por Setor (Gargalo Atual)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataFases} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
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
                <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
