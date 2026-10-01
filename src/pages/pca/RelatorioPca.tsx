import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import { corDoSetor } from '../../lib/coresSetor';
import { filtrarItensPca } from '../../lib/pca';

/**
 * Relatório do PCA para impressão/PDF, com o cabeçalho institucional.
 * Reflete os mesmos filtros da listagem (exercício, prioridade e busca,
 * recebidos por parâmetro de URL) e usa a impressão do próprio navegador
 * ("Imprimir / Salvar PDF"), sem depender de serviço externo — o mesmo
 * padrão do relatório de auditoria de contrato.
 */
export default function RelatorioPca() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pcas, usuarioAtual } = useApp();

  const exercicioParam = params.get('exercicio') ?? '';
  const exercicio = exercicioParam ? Number(exercicioParam) : '';
  const prioridade = params.get('prioridade') ?? '';
  const busca = params.get('busca') ?? '';

  const itens = useMemo(
    () => filtrarItensPca(pcas, { exercicio, prioridade, busca }),
    [pcas, exercicio, prioridade, busca],
  );
  const valorTotal = itens.reduce((acc, p) => acc + (p.valor_previsto || 0), 0);

  const filtrosAplicados = [
    prioridade ? `Prioridade: ${prioridade}` : '',
    busca ? `Busca: "${busca}"` : '',
  ].filter(Boolean);

  const corExata = { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as const;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{'@page { size: A4 landscape; margin: 12mm; }'}</style>

      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="max-w-6xl mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 p-8 print:p-0 text-sm text-gray-900">
        <header className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-4">
          <img src="/logo-qcg.png" alt="Brasão do CBMPA" className="h-20 w-20 object-contain flex-shrink-0" />
          <div className="flex-1 text-center">
            <p className="text-sm font-bold uppercase tracking-wide">Corpo de Bombeiros Militar do Pará</p>
            <p className="text-xs uppercase tracking-wide text-gray-600">Departamento Geral de Administração</p>
            <h1 className="text-lg font-bold mt-2">
              Plano de Contratação Anual{exercicio !== '' ? ` — Exercício ${exercicio}` : ' — Todos os Exercícios'}
            </h1>
          </div>
          <div className="w-20 flex-shrink-0" aria-hidden="true" />
        </header>

        <p className="text-xs text-gray-500 mb-4">
          Gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}
          {usuarioAtual?.nome ? ` por ${usuarioAtual.nome}` : ''} · {itens.length} item(ns) · Valor total previsto:{' '}
          <span className="font-semibold text-gray-900">{formatarMoeda(valorTotal)}</span>
          {filtrosAplicados.length > 0 ? ` · ${filtrosAplicados.join(' · ')}` : ''}
        </p>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100" style={corExata}>
              <th className="border border-gray-300 px-2 py-1.5 text-left w-12">Nº</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left w-24">Setor</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left">Descrição</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left w-40">Modalidade / Rito</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-28">Valor Previsto</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-20">Prioridade</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-20">QDQQ</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const setor = item.origem || item.unidade_responsavel;
              const cor = corDoSetor(setor);
              const quadrimestres = (['q1', 'q2', 'q3', 'q4'] as const)
                .map((chave, indice) => (item.qdqq?.[chave] ? `${indice + 1}º` : ''))
                .filter(Boolean)
                .join(', ');
              return (
                <tr key={item.id} className="align-top" style={{ breakInside: 'avoid' }}>
                  <td className="border border-gray-300 px-2 py-1.5 font-semibold">{item.codigo_pca}</td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-medium ${cor.bg} ${cor.text}`} style={corExata}>
                      {setor || '-'}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    {item.objeto_pca}
                    {item.numero_pae && <span className="block text-gray-500">PAE: {item.numero_pae}</span>}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">{item.modalidade_licitacao || '-'}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatarMoeda(item.valor_previsto)}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center">{item.prioridade || '-'}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center">{quadrimestres || '-'}</td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={7} className="border border-gray-300 px-2 py-6 text-center text-gray-500">
                  Nenhum item do PCA para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
          {itens.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold" style={corExata}>
                <td colSpan={4} className="border border-gray-300 px-2 py-1.5 text-right">Total previsto</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap">{formatarMoeda(valorTotal)}</td>
                <td colSpan={2} className="border border-gray-300" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
