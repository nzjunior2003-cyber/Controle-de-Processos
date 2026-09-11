import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../context/AppContext';

const TOOLTIP_STYLE = {
  borderRadius: '0.5rem',
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

/** Agrupa por um campo de texto livre (ex.: "fase") e devolve as N maiores contagens, ordenadas. */
function contarPorFase(itens: { fase: string }[], limite = 8): { name: string; Quantidade: number }[] {
  const contagem = new Map<string, number>();
  itens.forEach((item) => {
    const chave = item.fase?.trim() || 'Sem fase informada';
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  });
  return Array.from(contagem.entries())
    .map(([name, Quantidade]) => ({ name, Quantidade }))
    .sort((a, b) => b.Quantidade - a.Quantidade)
    .slice(0, limite);
}

/**
 * Contagens gerais dos três tipos de registro do módulo Contratos e
 * ARP's (Procedimentos Licitatórios, Portarias de Fiscalização e
 * Processos Sancionatórios), com um recorte por fase/situação de
 * Procedimentos e Sancionatórios — Portarias não tem um campo de
 * fase/situação hoje, só a contagem total.
 */
export default function DashboardContratosArps() {
  const { procedimentos, portarias, sancionatorios } = useApp();

  const dataFaseProcedimentos = contarPorFase(procedimentos);
  const dataFaseSancionatorios = contarPorFase(sancionatorios);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Contratos e ARP&apos;s</h1>
        <p className="mt-1 text-sm text-gray-500">
          Procedimentos licitatórios, portarias de fiscalização e processos sancionatórios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Procedimentos Licitatórios</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{procedimentos.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Portarias de Fiscalização</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{portarias.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Processos Sancionatórios</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{sancionatorios.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Procedimentos por Fase</h2>
          <p className="text-xs text-gray-500 mb-6">Distribuição dos procedimentos licitatórios cadastrados.</p>
          {dataFaseProcedimentos.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhum procedimento cadastrado ainda.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataFaseProcedimentos}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="Quantidade" fill="#0284c7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Sancionatórios por Fase</h2>
          <p className="text-xs text-gray-500 mb-6">Distribuição dos processos sancionatórios cadastrados.</p>
          {dataFaseSancionatorios.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Nenhum processo sancionatório cadastrado ainda.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dataFaseSancionatorios}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="Quantidade" fill="#b91c1c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
