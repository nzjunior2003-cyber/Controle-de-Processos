import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import { filaAPagar } from '../../lib/financeiro';

/**
 * NFs/faturas lançadas pelo fiscal que ainda não viraram pagamento. O
 * Financeiro abre o pagamento a partir daqui (a NF já vem incluída); a partir
 * daí cada mudança de etapa avisa o fiscal.
 */
export default function FilaAPagar() {
  const { execucoes, pagamentos, contratos, usuarioAtual } = useApp();
  const navigate = useNavigate();
  const podeLancar = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'financeiro';

  const fila = useMemo(
    () =>
      filaAPagar(execucoes, pagamentos).sort((a, b) => (a.criado_em ?? a.data).localeCompare(b.criado_em ?? b.data)),
    [execucoes, pagamentos],
  );
  const contratoPorId = useMemo(() => new Map(contratos.map((c) => [c.id, c])), [contratos]);
  const total = fila.reduce((acc, e) => acc + e.valor, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
        <p className="text-sm text-gray-600">{fila.length} NF/fatura(s) aguardando pagamento</p>
        <p className="text-sm font-semibold text-gray-900">Total: {formatarMoeda(total)}</p>
      </div>
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contrato / Fornecedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NF / Fatura</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiscal</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aguardando há</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fila.map((e) => {
              const contrato = contratoPorId.get(e.contratoId);
              const dias = differenceInDays(new Date(), new Date(e.criado_em ?? e.data));
              return (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{contrato ? contrato.numero : 'Contrato não encontrado'}</div>
                    <div className="text-xs text-gray-500">{contrato?.empresa}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {e.tipo ?? 'NF/Fatura'} {e.nf}
                    <div className="text-xs text-gray-500">{new Date(e.data).toLocaleDateString('pt-BR')}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contrato?.fiscalTitular || '-'}</td>
                  <td className={`px-4 py-3 text-sm text-center ${dias > 15 ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                    {dias <= 0 ? 'hoje' : `${dias} dia(s)`}
                  </td>
                  <td className="px-4 py-3 text-sm text-right whitespace-nowrap">{formatarMoeda(e.valor)}</td>
                  <td className="px-4 py-3 text-right">
                    {podeLancar && (
                      <button
                        type="button"
                        onClick={() => navigate(`/sistema/financeiro/pagamentos/novo?contratoId=${e.contratoId}&execucaoId=${e.id}`)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-700 hover:bg-red-800"
                      >
                        Iniciar pagamento
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {fila.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  Nenhuma NF/fatura aguardando pagamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
