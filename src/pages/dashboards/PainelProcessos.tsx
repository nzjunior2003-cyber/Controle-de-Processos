import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlarmClock,
  ArrowDown,
  ArrowUp,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  FileCheck2,
  FilterX,
  Lightbulb,
  Search,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEtapasPorRito } from '../../hooks/useEtapasPorRito';
import { calcularProgressoChecklist } from '../../lib/fluxoProcesso';
import { formatarMoeda } from '../../lib/contratos';
import {
  ORDEM_STATUS_PAINEL,
  STATUS_PAINEL_META,
  calcularInsights,
  calcularKpis,
  contarPorDemandante,
  contarPorRito,
  contarPorSetorAtual,
  paraPainel,
  somarEstimadoPorNatureza,
  valoresUnicos,
  type ProcessoPainel,
  type StatusPainel,
} from '../../lib/painelProcessos';

const CORES = ['#b91c1c', '#0284c7', '#059669', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#4d7c0f'];
const TOOLTIP_STYLE = { borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const TAMANHO_PAGINA = 10;
const TODOS = '__todos__';

const compactar = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const encurtar = (t: string, max = 22) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
const formatarData = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR') : '—');

function EtiquetaStatus({ status }: { status: StatusPainel }) {
  const meta = STATUS_PAINEL_META[status];
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${meta.classe}`}>{meta.rotulo}</span>;
}

// ------------------------------------------------------------------ KPIs

interface CartaoKpi {
  chave: string;
  rotulo: string;
  valor: string;
  dica?: string;
  icone: LucideIcon;
  cor: string;
  clicavel?: boolean;
}

function Indicadores({
  processos,
  filtroContratado,
  alternarContratado,
}: {
  processos: ProcessoPainel[];
  filtroContratado: boolean;
  alternarContratado: () => void;
}) {
  const k = useMemo(() => calcularKpis(processos), [processos]);
  const cartoes: CartaoKpi[] = [
    { chave: 'ativos', rotulo: 'Processos ativos', valor: String(k.ativos), dica: `${k.total} no total`, icone: Activity, cor: 'bg-blue-100 text-blue-700' },
    { chave: 'contratado', rotulo: 'Contratado/Aditivado', valor: String(k.contratadosAditivados), dica: 'clique para filtrar a lista', icone: FileCheck2, cor: 'bg-emerald-100 text-emerald-700', clicavel: true },
    { chave: 'previstoPca', rotulo: 'Previstos no PCA', valor: String(k.previstosPca), icone: CalendarCheck2, cor: 'bg-gray-100 text-gray-700' },
    { chave: 'parados', rotulo: 'No mesmo setor +30 dias', valor: String(k.parados30), dica: 'processos ativos', icone: AlarmClock, cor: 'bg-red-100 text-red-700' },
    { chave: 'estimado', rotulo: 'V. estimado (ativos)', valor: compactar(k.somaEstimadoAtivos), dica: 'soma dos ativos', icone: Wallet, cor: 'bg-slate-100 text-slate-700' },
    { chave: 'semPca', rotulo: 'Sem previsão no PCA', valor: String(k.semPrevisaoPca), dica: 'requer atenção', icone: TriangleAlert, cor: 'bg-amber-100 text-amber-700' },
  ];
  return (
    <section aria-label="Indicadores principais" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cartoes.map((c) => {
        const ativo = c.chave === 'contratado' && filtroContratado;
        const conteudo = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-500">{c.rotulo}</p>
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${c.cor}`}>
                <c.icone className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{c.valor}</p>
            {c.dica && <p className="text-xs text-gray-500">{c.dica}</p>}
          </>
        );
        const base = 'bg-white rounded-lg border p-4 shadow-sm text-left';
        return c.clicavel ? (
          <button
            key={c.chave}
            type="button"
            aria-pressed={ativo}
            onClick={alternarContratado}
            className={`${base} cursor-pointer hover:shadow-md transition-shadow ${ativo ? 'ring-2 ring-red-600 border-red-200' : 'border-gray-200'}`}
          >
            {conteudo}
          </button>
        ) : (
          <div key={c.chave} className={`${base} border-gray-200`}>
            {conteudo}
          </div>
        );
      })}
    </section>
  );
}

// -------------------------------------------------------------- insights

function Insights({ processos }: { processos: ProcessoPainel[] }) {
  const insights = useMemo(() => calcularInsights(processos), [processos]);
  if (insights.length === 0) return null;
  const cor = { danger: 'border-red-200 bg-red-50 text-red-800', warn: 'border-amber-200 bg-amber-50 text-amber-800', info: 'border-blue-200 bg-blue-50 text-blue-800', ok: 'border-emerald-200 bg-emerald-50 text-emerald-800' } as const;
  return (
    <section aria-label="Insights" className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
        <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden /> Pontos de atenção
      </h3>
      <ul className="space-y-2">
        {insights.map((i) => (
          <li key={i.id} className={`rounded-md border px-3 py-2 text-sm ${cor[i.tom]}`}>
            {i.texto}
          </li>
        ))}
      </ul>
    </section>
  );
}

// -------------------------------------------------------------- gráficos

function GraficoBarras({ titulo, descricao, dados, cor, moeda = false }: { titulo: string; descricao: string; dados: { label: string; value: number }[]; cor: string; moeda?: boolean }) {
  const formatar = (v: number) => (moeda ? compactar(v) : String(v));
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      <p className="text-xs text-gray-500 mb-2">{descricao}</p>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ left: 8, right: moeda ? 48 : 28 }}>
            <CartesianGrid horizontal={false} stroke="#f3f4f6" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} tickFormatter={(v: string) => encurtar(v, 20)} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [moeda ? formatarMoeda(Number(v)) : String(v), titulo]} cursor={{ fill: '#f9fafb' }} />
            <Bar dataKey="value" fill={cor} radius={4}>
              <LabelList dataKey="value" position="right" formatter={(v: unknown) => formatar(Number(v))} className="fill-gray-700 text-xs" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Graficos({ processos }: { processos: ProcessoPainel[] }) {
  const setoresAtuais = useMemo(() => contarPorSetorAtual(processos, 10), [processos]);
  const demandantes = useMemo(() => contarPorDemandante(processos, 10), [processos]);
  const ritos = useMemo(() => contarPorRito(processos), [processos]);
  const naturezas = useMemo(() => somarEstimadoPorNatureza(processos), [processos]);
  return (
    <section aria-label="Gráficos" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <GraficoBarras titulo="Processos por setor atual" descricao="Top 10 setores com mais processos tramitando" dados={setoresAtuais} cor="#b91c1c" />
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Distribuição por rito processual</h3>
        <p className="text-xs text-gray-500 mb-2">Participação de cada rito no total</p>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie data={ritos} dataKey="value" nameKey="label" innerRadius={55} strokeWidth={2}>
                {ritos.map((r, i) => (
                  <Cell key={r.label} fill={CORES[i % CORES.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {ritos.map((r, i) => (
            <li key={r.label} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: CORES[i % CORES.length] }} aria-hidden />
              <span className="truncate">{r.label}</span>
              <span className="ml-auto font-medium tabular-nums text-gray-900">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <GraficoBarras titulo="Processos por setor demandante" descricao="Top 10 setores com mais processos" dados={demandantes} cor="#0284c7" />
      <GraficoBarras titulo="V. estimado por natureza de despesa" descricao="Soma do valor estimado agrupado por natureza" dados={naturezas} cor="#d97706" moeda />
    </section>
  );
}

// ---------------------------------------------------------------- tabela

type ChaveOrdem = 'pae' | 'setorAtual' | 'rito' | 'diasNoSetor' | 'tempoTotalDias' | 'progresso';
type Direcao = 'asc' | 'desc';

interface Filtros {
  status: string;
  rito: string;
  natureza: string;
  setor: string;
  fonte: string;
  previsao: string;
  demandante: string;
}
const FILTROS_INICIAIS: Filtros = { status: TODOS, rito: TODOS, natureza: TODOS, setor: TODOS, fonte: TODOS, previsao: TODOS, demandante: TODOS };

function comparar(a: ProcessoPainel, b: ProcessoPainel, chave: ChaveOrdem): number {
  switch (chave) {
    case 'diasNoSetor':
      return (a.diasNoSetor ?? -1) - (b.diasNoSetor ?? -1);
    case 'tempoTotalDias':
      return (a.tempoTotalDias ?? -1) - (b.tempoTotalDias ?? -1);
    case 'progresso':
      return (a.progresso ?? -1) - (b.progresso ?? -1);
    case 'setorAtual':
      return a.setorAtual.localeCompare(b.setorAtual, 'pt-BR');
    case 'rito':
      return a.ritoAgrupado.localeCompare(b.ritoAgrupado, 'pt-BR');
    default:
      return a.pae.localeCompare(b.pae, 'pt-BR', { numeric: true });
  }
}

function Seletor({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className="block w-full rounded-md border border-gray-300 bg-white py-1.5 px-2 text-sm focus:border-red-500 focus:ring-red-500">
        <option value={TODOS}>Todos</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function CabecalhoOrdenavel({ rotulo, ativo, direcao, onClick, alinharDireita = false }: { rotulo: string; ativo: boolean; direcao: Direcao; onClick: () => void; alinharDireita?: boolean }) {
  return (
    <th scope="col" className={`px-3 py-3 text-xs font-medium uppercase tracking-wider ${alinharDireita ? 'text-right' : 'text-left'} ${ativo ? 'text-gray-900' : 'text-gray-500'}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-gray-900">
        {rotulo}
        {ativo ? direcao === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
      </button>
    </th>
  );
}

function TabelaProcessos({ processos, aoAbrir }: { processos: ProcessoPainel[]; aoAbrir: (p: ProcessoPainel) => void }) {
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [chave, setChave] = useState<ChaveOrdem>('diasNoSetor');
  const [direcao, setDirecao] = useState<Direcao>('desc');
  const [pagina, setPagina] = useState(0);

  const opcoes = useMemo(
    () => ({
      rito: valoresUnicos(processos, (p) => p.ritoAgrupado),
      natureza: valoresUnicos(processos, (p) => p.natureza),
      setor: valoresUnicos(processos, (p) => p.setorAtual),
      fonte: valoresUnicos(processos, (p) => p.fonte),
      previsao: valoresUnicos(processos, (p) => p.previsaoPca),
      demandante: valoresUnicos(processos, (p) => p.demandante),
    }),
    [processos],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = processos.filter((p) => {
      if (termo && !`${p.pae} ${p.objeto} ${p.demandante} ${p.natureza} ${p.rito} ${p.setorAtualPath.join(' ')}`.toLowerCase().includes(termo)) return false;
      if (filtros.status !== TODOS && STATUS_PAINEL_META[p.status].rotulo !== filtros.status) return false;
      if (filtros.rito !== TODOS && p.ritoAgrupado !== filtros.rito) return false;
      if (filtros.natureza !== TODOS && p.natureza !== filtros.natureza) return false;
      if (filtros.setor !== TODOS && p.setorAtual !== filtros.setor) return false;
      if (filtros.fonte !== TODOS && p.fonte !== filtros.fonte) return false;
      if (filtros.previsao !== TODOS && p.previsaoPca !== filtros.previsao) return false;
      if (filtros.demandante !== TODOS && p.demandante !== filtros.demandante) return false;
      return true;
    });
    return [...lista].sort((a, b) => (direcao === 'asc' ? 1 : -1) * comparar(a, b, chave));
  }, [processos, busca, filtros, chave, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const itens = filtrados.slice(paginaAtual * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA + TAMANHO_PAGINA);
  const temFiltro = busca.trim() !== '' || Object.values(filtros).some((v) => v !== TODOS);

  const ordenar = (nova: ChaveOrdem) => {
    if (chave === nova) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setChave(nova);
      setDirecao(nova === 'diasNoSetor' || nova === 'tempoTotalDias' || nova === 'progresso' ? 'desc' : 'asc');
    }
    setPagina(0);
  };
  const mudarFiltro = (campo: keyof Filtros, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(0);
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4" aria-label="Lista de processos">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por Nº PAE, objeto, demandante, setor atual, natureza ou rito…"
            aria-label="Buscar processos"
            className="block w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-red-500 focus:ring-red-500"
          />
        </div>
        {temFiltro && (
          <button
            type="button"
            onClick={() => {
              setBusca('');
              setFiltros(FILTROS_INICIAIS);
              setPagina(0);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FilterX className="h-4 w-4" /> Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Seletor rotulo="Status" valor={filtros.status} opcoes={ORDEM_STATUS_PAINEL.map((s) => STATUS_PAINEL_META[s].rotulo)} onChange={(v) => mudarFiltro('status', v)} />
        <Seletor rotulo="Rito" valor={filtros.rito} opcoes={opcoes.rito} onChange={(v) => mudarFiltro('rito', v)} />
        <Seletor rotulo="Natureza" valor={filtros.natureza} opcoes={opcoes.natureza} onChange={(v) => mudarFiltro('natureza', v)} />
        <Seletor rotulo="Setor atual" valor={filtros.setor} opcoes={opcoes.setor} onChange={(v) => mudarFiltro('setor', v)} />
        <Seletor rotulo="Fonte" valor={filtros.fonte} opcoes={opcoes.fonte} onChange={(v) => mudarFiltro('fonte', v)} />
        <Seletor rotulo="Previsão PCA" valor={filtros.previsao} opcoes={opcoes.previsao} onChange={(v) => mudarFiltro('previsao', v)} />
        <Seletor rotulo="Demandante" valor={filtros.demandante} opcoes={opcoes.demandante} onChange={(v) => mudarFiltro('demandante', v)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <CabecalhoOrdenavel rotulo="Nº PAE" ativo={chave === 'pae'} direcao={direcao} onClick={() => ordenar('pae')} />
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 min-w-[240px]">Objeto</th>
              <CabecalhoOrdenavel rotulo="Setor atual" ativo={chave === 'setorAtual'} direcao={direcao} onClick={() => ordenar('setorAtual')} />
              <CabecalhoOrdenavel rotulo="Rito" ativo={chave === 'rito'} direcao={direcao} onClick={() => ordenar('rito')} />
              <CabecalhoOrdenavel rotulo="Dias no setor" ativo={chave === 'diasNoSetor'} direcao={direcao} onClick={() => ordenar('diasNoSetor')} alinharDireita />
              <CabecalhoOrdenavel rotulo="Tempo total" ativo={chave === 'tempoTotalDias'} direcao={direcao} onClick={() => ordenar('tempoTotalDias')} alinharDireita />
              <CabecalhoOrdenavel rotulo="Checklist" ativo={chave === 'progresso'} direcao={direcao} onClick={() => ordenar('progresso')} alinharDireita />
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {itens.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-32 text-center text-sm text-gray-500">Nenhum processo encontrado com os filtros atuais.</td>
              </tr>
            ) : (
              itens.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => aoAbrir(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      aoAbrir(p);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{p.pae || '—'}</td>
                  <td className="px-3 py-3 max-w-[320px]"><span className="line-clamp-2 text-sm text-gray-900">{p.objeto || '—'}</span></td>
                  <td className="px-3 py-3 max-w-[180px]"><span className="line-clamp-2 text-xs text-gray-600">{p.setorAtual || '—'}</span></td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{p.ritoAgrupado || '—'}</td>
                  <td className="px-3 py-3 text-right text-sm tabular-nums">{p.diasNoSetor ?? '—'}</td>
                  <td className="px-3 py-3 text-right text-sm tabular-nums">{p.tempoTotalDias ?? '—'}</td>
                  <td className="px-3 py-3 text-right text-sm tabular-nums">{p.progresso != null ? `${p.progresso}%` : '—'}</td>
                  <td className="px-3 py-3"><EtiquetaStatus status={p.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {filtrados.length} processo(s) • página {paginaAtual + 1} de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={paginaAtual === 0} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <button type="button" onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={paginaAtual >= totalPaginas - 1} className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- detalhe

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{rotulo}</dt>
      <dd className="text-sm text-gray-900 break-words">{children || '—'}</dd>
    </div>
  );
}

function PainelDetalhe({ processo, aoFechar }: { processo: ProcessoPainel; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40" onClick={aoFechar}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Detalhes do processo">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <EtiquetaStatus status={processo.status} />
              {processo.progresso != null && <span className="text-xs text-gray-500">Checklist {processo.progresso}%</span>}
            </div>
            <h2 className="font-mono text-base font-semibold text-gray-900">{processo.pae || '—'}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{processo.objeto || 'Sem descrição'}</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-5 p-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">Setor atual</p>
            {processo.setorAtualPath.length > 0 ? (
              <nav aria-label="Caminho do setor atual" className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-2">
                {processo.setorAtualPath.map((seg, i) => (
                  <span key={`${seg}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden />}
                    <span className={i === processo.setorAtualPath.length - 1 ? 'text-sm font-medium text-gray-900' : 'text-sm text-gray-500'}>{seg}</span>
                  </span>
                ))}
              </nav>
            ) : (
              <span className="text-sm text-gray-500">—</span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Campo rotulo="Andamento">{processo.andamento}</Campo>
            <Campo rotulo="Dias no setor">{processo.diasNoSetor != null ? `${processo.diasNoSetor} dias` : ''}</Campo>
            <Campo rotulo="Demandante">{processo.demandante}</Campo>
            <Campo rotulo="Natureza de despesa">{processo.natureza}</Campo>
            <Campo rotulo="Rito processual">{processo.rito}</Campo>
            <Campo rotulo="Fonte">{processo.fonte}</Campo>
            <Campo rotulo="Fase">{processo.fase}</Campo>
            <Campo rotulo="Subfase">{processo.subfase}</Campo>
            <Campo rotulo="Previsão no PCA">{processo.previsaoPca}</Campo>
            <Campo rotulo="V. estimado">{processo.vEstimado != null ? formatarMoeda(processo.vEstimado) : ''}</Campo>
            <Campo rotulo="Data de entrada">{formatarData(processo.dataEntrada)}</Campo>
            <Campo rotulo="Última tramitação">{formatarData(processo.ultimaTramitacao)}</Campo>
            <Campo rotulo="Tempo total">{processo.tempoTotalDias != null ? `${processo.tempoTotalDias} dias` : ''}</Campo>
          </dl>
          {processo.descricao && (
            <div>
              <p className="text-xs font-medium text-gray-500">Observação</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{processo.descricao}</p>
            </div>
          )}
          <Link to={`/sistema/processos/${processo.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800">
            Abrir o processo no sistema <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ página

/**
 * Painel de Processos: indicadores, pontos de atenção, gráficos e a lista
 * filtrável de todos os processos — o antigo dashboard externo (planilha →
 * GitHub Pages) agora lê os dados do próprio sistema, então atualiza sozinho.
 */
export default function PainelProcessos() {
  const { processos } = useApp();
  const etapasPorRito = useEtapasPorRito();
  const [apenasContratados, setApenasContratados] = useState(false);
  const [selecionado, setSelecionado] = useState<ProcessoPainel | null>(null);

  const todos = useMemo(() => {
    const hoje = new Date();
    return processos.map((p) => paraPainel(p, calcularProgressoChecklist(p, etapasPorRito), hoje));
  }, [processos, etapasPorRito]);

  const naLista = useMemo(() => (apenasContratados ? todos.filter((p) => p.status === 'contratado') : todos), [todos, apenasContratados]);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Painel de Processos</h2>
        <p className="text-sm text-gray-500">Acompanhamento dos processos de compras e contratações ({todos.length} processos).</p>
      </div>

      <Indicadores processos={todos} filtroContratado={apenasContratados} alternarContratado={() => setApenasContratados((v) => !v)} />
      <Insights processos={todos} />
      <Graficos processos={todos} />

      {apenasContratados && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <span>Lista filtrada: só processos contratados/aditivados ({naLista.length}).</span>
          <button type="button" onClick={() => setApenasContratados(false)} className="font-medium hover:underline">
            Remover filtro
          </button>
        </div>
      )}

      <TabelaProcessos processos={naLista} aoAbrir={setSelecionado} />
      {selecionado && <PainelDetalhe processo={selecionado} aoFechar={() => setSelecionado(null)} />}
    </div>
  );
}
