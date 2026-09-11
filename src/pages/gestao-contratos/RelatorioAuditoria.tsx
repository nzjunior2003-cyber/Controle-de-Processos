import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import {
  calcularStatusContrato,
  formatarMoeda,
  TIPO_ADITIVO_LABELS,
  TIPO_OCORRENCIA_LABELS,
} from '../../lib/contratos';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

/**
 * Relatório de auditoria da execução de um contrato: reconstitui, a
 * partir do estado atual do sistema, tudo o que foi lançado até o
 * momento da geração (execuções, ocorrências e aditivos, em ordem
 * cronológica) — pensado pra impressão/exportação em PDF pelo próprio
 * navegador (sem depender de nenhum serviço externo).
 */
export default function RelatorioAuditoriaContrato() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contratos, execucoes, ocorrencias, aditivos, usuarioAtual } = useApp();

  const contrato = contratos.find((c) => c.id === id);

  if (!contrato) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>Contrato não encontrado.</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </button>
      </div>
    );
  }

  const contratoComStatus = calcularStatusContrato(contrato);

  const execucoesDoContrato = execucoes
    .filter((e) => e.contratoId === contrato.id)
    .slice()
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const ocorrenciasDoContrato = ocorrencias
    .filter((o) => o.contratoId === contrato.id)
    .slice()
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const aditivosDoContrato = aditivos
    .filter((a) => a.contratoId === contrato.id)
    .slice()
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const valorExecutado = execucoesDoContrato.reduce((acc, atual) => acc + atual.valor, 0);
  const percExecutado = contrato.valorGlobal
    ? ((valorExecutado / contrato.valorGlobal) * 100).toFixed(1)
    : '0.0';
  const saldoAtual = contrato.saldoAtualFinanceiro ?? contrato.valorGlobal - valorExecutado;

  const agora = new Date();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
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

      <div className="max-w-4xl mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 p-8 print:p-0 text-sm text-gray-900">
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            Corpo de Bombeiros Militar do Pará
          </p>
          <h1 className="text-lg font-bold mt-1">Relatório de Auditoria de Execução Contratual</h1>
          <p className="text-xs text-gray-500 mt-1">
            Gerado em {format(agora, 'dd/MM/yyyy HH:mm')}
            {usuarioAtual?.nome ? ` por ${usuarioAtual.nome}` : ''}
          </p>
        </div>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-700 border-b border-gray-300 pb-1 mb-3">
            Identificação do Contrato
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div><dt className="text-xs text-gray-500">Nº do Contrato</dt><dd className="font-medium">{contrato.numero}</dd></div>
            <div><dt className="text-xs text-gray-500">PAE</dt><dd className="font-medium">{contrato.pae || '-'}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-gray-500">Empresa Contratada</dt><dd className="font-medium">{contrato.empresa}{contrato.cnpj ? ` — CNPJ ${contrato.cnpj}` : ''}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-gray-500">Objeto</dt><dd>{contrato.objeto}</dd></div>
            <div><dt className="text-xs text-gray-500">Vigência</dt><dd>{formatarData(contrato.inicioVigencia)} a {formatarData(contrato.fimVigencia)}</dd></div>
            <div><dt className="text-xs text-gray-500">Situação</dt><dd className="font-medium">{contratoComStatus.badge}</dd></div>
            <div><dt className="text-xs text-gray-500">Fiscal Titular</dt><dd>{contrato.fiscalTitular || '-'}</dd></div>
            <div><dt className="text-xs text-gray-500">Fiscal Suplente</dt><dd>{contrato.fiscalSuplente || '-'}</dd></div>
          </dl>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-700 border-b border-gray-300 pb-1 mb-3">
            Resumo Financeiro
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border border-gray-200 rounded-md p-3">
              <p className="text-xs text-gray-500 uppercase">Valor Global</p>
              <p className="text-base font-bold">{formatarMoeda(contrato.valorGlobal)}</p>
            </div>
            <div className="border border-gray-200 rounded-md p-3">
              <p className="text-xs text-gray-500 uppercase">Executado ({percExecutado}%)</p>
              <p className="text-base font-bold text-red-700">{formatarMoeda(valorExecutado)}</p>
            </div>
            <div className="border border-gray-200 rounded-md p-3">
              <p className="text-xs text-gray-500 uppercase">Saldo Atual</p>
              <p className="text-base font-bold text-emerald-700">{formatarMoeda(saldoAtual)}</p>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-700 border-b border-gray-300 pb-1 mb-3">
            Execuções Financeiras ({execucoesDoContrato.length})
          </h2>
          {execucoesDoContrato.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma execução lançada até o momento.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left text-xs text-gray-500 uppercase">
                  <th className="py-1.5 pr-2">Data</th>
                  <th className="py-1.5 pr-2">Documento</th>
                  <th className="py-1.5 pr-2">Observação</th>
                  <th className="py-1.5 pr-2 text-right">Qtd.</th>
                  <th className="py-1.5 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {execucoesDoContrato.map((exec) => (
                  <tr key={exec.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{formatarData(exec.data)}</td>
                    <td className="py-1.5 pr-2">{exec.tipo || 'NF/Fatura'}: {exec.nf}</td>
                    <td className="py-1.5 pr-2 text-gray-600">{exec.observacao || '-'}</td>
                    <td className="py-1.5 pr-2 text-right">{exec.quantidade ?? '-'}</td>
                    <td className="py-1.5 text-right font-medium">{formatarMoeda(exec.valor)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="py-2 pr-2 text-right font-bold">Total Executado</td>
                  <td className="py-2 text-right font-bold">{formatarMoeda(valorExecutado)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-700 border-b border-gray-300 pb-1 mb-3">
            Aditivos ({aditivosDoContrato.length})
          </h2>
          {aditivosDoContrato.length === 0 ? (
            <p className="text-gray-500 italic">Nenhum aditivo registrado até o momento.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-left text-xs text-gray-500 uppercase">
                  <th className="py-1.5 pr-2">Data</th>
                  <th className="py-1.5 pr-2">Tipo</th>
                  <th className="py-1.5 pr-2">Nº / Processo</th>
                  <th className="py-1.5 pr-2">Nova Vigência</th>
                  <th className="py-1.5 text-right">Valor Acrescido</th>
                </tr>
              </thead>
              <tbody>
                {aditivosDoContrato.map((aditivo) => (
                  <tr key={aditivo.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{formatarData(aditivo.data)}</td>
                    <td className="py-1.5 pr-2">{TIPO_ADITIVO_LABELS[aditivo.tipo] ?? aditivo.tipo}</td>
                    <td className="py-1.5 pr-2">{aditivo.numero}</td>
                    <td className="py-1.5 pr-2">{aditivo.novaFimVigencia ? formatarData(aditivo.novaFimVigencia) : '-'}</td>
                    <td className="py-1.5 text-right font-medium">
                      {typeof aditivo.valorAcrescido === 'number' ? formatarMoeda(aditivo.valorAcrescido) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase text-gray-700 border-b border-gray-300 pb-1 mb-3">
            Ocorrências ({ocorrenciasDoContrato.length})
          </h2>
          {ocorrenciasDoContrato.length === 0 ? (
            <p className="text-gray-500 italic">Nenhuma ocorrência registrada até o momento.</p>
          ) : (
            <ul className="space-y-2">
              {ocorrenciasDoContrato.map((ocorrencia) => (
                <li key={ocorrencia.id} className="border border-gray-200 rounded-md p-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium uppercase text-gray-500">
                      {TIPO_OCORRENCIA_LABELS[ocorrencia.tipo] ?? ocorrencia.tipo}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatarData(ocorrencia.data)} — {ocorrencia.registradoPorNome}
                    </span>
                  </div>
                  <p className="mt-1">{ocorrencia.descricao}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[10px] text-gray-400 border-t border-gray-200 pt-3 mt-8">
          Relatório gerado automaticamente pelo sistema de Controle de Processos do CBMPA, com base
          nos dados cadastrados até {format(agora, 'dd/MM/yyyy HH:mm')}. Alterações lançadas após
          esse momento não constam neste documento.
        </p>
      </div>
    </div>
  );
}
