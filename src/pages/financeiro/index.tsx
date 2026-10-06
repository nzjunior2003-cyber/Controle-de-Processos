import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DollarSign, PlusCircle, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import {
  competenciaDoPagamento,
  descreverAndamento,
  filaAPagar,
  pagamentosAtivos,
  saldoDaDotacao,
  statusDoPagamento,
  valorDoPagamento,
} from '../../lib/financeiro';
import { STATUS_PAGAMENTO_LABELS, type StatusPagamento } from '../../types';
import FichaContrato from './FichaContrato';
import { casaBusca, criarBuscaVinculada } from '../../lib/buscaVinculada';
import ControleOrcamentario from './ControleOrcamentario';
import FilaAPagar from './FilaAPagar';
import AndamentoRapidoModal from './AndamentoRapidoModal';
import FiltroPeriodo from '../../components/financeiro/FiltroPeriodo';
import { FILTRO_PERIODO_VAZIO, competenciaNoPeriodo, type FiltroPeriodo as TipoFiltroPeriodo } from '../../lib/periodo';

type Aba = 'a-pagar' | 'pagamentos' | 'empenhos' | 'dotacoes' | 'ficha' | 'orcamento';
const ABAS_VALIDAS: Aba[] = ['a-pagar', 'pagamentos', 'empenhos', 'dotacoes', 'ficha', 'orcamento'];

const CORES_STATUS: Record<StatusPagamento, string> = {
  em_tramitacao: 'bg-amber-50 text-amber-700',
  pago: 'bg-emerald-50 text-emerald-700',
  arquivado: 'bg-gray-100 text-gray-500',
};

const formatarMes = (competencia: string) => (competencia ? `${competencia.slice(5, 7)}/${competencia.slice(0, 4)}` : '-');

/**
 * Módulo Financeiro — alimentado pela Diretoria de Finanças: pagamentos
 * (processo de cada fatura, com PAE, NFs, NEs, OBs e andamento), notas de
 * empenho (origem e reforços), dotações orçamentárias e a ficha de controle
 * por contrato. Saldos e totais são sempre calculados (src/lib/financeiro.ts).
 */
export default function Financeiro() {
  const { pagamentos, dotacoes, empenhos, contratos, usuarioAtual, processos, procedimentos, execucoes } = useApp();
  const buscaVinculada = useMemo(
    () => criarBuscaVinculada({ processos, contratos, procedimentos }),
    [processos, contratos, procedimentos],
  );
  const navigate = useNavigate();
  const isMasterOuFinanceiro = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'financeiro';

  const [searchParams] = useSearchParams();
  const abaDaUrl = searchParams.get('aba') as Aba | null;
  const [aba, setAba] = useState<Aba>(abaDaUrl && ABAS_VALIDAS.includes(abaDaUrl) ? abaDaUrl : 'pagamentos');
  const [periodo, setPeriodo] = useState<TipoFiltroPeriodo>(FILTRO_PERIODO_VAZIO);
  const [pagamentoAndamento, setPagamentoAndamento] = useState<(typeof pagamentos)[number] | null>(null);
  const qtdAPagar = useMemo(() => filaAPagar(execucoes, pagamentos).length, [execucoes, pagamentos]);
  // Anos que existem nos dados (e o atual) — opções do filtro de período.
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>([new Date().getFullYear()]);
    pagamentos.forEach((p) => { const a = Number(competenciaDoPagamento(p).slice(0, 4)); if (a) anos.add(a); });
    empenhos.forEach((e) => anos.add(e.exercicio));
    dotacoes.forEach((d) => anos.add(d.exercicio));
    return Array.from(anos).sort((a, b) => b - a);
  }, [pagamentos, empenhos, dotacoes]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusPagamento | ''>('');

  const contratoPorId = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);
  const empenhoPorId = useMemo(() => new Map(empenhos.map((e) => [e.id, e])), [empenhos]);

  const textoContrato = (contratoId: string) => {
    const contrato = contratoPorId.get(contratoId);
    return contrato ? `${contrato.numero} — ${contrato.empresa}` : 'Contrato não encontrado';
  };
  const numerosNe = (p: (typeof pagamentos)[number]) => {
    const numeros = (p.empenhoIds ?? []).map((idNe) => empenhoPorId.get(idNe)?.numero).filter(Boolean);
    return numeros.length > 0 ? numeros : p.numeroEmpenho ? [p.numeroEmpenho] : [];
  };
  const numerosOb = (p: (typeof pagamentos)[number]) => {
    const numeros = (p.ordensBancarias ?? []).map((o) => o.numero);
    return numeros.length > 0 ? numeros : p.numeroOrdemPagamento ? [p.numeroOrdemPagamento] : [];
  };

  const pagamentosFiltrados = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return pagamentos
      .filter((p) => !filtroStatus || statusDoPagamento(p) === filtroStatus)
      .filter((p) => competenciaNoPeriodo(competenciaDoPagamento(p), periodo))
      .filter((p) => {
        if (!buscaNormalizada) return true;
        const contrato = contratoPorId.get(p.contratoId);
        const textos = [
          p.paeFatura, p.fonteRecurso, p.setorAtual, p.etapa, contrato?.numero, contrato?.empresa,
          ...(p.documentos ?? []).map((d) => d.numero),
          ...numerosNe(p), ...numerosOb(p),
        ];
        return (
          textos.some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada)) ||
          (!!contrato && casaBusca(buscaVinculada.textoDoContrato(contrato), busca))
        );
      })
      .sort((a, b) => competenciaDoPagamento(b).localeCompare(competenciaDoPagamento(a)));
    // numerosNe/numerosOb dependem só de empenhoPorId, já listado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagamentos, busca, filtroStatus, periodo, contratoPorId, empenhoPorId, buscaVinculada]);

  const empenhosFiltrados = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return empenhos
      .filter((e) => periodo.anos.length === 0 || periodo.anos.includes(e.exercicio))
      .filter((e) => {
        if (!buscaNormalizada) return true;
        const contrato = contratoPorId.get(e.contratoId);
        return [e.numero, e.paeOrigem, contrato?.numero, contrato?.empresa]
          .some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => b.exercicio - a.exercicio || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
  }, [empenhos, busca, contratoPorId, periodo.anos]);

  const dotacoesFiltradas = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return dotacoes
      .filter((d) => periodo.anos.length === 0 || periodo.anos.includes(d.exercicio))
      .filter((d) => {
        if (!buscaNormalizada) return true;
        return [d.codigo, d.descricao, d.fonteRecurso, d.fonteCodigo, d.funcionalProgramatica, d.planoInterno]
          .some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => b.exercicio - a.exercicio || a.codigo.localeCompare(b.codigo));
  }, [dotacoes, busca, periodo.anos]);

  const totalFiltrado = pagamentosAtivos(pagamentosFiltrados).reduce((acc, p) => acc + valorDoPagamento(p), 0);

  if (usuarioAtual?.perfil === 'demandante') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  const rotuloNovo =
    aba === 'pagamentos' ? 'Novo Pagamento' : aba === 'empenhos' ? 'Nova NE' : aba === 'dotacoes' ? 'Nova Dotação' : '';
  const rotaNovo =
    aba === 'pagamentos'
      ? '/sistema/financeiro/pagamentos/novo'
      : aba === 'empenhos'
        ? '/sistema/financeiro/empenhos/novo'
        : '/sistema/financeiro/dotacoes/novo';

  const abas: { id: Aba; nome: string }[] = [
    { id: 'a-pagar', nome: qtdAPagar > 0 ? `A pagar (${qtdAPagar})` : 'A pagar' },
    { id: 'pagamentos', nome: 'Pagamentos' },
    { id: 'empenhos', nome: 'Empenhos (NE)' },
    { id: 'dotacoes', nome: 'Dotações' },
    { id: 'ficha', nome: 'Ficha por contrato' },
    { id: 'orcamento', nome: 'Controle orçamentário' },
  ];

  const CABECALHO = 'px-4 py-3 text-xs font-medium text-gray-500 uppercase';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <DollarSign className="w-6 h-6 mr-2 text-red-700 flex-shrink-0" />
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Controle de pagamentos da Diretoria de Finanças: faturas (PAE), notas de empenho, ordens bancárias e dotações.
          </p>
        </div>
        {isMasterOuFinanceiro && aba !== 'ficha' && aba !== 'orcamento' && aba !== 'a-pagar' && (
          <button
            onClick={() => navigate(rotaNovo)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800"
          >
            <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
            {rotuloNovo}
          </button>
        )}
      </div>

      <div className="border-b border-gray-200 flex gap-6 overflow-x-auto">
        {abas.map((item) => (
          <button
            key={item.id}
            onClick={() => setAba(item.id)}
            className={`pb-3 text-sm font-medium border-b-2 whitespace-nowrap ${aba === item.id ? 'border-red-600 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {item.nome}
          </button>
        ))}
      </div>

      {(aba === 'pagamentos' || aba === 'empenhos' || aba === 'dotacoes' || aba === 'orcamento') && (
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} anosDisponiveis={anosDisponiveis} />
      )}

      {aba === 'a-pagar' ? (
        <FilaAPagar />
      ) : aba === 'ficha' ? (
        <FichaContrato />
      ) : aba === 'orcamento' ? (
        <ControleOrcamentario periodo={periodo} />
      ) : (
        <>
          <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-lg">
              <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
                placeholder={
                  aba === 'pagamentos'
                    ? 'Buscar por PAE, NF, NE, OB, setor, contrato, fornecedor, objeto ou fiscal...'
                    : aba === 'empenhos'
                      ? 'Buscar por NE, PAE ou contrato...'
                      : 'Buscar por código, descrição, fonte ou plano interno...'
                }
              />
            </div>
            {aba === 'pagamentos' && (
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as StatusPagamento | '')}
                className="block w-full sm:w-48 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Todas as situações</option>
                {(Object.keys(STATUS_PAGAMENTO_LABELS) as StatusPagamento[]).map((s) => (
                  <option key={s} value={s}>{STATUS_PAGAMENTO_LABELS[s]}</option>
                ))}
              </select>
            )}
          </div>

          {aba === 'pagamentos' && (
            <>
              <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
                <p className="text-sm text-gray-600">{pagamentosFiltrados.length} fatura(s) encontrada(s)</p>
                <p className="text-sm font-semibold text-gray-900" title="Soma das faturas não arquivadas">Total: {formatarMoeda(totalFiltrado)}</p>
              </div>
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className={`${CABECALHO} text-left`}>Contrato</th>
                      <th className={`${CABECALHO} text-left`}>PAE / NFs</th>
                      <th className={`${CABECALHO} text-left`}>NE / OB</th>
                      <th className={`${CABECALHO} text-left`}>Andamento</th>
                      <th className={`${CABECALHO} text-right`}>Valor</th>
                      <th className={`${CABECALHO} text-center`}>Mês</th>
                      <th className={`${CABECALHO} text-center`}>Situação</th>
                      {isMasterOuFinanceiro && <th className={`${CABECALHO} text-center`}>Andamento</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pagamentosFiltrados.map((p) => {
                      const status = statusDoPagamento(p);
                      const documentos = (p.documentos ?? []).map((d) => d.numero).join(', ');
                      return (
                        <tr
                          key={p.id}
                          onClick={() => isMasterOuFinanceiro && navigate(`/sistema/financeiro/pagamentos/${p.id}/editar`)}
                          className={`hover:bg-gray-50 ${isMasterOuFinanceiro ? 'cursor-pointer' : ''} ${status === 'arquivado' ? 'text-gray-400' : ''}`}
                        >
                          <td className="px-4 py-3 text-sm max-w-[16rem] truncate" title={textoContrato(p.contratoId)}>{textoContrato(p.contratoId)}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium">{p.paeFatura || '-'}</div>
                            {documentos && <div className="text-xs text-gray-500 max-w-[14rem] truncate" title={documentos}>NF {documentos}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <div>NE {numerosNe(p).join(' / ') || '-'}</div>
                            <div className="text-xs text-gray-500">OB {numerosOb(p).join(' / ') || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{descreverAndamento(p)}</td>
                          <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatarMoeda(valorDoPagamento(p))}</td>
                          <td className="px-4 py-3 text-sm text-center whitespace-nowrap">{formatarMes(competenciaDoPagamento(p))}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CORES_STATUS[status]}`}>
                              {STATUS_PAGAMENTO_LABELS[status]}
                            </span>
                          </td>
                          {isMasterOuFinanceiro && (
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPagamentoAndamento(p);
                                }}
                                className="text-xs font-medium text-red-700 hover:underline whitespace-nowrap"
                              >
                                Alterar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {pagamentosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">Nenhum pagamento encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {aba === 'empenhos' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${CABECALHO} text-left`}>NE</th>
                    <th className={`${CABECALHO} text-left`}>Contrato</th>
                    <th className={`${CABECALHO} text-left`}>Tipo</th>
                    <th className={`${CABECALHO} text-right`}>Valor</th>
                    <th className={`${CABECALHO} text-center`}>Exercício</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {empenhosFiltrados.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => isMasterOuFinanceiro && navigate(`/sistema/financeiro/empenhos/${e.id}/editar`)}
                      className={`hover:bg-gray-50 ${isMasterOuFinanceiro ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{e.numero}</td>
                      <td className="px-4 py-3 text-sm max-w-[18rem] truncate" title={textoContrato(e.contratoId)}>{textoContrato(e.contratoId)}</td>
                      <td className="px-4 py-3 text-sm">
                        {e.tipo === 'origem' ? 'Origem' : 'Reforço'}
                        {e.tipo === 'origem' && e.estimativo ? <span className="text-xs text-gray-500"> (estimativa)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatarMoeda(e.valor)}</td>
                      <td className="px-4 py-3 text-sm text-center">{e.exercicio}</td>
                    </tr>
                  ))}
                  {empenhosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma NE encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {aba === 'dotacoes' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${CABECALHO} text-left`}>Código / Exercício</th>
                    <th className={`${CABECALHO} text-left`}>Descrição</th>
                    <th className={`${CABECALHO} text-left`}>Fonte</th>
                    <th className={`${CABECALHO} text-left`}>Plano interno</th>
                    <th className={`${CABECALHO} text-right`}>Valor Dotado</th>
                    <th className={`${CABECALHO} text-right`}>Saldo Disponível</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dotacoesFiltradas.map((d) => {
                    const saldo = saldoDaDotacao(d, pagamentos);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => isMasterOuFinanceiro && navigate(`/sistema/financeiro/dotacoes/${d.id}/editar`)}
                        className={`hover:bg-gray-50 ${isMasterOuFinanceiro ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{d.codigo}</div>
                          <div className="text-xs text-gray-500">{d.exercicio}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{d.descricao}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {d.fonteRecurso}
                          {d.fonteCodigo && <div className="text-xs text-gray-500">{d.fonteCodigo}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{d.planoInterno || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">{d.valorDotado ? formatarMoeda(d.valorDotado) : '-'}</td>
                        <td className={`px-4 py-3 text-sm text-right font-medium whitespace-nowrap ${saldo < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {d.valorDotado ? formatarMoeda(saldo) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {dotacoesFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma dotação encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {pagamentoAndamento && (
        <AndamentoRapidoModal
          key={pagamentoAndamento.id}
          pagamento={pagamentoAndamento}
          onFechar={() => setPagamentoAndamento(null)}
        />
      )}
    </div>
  );
}
