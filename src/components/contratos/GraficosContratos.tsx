import { addMonths, format, isBefore, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { formatarMoeda, type ContratoComStatus } from '../../lib/contratos';

const TOOLTIP_STYLE = {
  borderRadius: '0.5rem',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const CORES_SITUACAO: Record<string, string> = {
  'Vigente': '#059669',
  '< 90 Dias': '#d97706',
  '< 30 Dias': '#ea580c',
  'Vencido': '#dc2626',
  'Concluído': '#7c3aed',
};

/** Gráficos compartilhados por Gestão de Contratos e Fiscal do Contrato — situação, valor por fonte e vencimentos nos próximos 12 meses. */
export default function GraficosContratos({ contratos }: { contratos: ContratoComStatus[] }) {
  const dataSituacao = Object.entries(
    contratos.reduce<Record<string, number>>((acc, c) => {
      acc[c.badge] = (acc[c.badge] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const dataValorPorFonte = Object.entries(
    contratos.reduce<Record<string, number>>((acc, c) => {
      const chave = c.fonteRecurso?.trim() || 'Não informado';
      acc[chave] = (acc[chave] ?? 0) + (c.valorGlobal || 0);
      return acc;
    }, {}),
  )
    .map(([name, valor]) => ({ name, Valor: valor }))
    .sort((a, b) => b.Valor - a.Valor)
    .slice(0, 8);

  const hoje = startOfMonth(new Date());
  const proximos12Meses = Array.from({ length: 12 }, (_, i) => addMonths(hoje, i));
  const dataVencimentos = proximos12Meses.map((mes) => {
    const inicioMes = mes;
    const fimMes = addMonths(mes, 1);
    const quantidade = contratos.filter((c) => {
      if (c.concluido) return false;
      const fim = new Date(c.fimVigencia);
      if (Number.isNaN(fim.getTime())) return false;
      return !isBefore(fim, inicioMes) && isBefore(fim, fimMes);
    }).length;
    return { name: format(mes, 'MMM/yy', { locale: ptBR }), Vencimentos: quantidade };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-6">Situação dos Contratos</h2>
        {dataSituacao.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Nenhum contrato no escopo.</p>
        ) : (
          <div className="h-72 flex justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataSituacao} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                  {dataSituacao.map((entry) => (
                    <Cell key={entry.name} fill={CORES_SITUACAO[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend verticalAlign="bottom" height={48} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Valor Global por Fonte de Recurso</h2>
        <p className="text-xs text-gray-500 mb-6">Top 8 fontes com maior valor global contratado.</p>
        {dataValorPorFonte.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Nenhum contrato no escopo.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataValorPorFonte} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(v) => formatarMoeda(v)} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={140} tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatarMoeda(v)} />
                <Bar dataKey="Valor" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-1">Vencimentos nos Próximos 12 Meses</h2>
        <p className="text-xs text-gray-500 mb-6">Quantidade de contratos com fim de vigência em cada mês (não concluídos).</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataVencimentos} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="Vencimentos" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
