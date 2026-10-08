import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDollarSign,
  FileCheck2,
  FileX2,
  FilterX,
  Landmark,
  Lightbulb,
  ListChecks,
  Search,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import {
  FILTROS_PCA_VAZIOS,
  STATUS_PCA_META,
  calcularInsightsPca,
  calcularKpisPca,
  empilhadoPorDemandante,
  empilhadoPorFonte,
  fatiasPizza,
  filtrosAtivosPca,
  paesContratados,
  paraItemPca,
  passaFiltrosPca,
  valoresUnicosPca,
  type FiltrosPca,
  type ItemPca,
  type StatusPca,
} from '../../lib/painelPca';

const COR_COM_PAE = '#34a56f';
const COR_SEM_PAE = '#9ca3af';
const TOOLTIP_STYLE = { borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const TAMANHO_PAGINA = 10;
const encurtar = (t: string, max = 22) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

function EtiquetaStatus({ status }: { status: StatusPca }) {
  const meta = STATUS_PCA_META[status];
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
  valorLongo?: boolean;
  filtro?: 'Com PAE' | 'Sem PAE';
}

function Indicadores({ itens, temPae, alternarTemPae }: { itens: ItemPca[]; temPae: string[]; alternarTemPae: (v: 'Com PAE' | 'Sem PAE') => void }) {
  const k = useMemo(() => calcularKpisPca(itens), [itens]);
  const cartoes: CartaoKpi[] = [
    { chave: 'total', rotulo: 'Itens do PCA', valor: String(k.totalItens), dica: `${formatarMoeda(k.valorTotalEstimado)} estimado`, icone: ListChecks, cor: 'bg-blue-100 text-blue-700' },
    { chave: 'comPae', rotulo: 'Com PAE aberto', valor: String(k.itensComPae), dica: 'clique para filtrar a lista', icone: FileCheck2, cor: 'bg-emerald-100 text-emerald-700', filtro: 'Com PAE' },
    { chave: 'semPae', rotulo: 'Sem PAE', valor: String(k.itensSemPae), dica: 'clique para filtrar a lista', icone: FileX2, cor: 'bg-gray-100 text-gray-700', filtro: 'Sem PAE' },
    { chave: 'altaSemPae', rotulo: 'Alta prioridade sem PAE', valor: String(k.altaPrioridadeSemPae), dica: 'requer atenção', icone: TriangleAlert, cor: 'bg-amber-100 text-amber-700' },
    { chave: 'valorTotal', rotulo: 'Valor total estimado', valor: formatarMoeda(k.valorTotalEstimado), dica: 'todos os itens do PCA', icone: Wallet, cor: 'bg-slate-100 text-slate-700', valorLongo: true },
    { chave: 'valorRecurso', rotulo: 'Valor do Recurso', valor: formatarMoeda(k.valorRecurso), dica: 'recurso provável', icone: CircleDollarSign, cor: 'bg-blue-100 text-blue-700', valorLongo: true },
    { chave: 'valorSemPae', rotulo: 'Valor sem PAE', valor: formatarMoeda(k.valorSemPae), dica: 'ainda não processado', icone: Landmark, cor: 'bg-red-100 text-red-700', valorLongo: true },
  ];
  return (
    <section aria-label="Indicadores principais" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cartoes.map((c) => {
        const ativo = !!c.filtro && temPae.includes(c.filtro);
        const conteudo = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-500">{c.rotulo}</p>
              <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${c.cor}`}>
                <c.icone className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className={`mt-1 font-semibold tabular-nums text-gray-900 whitespace-nowrap ${c.valorLongo ? 'text-base sm:text-lg' : 'text-2xl'}`}>{c.valor}</p>
            {c.dica && <p className="text-xs text-gray-500">{c.dica}</p>}
          </>
        );
        const base = 'bg-white rounded-lg border p-4 shadow-sm text-left';
        return c.filtro ? (
          <button key={c.chave} type="button" aria-pressed={ativo} onClick={() => alternarTemPae(c.filtro as 'Com PAE' | 'Sem PAE')} className={`${base} cursor-pointer hover:shadow-md transition-shadow ${ativo ? 'ring-2 ring-red-600 border-red-200' : 'border-gray-200'}`}>
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

function Insights({ itens }: { itens: ItemPca[] }) {
  const insights = useMemo(() => calcularInsightsPca(itens), [itens]);
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

// --------------------------------------------------------------- filtros

function SeletorMultiplo({ rotulo, selecionados, opcoes, onChange }: { rotulo: string; selecionados: string[]; opcoes: string[]; onChange: (v: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);
  const alternar = (o: string) => onChange(selecionados.includes(o) ? selecionados.filter((x) => x !== o) : [...selecionados, o]);
  return (
    <div ref={caixa} className="relative">
      <span className="block text-xs font-medium text-gray-500 mb-1">{rotulo}</span>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`flex w-full items-center justify-between gap-1 rounded-md border bg-white py-1.5 px-2 text-sm ${selecionados.length > 0 ? 'border-red-300 text-gray-900' : 'border-gray-300 text-gray-600'}`}>
        <span className="truncate">{selecionados.length === 0 ? 'Todos' : selecionados.length === 1 ? selecionados[0] : `${selecionados.length} selecionados`}</span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
      </button>
      {aberto && (
        <div className="absolute z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {opcoes.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-500">Sem opções</p>}
          {opcoes.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
              <input type="checkbox" checked={selecionados.includes(o)} onChange={() => alternar(o)} className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" />
              <span className="truncate">{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- gráficos

function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: i.cor }} aria-hidden />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

function CartaoPizza({ titulo, fatias, totalNoFiltro }: { titulo: string; fatias: ReturnType<typeof fatiasPizza>; totalNoFiltro: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      <p className="text-xs text-gray-500">% e quantidade — % do filtro e % do total geral na legenda</p>
      <p className="mt-2 text-center text-2xl font-semibold text-gray-900">{totalNoFiltro}</p>
      <p className="-mt-0.5 mb-1 text-center text-xs text-gray-500">itens no filtro selecionado</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Pie data={fatias} dataKey="valor" nameKey="rotulo" innerRadius={50} outerRadius={85} strokeWidth={2}>
              {fatias.map((f) => (
                <Cell key={f.chave} fill={f.cor} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {fatias.map((f) => (
          <li key={f.chave} className="flex items-start gap-1.5 text-xs">
            <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: f.cor }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-gray-900">{f.rotulo}</span>
                <span className="font-medium text-gray-900">{f.valor}</span>
              </div>
              <p className="text-gray-500">
                {f.pctFiltro}% do filtro · {f.pctTotal.toFixed(0)}% do total geral
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Graficos({ itens, totalGeral }: { itens: ItemPca[]; totalGeral: number }) {
  const demandantes = useMemo(() => empilhadoPorDemandante(itens, 10), [itens]);
  const fontes = useMemo(() => empilhadoPorFonte(itens, 12), [itens]);
  const statusFatias = useMemo(
    () =>
      fatiasPizza(
        itens,
        totalGeral,
        (['aguardando', 'andamento', 'contratado'] as StatusPca[]).map((s) => ({ chave: s, rotulo: STATUS_PCA_META[s].rotulo, cor: STATUS_PCA_META[s].cor, pertence: (i: ItemPca) => i.status === s })),
      ),
    [itens, totalGeral],
  );
  const paeFatias = useMemo(
    () =>
      fatiasPizza(itens, totalGeral, [
        { chave: 'com', rotulo: 'Com PAE', cor: COR_COM_PAE, pertence: (i) => i.temPae },
        { chave: 'sem', rotulo: 'Sem PAE', cor: COR_SEM_PAE, pertence: (i) => !i.temPae },
      ]),
    [itens, totalGeral],
  );

  return (
    <section aria-label="Gráficos" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Itens por demandante</h3>
        <p className="text-xs text-gray-500 mb-2">Top 10 setores — com PAE e sem PAE</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandantes} layout="vertical" margin={{ left: 8, right: 32 }}>
              <CartesianGrid horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="demandante" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} tickFormatter={(v: string) => encurtar(v, 20)} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="comPae" name="Com PAE" stackId="v" fill={COR_COM_PAE} radius={[4, 0, 0, 4]} />
              <Bar dataKey="semPae" name="Sem PAE" stackId="v" fill={COR_SEM_PAE} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" className="fill-gray-700 text-xs" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legenda itens={[{ cor: COR_COM_PAE, rotulo: 'Com PAE' }, { cor: COR_SEM_PAE, rotulo: 'Sem PAE' }]} />
      </div>

      <CartaoPizza titulo="Itens com PAE vs sem PAE" fatias={paeFatias} totalNoFiltro={itens.length} />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900">Valor do Recurso por fonte</h3>
        <p className="text-xs text-gray-500 mb-2">Empilhado por status — passe o mouse para ver o nº de itens</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fontes} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="fonte" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} tickFormatter={(v: string) => encurtar(v, 20)} />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as ReturnType<typeof empilhadoPorFonte>[number];
                  const linhas: { chave: StatusPca; valor: number; qtd: number }[] = [
                    { chave: 'aguardando', valor: d.aguardandoValor, qtd: d.aguardandoQtd },
                    { chave: 'andamento', valor: d.andamentoValor, qtd: d.andamentoQtd },
                    { chave: 'contratado', valor: d.contratadoValor, qtd: d.contratadoQtd },
                  ];
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white p-2.5 text-xs shadow-md">
                      <p className="mb-1.5 font-medium text-gray-900">{d.fonte}</p>
                      {linhas.map((l) => (
                        <div key={l.chave} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_PCA_META[l.chave].cor }} />
                          <span className="text-gray-500">{STATUS_PCA_META[l.chave].rotulo}:</span>
                          <span className="font-medium text-gray-900">{formatarMoeda(l.valor)} ({l.qtd} itens)</span>
                        </div>
                      ))}
                      <div className="mt-1.5 border-t border-gray-200 pt-1.5 font-medium text-gray-900">Total: {formatarMoeda(d.total)} ({d.totalQtd} itens)</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="aguardandoValor" stackId="v" fill={STATUS_PCA_META.aguardando.cor} radius={[4, 0, 0, 4]} />
              <Bar dataKey="andamentoValor" stackId="v" fill={STATUS_PCA_META.andamento.cor} />
              <Bar dataKey="contratadoValor" stackId="v" fill={STATUS_PCA_META.contratado.cor} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" className="fill-gray-700 text-xs" formatter={(v: unknown) => formatarMoeda(Number(v))} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legenda itens={(['aguardando', 'andamento', 'contratado'] as StatusPca[]).map((s) => ({ cor: STATUS_PCA_META[s].cor, rotulo: STATUS_PCA_META[s].rotulo }))} />
      </div>

      <CartaoPizza titulo="Distribuição por status" fatias={statusFatias} totalNoFiltro={itens.length} />
    </section>
  );
}

// ---------------------------------------------------------------- tabela

type ChaveOrdem = 'ordem' | 'demandante' | 'descricao' | 'prioridade' | 'valorTotal' | 'status';
type Direcao = 'asc' | 'desc';
const PESO_PRIORIDADE: Record<string, number> = { ALTA: 3, 'MÉDIA': 2, BAIXA: 1, 'NÃO INFORMADA': 0 };
const PESO_STATUS: Record<StatusPca, number> = { aguardando: 0, andamento: 1, contratado: 2 };

function comparar(a: ItemPca, b: ItemPca, chave: ChaveOrdem): number {
  switch (chave) {
    case 'valorTotal':
      return (a.valorTotalEstimado ?? -1) - (b.valorTotalEstimado ?? -1);
    case 'prioridade':
      return PESO_PRIORIDADE[a.prioridadeKey] - PESO_PRIORIDADE[b.prioridadeKey];
    case 'status':
      return PESO_STATUS[a.status] - PESO_STATUS[b.status];
    case 'demandante':
      return a.demandante.localeCompare(b.demandante, 'pt-BR');
    case 'descricao':
      return a.descricao.localeCompare(b.descricao, 'pt-BR');
    default:
      return a.ordem.localeCompare(b.ordem, 'pt-BR', { numeric: true });
  }
}

function Cabecalho({ rotulo, ativo, direcao, onClick, direita = false }: { rotulo: string; ativo: boolean; direcao: Direcao; onClick: () => void; direita?: boolean }) {
  return (
    <th scope="col" className={`px-3 py-3 text-xs font-medium uppercase tracking-wider ${direita ? 'text-right' : 'text-left'} ${ativo ? 'text-gray-900' : 'text-gray-500'}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-gray-900">
        {rotulo}
        {ativo ? direcao === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
      </button>
    </th>
  );
}

function TabelaItens({ itens, aoAbrir }: { itens: ItemPca[]; aoAbrir: (i: ItemPca) => void }) {
  const [busca, setBusca] = useState('');
  const [chave, setChave] = useState<ChaveOrdem>('ordem');
  const [direcao, setDirecao] = useState<Direcao>('asc');
  const [pagina, setPagina] = useState(0);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo ? itens.filter((i) => `${i.ordem} ${i.descricao} ${i.demandante} ${i.grupo} ${i.fonteRecurso} ${i.paeRaw}`.toLowerCase().includes(termo)) : itens;
    return [...lista].sort((a, b) => (direcao === 'asc' ? 1 : -1) * comparar(a, b, chave));
  }, [itens, busca, chave, direcao]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(paginaAtual * TAMANHO_PAGINA, paginaAtual * TAMANHO_PAGINA + TAMANHO_PAGINA);
  const ordenar = (nova: ChaveOrdem) => {
    if (chave === nova) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setChave(nova);
      setDirecao(nova === 'valorTotal' || nova === 'prioridade' ? 'desc' : 'asc');
    }
    setPagina(0);
  };

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4" aria-label="Itens do PCA">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
          placeholder="Buscar por ordem, descrição, demandante, grupo, fonte ou PAE…"
          aria-label="Buscar itens do PCA"
          className="block w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-red-500 focus:ring-red-500"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Cabecalho rotulo="Ordem" ativo={chave === 'ordem'} direcao={direcao} onClick={() => ordenar('ordem')} />
              <Cabecalho rotulo="Descrição" ativo={chave === 'descricao'} direcao={direcao} onClick={() => ordenar('descricao')} />
              <Cabecalho rotulo="Demandante" ativo={chave === 'demandante'} direcao={direcao} onClick={() => ordenar('demandante')} />
              <Cabecalho rotulo="Prioridade" ativo={chave === 'prioridade'} direcao={direcao} onClick={() => ordenar('prioridade')} />
              <Cabecalho rotulo="Valor estimado" ativo={chave === 'valorTotal'} direcao={direcao} onClick={() => ordenar('valorTotal')} direita />
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">PAE</th>
              <Cabecalho rotulo="Status" ativo={chave === 'status'} direcao={direcao} onClick={() => ordenar('status')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-32 text-center text-sm text-gray-500">Nenhum item encontrado com os filtros atuais.</td>
              </tr>
            ) : (
              visiveis.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => aoAbrir(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      aoAbrir(i);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{i.ordem || '—'}</td>
                  <td className="px-3 py-3 max-w-[320px]"><span className="line-clamp-2 text-sm text-gray-900">{i.descricao || '—'}</span></td>
                  <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{i.demandante || '—'}</td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">{i.prioridadeKey === 'NÃO INFORMADA' ? '—' : i.prioridadeKey}</td>
                  <td className="px-3 py-3 text-right text-sm tabular-nums whitespace-nowrap">{i.valorTotalEstimado != null ? formatarMoeda(i.valorTotalEstimado) : '—'}</td>
                  <td className="px-3 py-3 font-mono text-xs">{i.paeList.join(', ') || '—'}</td>
                  <td className="px-3 py-3"><EtiquetaStatus status={i.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{filtrados.length} item(ns) • página {paginaAtual + 1} de {totalPaginas}</p>
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

function PainelDetalhe({ item, processosPorPae, aoFechar }: { item: ItemPca; processosPorPae: Map<string, string>; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40" onClick={aoFechar}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Detalhes do item do PCA">
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 p-4">
          <div className="space-y-1.5">
            <EtiquetaStatus status={item.status} />
            <h2 className="text-base font-semibold text-gray-900">Item {item.ordem || '—'}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{item.descricao || 'Sem descrição'}</p>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="space-y-5 p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Campo rotulo="Demandante">{item.demandante}</Campo>
            <Campo rotulo="Origem">{item.origem}</Campo>
            <Campo rotulo="Item / Subitem">{[item.item, item.subitem].filter(Boolean).join(' / ')}</Campo>
            <Campo rotulo="Grupo">{item.grupo}</Campo>
            <Campo rotulo="Quantidade">{item.quantidade}</Campo>
            <Campo rotulo="Valor unitário">{item.valorUnitario != null ? formatarMoeda(item.valorUnitario) : ''}</Campo>
            <Campo rotulo="Valor estimado">{item.valorTotalEstimado != null ? formatarMoeda(item.valorTotalEstimado) : ''}</Campo>
            <Campo rotulo="Valor do recurso">{item.valorRecurso != null ? formatarMoeda(item.valorRecurso) : ''}</Campo>
            <Campo rotulo="Fonte do recurso">{item.fonteRecurso}</Campo>
            <Campo rotulo="Prioridade">{item.prioridadeKey === 'NÃO INFORMADA' ? '' : item.prioridadeKey}</Campo>
            <Campo rotulo="Data desejada">{item.dataDesejada}</Campo>
            <Campo rotulo="Contrato novo">{item.contratoNovo === undefined ? '' : item.contratoNovo ? 'Sim' : 'Não'}</Campo>
            <Campo rotulo="Modalidade / rito">{item.modalidade}</Campo>
          </dl>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">PAE(s)</p>
            {item.paeList.length === 0 ? (
              <p className="text-sm text-gray-500">Sem PAE aberto.</p>
            ) : (
              <ul className="space-y-1">
                {item.paeList.map((pae) => {
                  const id = processosPorPae.get(pae.replace(/^E-/, ''));
                  return (
                    <li key={pae} className="text-sm">
                      <span className="font-mono">{pae}</span>{' '}
                      {id ? (
                        <Link to={`/sistema/processos/${id}`} className="text-red-700 hover:underline">abrir processo</Link>
                      ) : (
                        <span className="text-xs text-gray-500">(processo não encontrado no sistema)</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ página

/**
 * Painel do PCA: indicadores, pontos de atenção, gráficos e a lista filtrável
 * dos itens do Plano de Contratações — o antigo dashboard externo agora lê o
 * PCA e os processos do próprio sistema (o status do item vem do processo
 * ligado pelo nº do PAE: contratado, em andamento ou aguardando instrução).
 */
export default function PainelPca() {
  const { pcas, processos } = useApp();
  const [filtros, setFiltros] = useState<FiltrosPca>(FILTROS_PCA_VAZIOS);
  const [selecionado, setSelecionado] = useState<ItemPca | null>(null);

  const todos = useMemo(() => {
    const contratados = paesContratados(processos);
    return pcas.map((p) => paraItemPca(p, contratados));
  }, [pcas, processos]);

  const processosPorPae = useMemo(() => new Map(processos.map((p) => [p.numero_processo, p.id])), [processos]);
  const filtrados = useMemo(() => todos.filter((i) => passaFiltrosPca(i, filtros)), [todos, filtros]);
  const opcoes = useMemo(
    () => ({
      demandante: valoresUnicosPca(todos, (i) => i.demandante),
      fonte: valoresUnicosPca(todos, (i) => i.fonteRecurso),
      grupo: valoresUnicosPca(todos, (i) => i.grupo),
      qdqq: valoresUnicosPca(todos, (i) => i.dataDesejada),
    }),
    [todos],
  );

  const alternarTemPae = (valor: 'Com PAE' | 'Sem PAE') =>
    setFiltros((f) => ({ ...f, temPae: f.temPae.includes(valor) ? f.temPae.filter((v) => v !== valor) : [...f.temPae, valor] }));
  const ativos = filtrosAtivosPca(filtros);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Painel do PCA</h2>
        <p className="text-sm text-gray-500">Plano de Contratações Anual — {todos.length} itens.</p>
      </div>

      {todos.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Nenhum item do PCA cadastrado ainda. Cadastre ou sincronize o PCA no módulo de Aquisições para ver o painel.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <SeletorMultiplo rotulo="Demandante" selecionados={filtros.demandante} opcoes={opcoes.demandante} onChange={(v) => setFiltros((f) => ({ ...f, demandante: v }))} />
              <SeletorMultiplo rotulo="Status" selecionados={filtros.status} opcoes={(['aguardando', 'andamento', 'contratado'] as StatusPca[]).map((s) => STATUS_PCA_META[s].rotulo)} onChange={(v) => setFiltros((f) => ({ ...f, status: v }))} />
              <SeletorMultiplo rotulo="Fonte" selecionados={filtros.fonte} opcoes={opcoes.fonte} onChange={(v) => setFiltros((f) => ({ ...f, fonte: v }))} />
              <SeletorMultiplo rotulo="Grupo" selecionados={filtros.grupo} opcoes={opcoes.grupo} onChange={(v) => setFiltros((f) => ({ ...f, grupo: v }))} />
              <SeletorMultiplo rotulo="Com / Sem PAE" selecionados={filtros.temPae} opcoes={['Com PAE', 'Sem PAE']} onChange={(v) => setFiltros((f) => ({ ...f, temPae: v }))} />
              <SeletorMultiplo rotulo="Data desejada" selecionados={filtros.qdqq} opcoes={opcoes.qdqq} onChange={(v) => setFiltros((f) => ({ ...f, qdqq: v }))} />
            </div>
            {ativos > 0 && (
              <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                <span>{ativos} filtro(s) ativo(s) — {filtrados.length} de {todos.length} itens.</span>
                <button type="button" onClick={() => setFiltros(FILTROS_PCA_VAZIOS)} className="inline-flex items-center gap-1.5 text-red-700 hover:underline">
                  <FilterX className="h-4 w-4" /> Limpar filtros
                </button>
              </div>
            )}
          </div>

          <Indicadores itens={filtrados} temPae={filtros.temPae} alternarTemPae={alternarTemPae} />
          <Insights itens={filtrados} />
          <Graficos itens={filtrados} totalGeral={todos.length} />
          <TabelaItens itens={filtrados} aoAbrir={setSelecionado} />
          {selecionado && <PainelDetalhe item={selecionado} processosPorPae={processosPorPae} aoFechar={() => setSelecionado(null)} />}
        </>
      )}
    </div>
  );
}
