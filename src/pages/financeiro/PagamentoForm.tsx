import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, PlusCircle, Save, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OPCOES_FONTE_PROCESSO } from '../../lib/planilhaProcessos';
import { formatarMoeda, type ExecucaoContrato } from '../../lib/contratos';
import BuscaContrato from './BuscaContrato';
import {
  ETAPAS_PAGAMENTO,
  SETORES_PAGAMENTO,
  diferencaDocumentos,
  reforcoNecessario,
  registrarAndamento,
  saldoDoExercicio,
  somaDocumentos,
  statusDoPagamento,
  totaisPorMes,
  valorAPagarDoContrato,
  valorDoPagamento,
} from '../../lib/financeiro';
import {
  STATUS_PAGAMENTO_LABELS,
  type DocumentoPagamento,
  type OrdemBancaria,
  type StatusPagamento,
} from '../../types';

const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';
const CLASSE_INPUT_LINHA =
  'block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-1.5 px-2 border';

const mesAtual = () => new Date().toISOString().slice(0, 7);
const paraDataInput = (isoOuVazio?: string) => (isoOuVazio ? isoOuVazio.split('T')[0] : '');
const numeroOuVazio = (n?: number) => (n === undefined ? '' : String(n));
const paraNumero = (texto: string) => (texto.trim() === '' ? undefined : Number(texto.replace(',', '.')));

interface LinhaDocumento {
  tipo: DocumentoPagamento['tipo'];
  numero: string;
  valor: string;
  execucaoId: string;
}
interface LinhaOb {
  numero: string;
  documento: string;
  valor: string;
  data: string;
}

/**
 * Processo de pagamento de uma fatura (controle da Diretoria de Finanças):
 * PAE da fatura, NFs (ligadas às execuções que o fiscal já lançou), NEs de
 * origem/reforço que cobrem o valor, OBs e o andamento (setor + etapa).
 */
export default function PagamentoForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const {
    pagamentos, contratos, dotacoes, empenhos, execucoes,
    addPagamento, updatePagamento, deletePagamento, usuarioAtual,
  } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const pagamento = id ? pagamentos.find((p) => p.id === id) : undefined;

  const [contratoId, setContratoId] = useState(pagamento?.contratoId ?? searchParams.get('contratoId') ?? '');
  const [competencia, setCompetencia] = useState(
    pagamento?.competencia ?? (pagamento?.dataPagamento ? pagamento.dataPagamento.slice(0, 7) : mesAtual()),
  );
  const [fonteRecurso, setFonteRecurso] = useState(pagamento?.fonteRecurso ?? '');
  const [dotacaoId, setDotacaoId] = useState(pagamento?.dotacaoId ?? '');
  const [paeFatura, setPaeFatura] = useState(pagamento?.paeFatura ?? '');
  const [documentos, setDocumentos] = useState<LinhaDocumento[]>(
    (pagamento?.documentos ?? []).map((d) => ({
      tipo: d.tipo,
      numero: d.numero,
      valor: numeroOuVazio(d.valor),
      execucaoId: d.execucaoId ?? '',
    })),
  );
  const [valorTotal, setValorTotal] = useState(pagamento ? numeroOuVazio(valorDoPagamento(pagamento)) : '');
  const [empenhoIds, setEmpenhoIds] = useState<string[]>(pagamento?.empenhoIds ?? []);
  const [ordens, setOrdens] = useState<LinhaOb[]>(
    pagamento?.ordensBancarias?.map((o) => ({ numero: o.numero, documento: o.documento ?? '', valor: numeroOuVazio(o.valor), data: paraDataInput(o.data) })) ??
      (pagamento?.numeroOrdemPagamento ? [{ numero: pagamento.numeroOrdemPagamento, documento: '', valor: '', data: paraDataInput(pagamento.dataPagamento) }] : []),
  );
  const [setorAtual, setSetorAtual] = useState(pagamento?.setorAtual ?? '');
  const [etapa, setEtapa] = useState(pagamento?.etapa ?? '');
  const [status, setStatus] = useState<StatusPagamento>(pagamento ? statusDoPagamento(pagamento) : 'em_tramitacao');
  const [autenticado, setAutenticado] = useState(pagamento?.autenticado ?? false);
  const [autenticadoPor, setAutenticadoPor] = useState(pagamento?.autenticadoPor ?? '');
  const [observacao, setObservacao] = useState(pagamento?.observacao ?? '');
  const [anexoLink, setAnexoLink] = useState(pagamento?.anexoLink ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const contrato = contratos.find((c) => c.id === contratoId);
  const exercicio = Number(competencia.slice(0, 4)) || new Date().getFullYear();

  const escolherContrato = (c: { id: string; fonteRecurso?: string }) => {
    setContratoId(c.id);
    if (c.fonteRecurso) setFonteRecurso(c.fonteRecurso);
  };

  // NEs do contrato no exercício da fatura.
  const empenhosDoContrato = empenhos.filter((e) => e.contratoId === contratoId && e.exercicio === exercicio);

  // Execuções (NFs) do contrato que ainda não estão em outra fatura.
  const execucoesDisponiveis = useMemo(() => {
    const jaVinculadas = new Set(
      pagamentos
        .filter((p) => p.id !== id && statusDoPagamento(p) !== 'arquivado')
        .flatMap((p) => (p.documentos ?? []).map((d) => d.execucaoId))
        .filter(Boolean),
    );
    return execucoes.filter((e) => e.contratoId === contratoId && !jaVinculadas.has(e.id));
  }, [execucoes, pagamentos, contratoId, id]);

  const valorTotalNumero = paraNumero(valorTotal) ?? 0;
  const documentosParaValidar = documentos.map((d) => ({ tipo: d.tipo, numero: d.numero, valor: paraNumero(d.valor) }));
  const diferenca = diferencaDocumentos({ valorTotal: paraNumero(valorTotal), documentos: documentosParaValidar });
  const somaNfs = somaDocumentos({ documentos: documentosParaValidar });

  const saldoNe = useMemo(
    () => saldoDoExercicio(contratoId, exercicio, empenhos, pagamentos.filter((p) => p.id !== id)),
    [contratoId, exercicio, empenhos, pagamentos, id],
  );
  const faltaReforco = reforcoNecessario(valorTotalNumero, saldoNe.saldo);

  // Faturas do mesmo contrato por mês — pra saber quanto já foi lançado/pago em cada um.
  const totaisMeses = useMemo(
    () =>
      totaisPorMes(pagamentos.filter((p) => p.contratoId === contratoId && p.id !== id)).filter((m) =>
        m.mes.startsWith(String(exercicio)),
      ),
    [pagamentos, contratoId, id, exercicio],
  );
  const doMesEscolhido = totaisMeses.find((m) => m.mes === competencia);
  const aPagar = contratoId
    ? valorAPagarDoContrato(contratoId, execucoes, pagamentos.filter((p) => p.id !== id))
    : 0;
  const incluirNf = (x: ExecucaoContrato) =>
    setDocumentos((anterior) =>
      anterior.some((d) => d.execucaoId === x.id)
        ? anterior
        : [
            ...anterior.filter((d) => d.numero.trim() !== '' || d.execucaoId),
            { tipo: 'NF', numero: x.nf, valor: String(x.valor), execucaoId: x.id },
          ],
    );

  const atualizarDocumento = (indice: number, mudanca: Partial<LinhaDocumento>) =>
    setDocumentos((anterior) => anterior.map((d, i) => (i === indice ? { ...d, ...mudanca } : d)));

  const vincularExecucao = (indice: number, execucaoId: string) => {
    const execucao = execucoes.find((e) => e.id === execucaoId);
    if (!execucao) return atualizarDocumento(indice, { execucaoId: '' });
    atualizarDocumento(indice, { execucaoId, numero: execucao.nf, valor: String(execucao.valor), tipo: 'NF' });
  };

  const atualizarOb = (indice: number, mudanca: Partial<LinhaOb>) =>
    setOrdens((anterior) => anterior.map((o, i) => (i === indice ? { ...o, ...mudanca } : o)));

  const alternarEmpenho = (empenhoId: string) =>
    setEmpenhoIds((anterior) => (anterior.includes(empenhoId) ? anterior.filter((e) => e !== empenhoId) : [...anterior, empenhoId]));

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoId || !competencia || valorTotal === '') return;

    setSalvando(true);
    try {
      // Objetos aninhados não podem levar `undefined` (o Firestore recusa): só entram as chaves preenchidas.
      const documentosLimpos: DocumentoPagamento[] = documentos
        .filter((d) => d.numero.trim() !== '')
        .map((d) => {
          const valor = paraNumero(d.valor);
          return {
            tipo: d.tipo,
            numero: d.numero.trim(),
            ...(valor !== undefined ? { valor } : {}),
            ...(d.execucaoId ? { execucaoId: d.execucaoId } : {}),
          };
        });
      const ordensLimpas: OrdemBancaria[] = ordens
        .filter((o) => o.numero.trim() !== '')
        .map((o) => {
          const valor = paraNumero(o.valor);
          return {
            numero: o.numero.trim(),
            ...(o.documento ? { documento: o.documento } : {}),
            ...(valor !== undefined ? { valor } : {}),
            ...(o.data ? { data: new Date(o.data).toISOString() } : {}),
          };
        });

      const dados = {
        contratoId,
        paeFatura,
        documentos: documentosLimpos,
        valorTotal: valorTotalNumero,
        empenhoIds,
        ordensBancarias: ordensLimpas,
        dotacaoId,
        fonteRecurso,
        competencia,
        setorAtual,
        etapa,
        status,
        autenticado,
        autenticadoPor,
        historico: registrarAndamento(pagamento, { setorAtual, etapa }, usuarioAtual?.nome ?? ''),
        observacao,
        anexoLink,
      };

      if (emEdicao && id) {
        await updatePagamento(id, dados);
      } else {
        await addPagamento(dados);
      }

      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível salvar o pagamento: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir este pagamento? Prefira marcá-lo como "Arquivado" — o arquivado não entra nas somas e fica no histórico.')) return;
    setExcluindo(true);
    try {
      await deletePagamento(id);
      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível excluir o pagamento: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setExcluindo(false);
    }
  };

  if (usuarioAtual?.perfil !== 'master' && usuarioAtual?.perfil !== 'financeiro') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  if (emEdicao && !pagamento) {
    return <div className="p-6">Pagamento não encontrado.</div>;
  }

  if (!emEdicao && !contratoId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Novo Pagamento (Fatura)</h1>
            <p className="mt-1 text-sm text-gray-500">Comece pelo contrato — o resto vem dos demais módulos.</p>
          </div>
        </div>
        <BuscaContrato onSelecionar={escolherContrato} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? 'Editar Pagamento' : 'Novo Pagamento (Fatura)'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Processo de pagamento de uma fatura: PAE, NFs, NEs, OBs e andamento.
          </p>
        </div>
        {emEdicao && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="-ml-1 mr-1.5 h-4 w-4" />
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        )}
      </div>

      <form onSubmit={handleSalvar} className="space-y-6">
        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Contrato e fatura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {contrato && (
              <div className="md:col-span-2 rounded-md bg-gray-50 border border-gray-200 p-4 text-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-gray-900">Contrato {contrato.numero} — {contrato.empresa}</p>
                  {!emEdicao && (
                    <button type="button" onClick={() => setContratoId('')} className="text-xs font-medium text-red-700 hover:underline whitespace-nowrap">
                      Trocar contrato
                    </button>
                  )}
                </div>
                <p className="text-gray-600">{contrato.objeto}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs text-gray-600">
                  <div><span className="block text-gray-400 uppercase">CNPJ</span>{contrato.cnpj || '-'}</div>
                  <div><span className="block text-gray-400 uppercase">PAE do contrato</span>{contrato.pae || '-'}</div>
                  <div><span className="block text-gray-400 uppercase">Vigência</span>{new Date(contrato.inicioVigencia).toLocaleDateString('pt-BR')} a {new Date(contrato.fimVigencia).toLocaleDateString('pt-BR')}</div>
                  <div><span className="block text-gray-400 uppercase">Fonte</span>{contrato.fonteRecurso || '-'}</div>
                  <div><span className="block text-gray-400 uppercase">Fiscal titular</span>{contrato.fiscalTitular || '-'}</div>
                  <div><span className="block text-gray-400 uppercase">Fiscal suplente</span>{contrato.fiscalSuplente || '-'}</div>
                  <div><span className="block text-gray-400 uppercase">Valor global</span>{formatarMoeda(contrato.valorGlobal || 0)}</div>
                  <div>
                    <span className="block text-gray-400 uppercase">Saldo (após pagamentos)</span>
                    <strong className="text-gray-900">{formatarMoeda(contrato.saldoAtualFinanceiro ?? 0)}</strong>
                    {aPagar > 0 && <span className="block text-amber-700">{formatarMoeda(aPagar)} a pagar</span>}
                  </div>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="paeFatura" className="block text-sm font-medium text-gray-700">PAE (protocolo) da fatura</label>
              <input type="text" id="paeFatura" value={paeFatura} onChange={(e) => setPaeFatura(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: 2026/2328415" />
            </div>
            <div>
              <label htmlFor="competencia" className="block text-sm font-medium text-gray-700">
                Mês <span className="text-red-500">*</span>
              </label>
              <input type="month" id="competencia" required value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={CLASSE_INPUT} />
              {doMesEscolhido && (
                <p className="mt-1 text-xs text-gray-500">
                  Neste mês já há {doMesEscolhido.quantidade} fatura(s): {formatarMoeda(doMesEscolhido.total)} lançado, {formatarMoeda(doMesEscolhido.pago)} pago.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="fonteRecurso" className="block text-sm font-medium text-gray-700">Fonte do Recurso</label>
              <select id="fonteRecurso" value={fonteRecurso} onChange={(e) => setFonteRecurso(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                <option value="">Selecione...</option>
                {OPCOES_FONTE_PROCESSO.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dotacaoId" className="block text-sm font-medium text-gray-700">Dotação (ficha orçamentária)</label>
              <select id="dotacaoId" value={dotacaoId} onChange={(e) => setDotacaoId(e.target.value)} className={`${CLASSE_INPUT} bg-white`}>
                <option value="">Nenhuma</option>
                {dotacoes.map((d) => (
                  <option key={d.id} value={d.id}>{d.codigo} — {d.descricao} ({d.exercicio})</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Documentos de cobrança (NFs)</h2>
            <button
              type="button"
              onClick={() => setDocumentos((anterior) => [...anterior, { tipo: 'NF', numero: '', valor: '', execucaoId: '' }])}
              className="inline-flex items-center text-sm font-medium text-red-700 hover:underline"
            >
              <PlusCircle className="h-4 w-4 mr-1" /> Adicionar NF
            </button>
          </div>
          {documentos.length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma NF informada. Uma fatura pode reunir várias NFs sob o mesmo PAE.</p>
          )}
          <div className="space-y-3">
            {documentos.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <select value={d.tipo} onChange={(e) => atualizarDocumento(i, { tipo: e.target.value as DocumentoPagamento['tipo'] })} className={`${CLASSE_INPUT_LINHA} bg-white col-span-6 md:col-span-2`} aria-label="Tipo do documento">
                  {(['NF', 'Fatura', 'Recibo', 'Outro'] as const).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" value={d.numero} onChange={(e) => atualizarDocumento(i, { numero: e.target.value })} className={`${CLASSE_INPUT_LINHA} col-span-6 md:col-span-3`} placeholder="Nº" aria-label="Número do documento" />
                <input type="number" step="0.01" min="0" value={d.valor} onChange={(e) => atualizarDocumento(i, { valor: e.target.value })} className={`${CLASSE_INPUT_LINHA} col-span-6 md:col-span-2`} placeholder="Valor (R$)" aria-label="Valor do documento" />
                <select value={d.execucaoId} onChange={(e) => vincularExecucao(i, e.target.value)} className={`${CLASSE_INPUT_LINHA} bg-white col-span-5 md:col-span-4`} aria-label="Execução lançada pelo fiscal">
                  <option value="">Sem vínculo com execução</option>
                  {execucoes.filter((x) => x.id === d.execucaoId).map((x) => (
                    <option key={x.id} value={x.id}>NF {x.nf} — {formatarMoeda(x.valor)}</option>
                  ))}
                  {execucoesDisponiveis.filter((x) => x.id !== d.execucaoId).map((x) => (
                    <option key={x.id} value={x.id}>NF {x.nf} — {formatarMoeda(x.valor)}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setDocumentos((anterior) => anterior.filter((_, idx) => idx !== i))} className="col-span-1 p-1.5 text-gray-400 hover:text-red-600" title="Remover">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {contratoId && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                NFs lançadas pelo fiscal e ainda sem pagamento ({execucoesDisponiveis.length})
              </p>
              {execucoesDisponiveis.length === 0 ? (
                <p className="text-xs text-amber-800 mt-1">Nenhuma pendente — digite a NF manualmente acima.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {execucoesDisponiveis.map((x) => {
                    const incluida = documentos.some((d) => d.execucaoId === x.id);
                    return (
                      <li key={x.id} className="flex items-center justify-between text-xs text-gray-700">
                        <span>NF {x.nf} — {formatarMoeda(x.valor)} <span className="text-gray-400">({new Date(x.data).toLocaleDateString('pt-BR')})</span></span>
                        <button type="button" disabled={incluida} onClick={() => incluirNf(x)} className="font-medium text-red-700 hover:underline disabled:text-gray-400 disabled:no-underline">
                          {incluida ? 'incluída' : 'incluir'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="valorTotal" className="block text-sm font-medium text-gray-700">
                Valor da fatura (R$) <span className="text-red-500">*</span>
              </label>
              <input type="number" id="valorTotal" required step="0.01" min="0" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className={CLASSE_INPUT} />
              {documentos.length > 0 && somaNfs > 0 && (
                <button type="button" onClick={() => setValorTotal(String(Math.round(somaNfs * 100) / 100))} className="mt-1 text-xs text-red-700 hover:underline">
                  Usar a soma das NFs ({formatarMoeda(somaNfs)})
                </button>
              )}
            </div>
            {diferenca !== null && diferenca !== 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 self-start">
                O valor da fatura difere da soma das NFs em <strong>{formatarMoeda(Math.abs(diferenca))}</strong>{' '}
                ({diferenca > 0 ? 'fatura maior' : 'NFs somam mais'}). Confira antes de salvar.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Notas de Empenho (NE) que cobrem a fatura</h2>
            {contratoId && (
              <Link
                to={`/sistema/financeiro/empenhos/novo?contratoId=${contratoId}`}
                target="_blank"
                className="text-sm font-medium text-red-700 hover:underline"
              >
                Cadastrar NE (nova aba)
              </Link>
            )}
          </div>
          {!contratoId ? (
            <p className="text-sm text-gray-500">Selecione o contrato para ver as NEs do exercício {exercicio}.</p>
          ) : empenhosDoContrato.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma NE cadastrada para este contrato em {exercicio}.</p>
          ) : (
            <div className="space-y-2">
              {empenhosDoContrato.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={empenhoIds.includes(emp.id)} onChange={() => alternarEmpenho(emp.id)} className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer" />
                  NE {emp.numero} — {emp.tipo === 'origem' ? 'origem' : 'reforço'} — {formatarMoeda(emp.valor)}
                </label>
              ))}
              <div className="mt-3 rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 space-y-1">
                <p>Empenhado no exercício (origem + reforços): <strong>{formatarMoeda(saldoNe.empenhado)}</strong></p>
                <p>Já comprometido por outras faturas: <strong>{formatarMoeda(saldoNe.comprometido)}</strong></p>
                <p>Saldo de NE: <strong className={saldoNe.saldo < 0 ? 'text-red-700' : ''}>{formatarMoeda(saldoNe.saldo)}</strong></p>
                {valorTotalNumero > 0 && (
                  faltaReforco > 0 ? (
                    <p className="text-amber-800">Para cobrir esta fatura falta reforçar <strong>{formatarMoeda(faltaReforco)}</strong>.</p>
                  ) : (
                    <p className="text-emerald-700">O saldo de NE cobre esta fatura.</p>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Ordens Bancárias (OB)</h2>
            <button type="button" onClick={() => setOrdens((anterior) => [...anterior, { numero: '', documento: '', valor: '', data: '' }])} className="inline-flex items-center text-sm font-medium text-red-700 hover:underline">
              <PlusCircle className="h-4 w-4 mr-1" /> Adicionar OB
            </button>
          </div>
          {ordens.length === 0 && <p className="text-sm text-gray-500">Nenhuma OB ainda (o pagamento só tem OB depois da assinatura).</p>}
          <div className="space-y-3">
            {ordens.map((o, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-start">
                <input type="text" value={o.numero} onChange={(e) => atualizarOb(i, { numero: e.target.value })} className={`${CLASSE_INPUT_LINHA} col-span-12 md:col-span-2`} placeholder="Nº da OB" aria-label="Número da OB" />
                <select value={o.documento} onChange={(e) => atualizarOb(i, { documento: e.target.value })} className={`${CLASSE_INPUT_LINHA} bg-white col-span-12 md:col-span-3`} aria-label="NF desta OB">
                  <option value="">Fatura toda</option>
                  {documentos.filter((d) => d.numero.trim() !== '').map((d) => (
                    <option key={d.numero} value={d.numero.trim()}>{d.tipo} {d.numero}</option>
                  ))}
                </select>
                <input type="number" step="0.01" min="0" value={o.valor} onChange={(e) => atualizarOb(i, { valor: e.target.value })} className={`${CLASSE_INPUT_LINHA} col-span-5 md:col-span-3`} placeholder="Valor (R$)" aria-label="Valor da OB" />
                <input type="date" value={o.data} onChange={(e) => atualizarOb(i, { data: e.target.value })} className={`${CLASSE_INPUT_LINHA} col-span-6 md:col-span-3`} aria-label="Data da OB" />
                <button type="button" onClick={() => setOrdens((anterior) => anterior.filter((_, idx) => idx !== i))} className="col-span-1 p-1.5 text-gray-400 hover:text-red-600" title="Remover">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Andamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="setorAtual" className="block text-sm font-medium text-gray-700">Setor atual</label>
              <input type="text" id="setorAtual" list="setores-pagamento" value={setorAtual} onChange={(e) => setSetorAtual(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: GAB" />
              <datalist id="setores-pagamento">
                {SETORES_PAGAMENTO.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="etapa" className="block text-sm font-medium text-gray-700">Etapa / o que falta</label>
              <input type="text" id="etapa" list="etapas-pagamento" value={etapa} onChange={(e) => setEtapa(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: P/ ASS DE NE + OB" />
              <datalist id="etapas-pagamento">
                {ETAPAS_PAGAMENTO.map((x) => <option key={x} value={x} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Situação</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusPagamento)} className={`${CLASSE_INPUT} bg-white`}>
                {(Object.keys(STATUS_PAGAMENTO_LABELS) as StatusPagamento[]).map((s) => (
                  <option key={s} value={s}>{STATUS_PAGAMENTO_LABELS[s]}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Só <strong>Pago</strong> desconta do saldo financeiro do contrato (volta se mudar a situação). Arquivado não entra em nenhuma soma.</p>
            </div>
            <div className="flex items-center md:pt-6">
              <input id="autenticado" type="checkbox" checked={autenticado} onChange={(e) => setAutenticado(e.target.checked)} className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer" />
              <label htmlFor="autenticado" className="ml-2 block text-sm text-gray-700 cursor-pointer">Autenticação</label>
            </div>
            <div>
              <label htmlFor="autenticadoPor" className="block text-sm font-medium text-gray-700">Autenticado por</label>
              <input type="text" id="autenticadoPor" value={autenticadoPor} onChange={(e) => setAutenticadoPor(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: DTIC" />
            </div>
          </div>

          {(pagamento?.historico ?? []).length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Histórico</p>
              <ul className="text-sm text-gray-700 space-y-1">
                {[...(pagamento?.historico ?? [])].reverse().map((h, i) => (
                  <li key={i}>
                    {new Date(h.data).toLocaleDateString('pt-BR')} — {[h.setor, h.etapa].filter(Boolean).join(' - ')}
                    {h.porNome ? <span className="text-gray-400"> ({h.porNome})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="anexoLink" className="block text-sm font-medium text-gray-700">Comprovante (link)</label>
              <input type="text" id="anexoLink" value={anexoLink} onChange={(e) => setAnexoLink(e.target.value)} className={CLASSE_INPUT} placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="observacao" className="block text-sm font-medium text-gray-700">Observações</label>
              <textarea id="observacao" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} className={CLASSE_INPUT} />
            </div>
          </div>
        </section>

        <div className="flex justify-end space-x-3">
          <button type="button" onClick={() => navigate(-1)} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
            <Save className="-ml-1 mr-2 h-5 w-5" />
            {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar Pagamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
