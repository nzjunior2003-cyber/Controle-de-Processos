import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import { SEM_CLASSIFICACAO, descricaoDoCodigo, totaisPorCampoOrcamentario } from '../../lib/orcamento';
import { CAMPOS_ORCAMENTARIOS, type CampoOrcamentario } from '../../types';

/**
 * Visão ampla do Financeiro/DF: quanto já foi pago (OB feita) e quanto está em
 * tramitação em cada fonte, programa de trabalho, natureza de despesa, plano
 * interno, unidade gestora etc. — a partir da classificação de cada pagamento
 * (vinda da dotação lançada no checklist do processo). Arquivados ficam fora.
 */
export default function ControleOrcamentario() {
  const { pagamentos, dotacoes, catalogoOrcamentario } = useApp();
  const [campo, setCampo] = useState<CampoOrcamentario>('fonte');
  const [exercicio, setExercicio] = useState(new Date().getFullYear());

  const anos = useMemo(() => {
    const doPagamento = pagamentos.map((p) => Number((p.competencia ?? p.dataPagamento ?? p.criado_em ?? '').slice(0, 4))).filter(Boolean);
    return Array.from(new Set([new Date().getFullYear(), ...doPagamento])).sort((a, b) => b - a);
  }, [pagamentos]);

  const linhas = useMemo(
    () => totaisPorCampoOrcamentario(pagamentos, dotacoes, campo, exercicio),
    [pagamentos, dotacoes, campo, exercicio],
  );
  const totalPago = linhas.reduce((acc, l) => acc + l.pago, 0);
  const totalTramitacao = linhas.reduce((acc, l) => acc + l.emTramitacao, 0);
  const rotulo = CAMPOS_ORCAMENTARIOS.find((c) => c.chave === campo)?.rotulo ?? '';
  const semClassificacao = linhas.find((l) => l.codigo === SEM_CLASSIFICACAO);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-3">
        <select
          value={campo}
          onChange={(e) => setCampo(e.target.value as CampoOrcamentario)}
          className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
          aria-label="Agrupar por"
        >
          {CAMPOS_ORCAMENTARIOS.map((c) => <option key={c.chave} value={c.chave}>Por {c.rotulo}</option>)}
        </select>
        <select
          value={exercicio}
          onChange={(e) => setExercicio(Number(e.target.value))}
          className="block w-full sm:w-32 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
          aria-label="Exercício"
        >
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Pago em {exercicio}</p>
          <p className="text-xl font-bold text-emerald-700">{formatarMoeda(totalPago)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 uppercase">Em tramitação</p>
          <p className="text-xl font-bold text-amber-700">{formatarMoeda(totalTramitacao)}</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{rotulo}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Faturas</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pago</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Em tramitação</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {linhas.map((l) => (
              <tr key={l.codigo} className={l.codigo === SEM_CLASSIFICACAO ? 'text-gray-400' : ''}>
                <td className="px-4 py-3 text-sm font-medium">{l.codigo}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{descricaoDoCodigo(catalogoOrcamentario, campo, l.codigo) || '-'}</td>
                <td className="px-4 py-3 text-sm text-center">{l.quantidade}</td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatarMoeda(l.pago)}</td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatarMoeda(l.emTramitacao)}</td>
                <td className="px-4 py-3 text-sm text-right whitespace-nowrap font-semibold">{formatarMoeda(l.pago + l.emTramitacao)}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">Nenhum pagamento em {exercicio}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {semClassificacao && (
        <p className="text-xs text-amber-700">
          {semClassificacao.quantidade} fatura(s) sem {rotulo.toLowerCase()} informado — escolha a classificação orçamentária no pagamento
          (as dotações vêm do item "Dotação Orçamentária" do checklist do processo).
        </p>
      )}
    </div>
  );
}
