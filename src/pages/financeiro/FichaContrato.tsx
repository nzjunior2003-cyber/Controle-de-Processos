import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import {
  competenciaDoPagamento,
  descreverAndamento,
  diferencaDocumentos,
  saldoDoExercicio,
  statusDoPagamento,
  totaisPorMes,
  valorDoPagamento,
} from '../../lib/financeiro';

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const formatarData = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '-');

/**
 * Ficha de controle de um contrato num exercício — o mesmo desenho da
 * planilha da Diretoria de Finanças (cabeçalho, linha de origem, meses e
 * total do ano), mas com tudo **calculado**: valor do mês e total do ano
 * somam só o que não está arquivado, e uma fatura cujas NFs não somam o
 * valor lançado fica sinalizada (em vez de passar batida).
 */
export default function FichaContrato({ contratoIdInicial = '' }: { contratoIdInicial?: string }) {
  const { contratos, pagamentos, empenhos, dotacoes, usuarioAtual } = useApp();
  const [contratoId, setContratoId] = useState(contratoIdInicial);
  const [exercicio, setExercicio] = useState(new Date().getFullYear());
  const podeEditar = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'financeiro';

  const contratosOrdenados = useMemo(() => [...contratos].sort((a, b) => a.numero.localeCompare(b.numero)), [contratos]);
  const contrato = contratos.find((c) => c.id === contratoId);

  const empenhosDoExercicio = empenhos.filter((e) => e.contratoId === contratoId && e.exercicio === exercicio);
  const origem = empenhosDoExercicio.find((e) => e.tipo === 'origem');
  const empenhoPorId = new Map(empenhos.map((e) => [e.id, e]));

  const pagamentosDoExercicio = pagamentos
    .filter((p) => p.contratoId === contratoId && competenciaDoPagamento(p).startsWith(String(exercicio)))
    .sort((a, b) => competenciaDoPagamento(a).localeCompare(competenciaDoPagamento(b)));

  const dotacao =
    dotacoes.find((d) => d.id === origem?.dotacaoId) ??
    dotacoes.find((d) => pagamentosDoExercicio.some((p) => p.dotacaoId === d.id));

  const meses = totaisPorMes(pagamentosDoExercicio);
  const totalAno = meses.reduce((acc, m) => acc + m.total, 0);
  const totalPago = meses.reduce((acc, m) => acc + m.pago, 0);
  const saldo = saldoDoExercicio(contratoId, exercicio, empenhos, pagamentos);

  const anos = Array.from(new Set([new Date().getFullYear(), exercicio, ...empenhos.map((e) => e.exercicio)])).sort((a, b) => b - a);

  const celulaCabecalho = (rotulo: string, valor?: string) => (
    <div>
      <p className="text-[11px] uppercase text-gray-500">{rotulo}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{valor || '-'}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-3">
        <select
          value={contratoId}
          onChange={(e) => setContratoId(e.target.value)}
          className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
        >
          <option value="">Selecione o contrato...</option>
          {contratosOrdenados.map((c) => (
            <option key={c.id} value={c.id}>{c.numero} — {c.empresa}</option>
          ))}
        </select>
        <select
          value={exercicio}
          onChange={(e) => setExercicio(Number(e.target.value))}
          className="block w-full sm:w-32 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
        >
          {anos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
        </select>
      </div>

      {!contrato ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-sm text-gray-500">
          Escolha um contrato para ver a ficha de controle do exercício.
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">
            Contrato nº {contrato.numero} — {contrato.empresa}
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-200">
            {celulaCabecalho('Funcional', dotacao?.funcionalProgramatica)}
            {celulaCabecalho('Projeto-Atividade', dotacao?.projetoAtividade)}
            {celulaCabecalho('Natureza da despesa', dotacao?.naturezaDespesa)}
            {celulaCabecalho('Fonte', dotacao?.fonteCodigo ?? dotacao?.fonteRecurso ?? contrato.fonteRecurso)}
            {celulaCabecalho('Detalhamento', dotacao?.detalhamento)}
            {celulaCabecalho('Plano interno', dotacao?.planoInterno)}
            {celulaCabecalho('CNPJ', contrato.cnpj)}
            {celulaCabecalho('Objeto', contrato.objeto)}
          </div>

          <div className="px-4 py-3 bg-blue-50 border-b border-gray-200 text-sm text-gray-800 flex flex-wrap gap-x-6 gap-y-1">
            {origem ? (
              <>
                <span><strong>NE de origem:</strong> {origem.numero} ({formatarMoeda(origem.valor)}{origem.estimativo ? ', estimativa' : ''})</span>
                {origem.prd && <span><strong>PRD:</strong> {origem.prd}{origem.prdValidade ? ` (até ${formatarData(origem.prdValidade)})` : ''}{origem.prdValor ? ` — ${formatarMoeda(origem.prdValor)}` : ''}</span>}
                {origem.paeOrigem && <span><strong>PAE:</strong> {origem.paeOrigem}</span>}
              </>
            ) : (
              <span className="text-gray-500">Sem NE de origem cadastrada para {exercicio}.</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="px-2 py-2 text-left w-14">Mês</th>
                  <th className="px-2 py-2 text-left">Protocolo (PAE)</th>
                  <th className="px-2 py-2 text-left">Documento(s)</th>
                  <th className="px-2 py-2 text-right">Valor da fatura</th>
                  <th className="px-2 py-2 text-left">NE</th>
                  <th className="px-2 py-2 text-left">OB</th>
                  <th className="px-2 py-2 text-left">Status do processo</th>
                  <th className="px-2 py-2 text-right">Valor mês</th>
                  <th className="px-2 py-2 text-center">Autent.</th>
                </tr>
              </thead>
              <tbody>
                {MESES.map((nomeMes, indice) => {
                  const chave = `${exercicio}-${String(indice + 1).padStart(2, '0')}`;
                  const doMes = pagamentosDoExercicio.filter((p) => competenciaDoPagamento(p) === chave);
                  const totalMes = meses.find((m) => m.mes === chave);
                  if (doMes.length === 0) {
                    return (
                      <tr key={chave} className="border-b border-gray-100 text-gray-400">
                        <td className="px-2 py-1.5 font-semibold">{nomeMes}</td>
                        <td colSpan={6} />
                        <td className="px-2 py-1.5 text-right">{formatarMoeda(0)}</td>
                        <td />
                      </tr>
                    );
                  }
                  // Uma linha por NF (como na planilha); fatura sem NF informada ocupa uma linha só.
                  let primeiraDoMes = true;
                  return doMes.flatMap((p) => {
                    const arquivado = statusDoPagamento(p) === 'arquivado';
                    const diferenca = diferencaDocumentos(p);
                    const numerosNe = (p.empenhoIds ?? []).map((idNe) => empenhoPorId.get(idNe)?.numero).filter(Boolean);
                    if (numerosNe.length === 0 && p.numeroEmpenho) numerosNe.push(p.numeroEmpenho);
                    const ordens = p.ordensBancarias?.length
                      ? p.ordensBancarias
                      : p.numeroOrdemPagamento ? [{ numero: p.numeroOrdemPagamento }] : [];
                    const documentos = p.documentos ?? [];
                    const linhasDoc = documentos.length > 0 ? documentos : [undefined];
                    const algumValorPorNf = documentos.some((d) => d.valor !== undefined);
                    // OBs sem NF indicada valem pra fatura toda e aparecem na 1ª linha.
                    const obsGerais = ordens.filter((o) => !('documento' in o) || !o.documento || !documentos.some((d) => d.numero === o.documento));
                    return linhasDoc.map((d, linhaDoc) => {
                      const primeira = linhaDoc === 0;
                      const obsDaNf = d
                        ? ordens.filter((o) => 'documento' in o && o.documento === d.numero).map((o) => o.numero)
                        : [];
                      const obs = [...obsDaNf, ...(primeira ? obsGerais.map((o) => o.numero) : [])];
                      const mostraMes = primeiraDoMes;
                      primeiraDoMes = false;
                      return (
                        <tr key={`${p.id}-${linhaDoc}`} className={`border-b border-gray-100 align-top ${arquivado ? 'bg-gray-50 text-gray-400 line-through' : ''}`}>
                          <td className="px-2 py-1.5 font-semibold no-underline">{mostraMes ? nomeMes : ''}</td>
                          <td className="px-2 py-1.5">{p.paeFatura || '-'}</td>
                          <td className="px-2 py-1.5">
                            {d ? `${d.tipo} ${d.numero}` : '-'}
                            {primeira && diferenca !== null && diferenca !== 0 && (
                              <span className="ml-1 inline-block px-1 rounded bg-amber-100 text-amber-800 no-underline" title="A soma das NFs não bate com o valor da fatura">
                                NFs somam {formatarMoeda(Math.abs(valorDoPagamento(p) - diferenca))}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">
                            {d && algumValorPorNf ? (d.valor !== undefined ? formatarMoeda(d.valor) : '-') : primeira ? formatarMoeda(valorDoPagamento(p)) : ''}
                          </td>
                          <td className="px-2 py-1.5">{primeira ? numerosNe.join(' / ') || '-' : ''}</td>
                          <td className="px-2 py-1.5">{obs.join(' / ') || '-'}</td>
                          <td className={`px-2 py-1.5 ${statusDoPagamento(p) === 'em_tramitacao' && p.etapa ? 'text-amber-800 font-medium' : ''}`}>
                            {primeira ? (arquivado ? 'ARQUIVADO (fora da soma)' : descreverAndamento(p)) : ''}
                            {primeira && podeEditar && (
                              <Link to={`/sistema/financeiro/pagamentos/${p.id}/editar`} className="ml-2 text-red-700 no-underline hover:underline">editar</Link>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap font-semibold no-underline">
                            {mostraMes ? formatarMoeda(totalMes?.total ?? 0) : ''}
                          </td>
                          <td className="px-2 py-1.5 text-center">{primeira && p.autenticado ? 'SIM' : ''}</td>
                        </tr>
                      );
                    });
                  });
                })}
              </tbody>
              <tfoot className="bg-blue-700 text-white font-semibold">
                <tr>
                  <td colSpan={7} className="px-2 py-2 text-right">TOTAL ANO</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{formatarMoeda(totalAno)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-200 bg-gray-50">
            <div><p className="text-[11px] uppercase text-gray-500">Total do ano (não arquivado)</p><p className="text-sm font-bold">{formatarMoeda(totalAno)}</p></div>
            <div><p className="text-[11px] uppercase text-gray-500">Já pago (com OB)</p><p className="text-sm font-bold text-emerald-700">{formatarMoeda(totalPago)}</p></div>
            <div><p className="text-[11px] uppercase text-gray-500">Empenhado (origem + reforços)</p><p className="text-sm font-bold">{formatarMoeda(saldo.empenhado)}</p></div>
            <div><p className="text-[11px] uppercase text-gray-500">Saldo de NE</p><p className={`text-sm font-bold ${saldo.saldo < 0 ? 'text-red-700' : ''}`}>{formatarMoeda(saldo.saldo)}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
