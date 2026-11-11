import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { itensDaArp, saldoDaArp, valorUtilizadoNaArp } from '../../lib/arp';
import { formatarMoeda, parseValorMonetario } from '../../lib/contratos';
import type { ArpUtilizada, Contrato, ItemUtilizadoArp, ProcedimentoLicitatorio, Processo } from '../../types';

interface Props {
  /** Atas do Órgão (CBMPA gerenciador) que podem ser escolhidas. */
  atas: ProcedimentoLicitatorio[];
  contratos: Contrato[];
  processos: Processo[];
  /** O próprio processo, quando em edição — o que ele já consumiu não entra duas vezes no saldo. */
  processoId?: string;
  /** Texto do campo "Valor Estimado", sugerido quando a ata é só de valor. */
  valorEstimado: string;
  valor: ArpUtilizada | null;
  onChange: (valor: ArpUtilizada | null) => void;
}

const CLASSE_INPUT =
  'block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-1.5 px-2 border';

/**
 * Processo de rito "Gerenciador da ARP": escolhe a ata do Órgão que ele utiliza e informa o que consome dela —
 * os itens e quantidades (ata com itens) ou o valor (ata de serviço, só com valor total). Mostra o saldo da ata e
 * AVISA, sem bloquear, quando o que foi pedido passa do saldo.
 */
export default function UsoDeAtaGerenciador({ atas, contratos, processos, processoId, valorEstimado, valor, onChange }: Props) {
  const ata = atas.find((a) => a.id === valor?.arpId);
  const itensAta = useMemo(() => (ata ? itensDaArp(ata) : []), [ata]);
  const saldo = useMemo(
    () => (ata ? saldoDaArp(ata, contratos, processos.filter((p) => p.id !== processoId)) : null),
    [ata, contratos, processos, processoId],
  );
  const [valorTexto, setValorTexto] = useState(valor?.valor != null ? String(valor.valor).replace('.', ',') : '');

  const deste = valor ? valorUtilizadoNaArp(valor) : 0;
  const restante = saldo ? saldo.saldo - deste : 0;
  const passouDoValor = !!saldo && saldo.registrado > 0 && restante < 0;
  const quantidadeDoItem = (idx: number) => valor?.itens?.find((i) => i.idx === idx)?.quantidade ?? 0;
  const itensEstouradosNoSaldo = saldo
    ? saldo.itens.filter((item) => quantidadeDoItem(item.idx) > 0 && item.saldo - quantidadeDoItem(item.idx) < 0)
    : [];

  const escolherAta = (id: string) => {
    setValorTexto('');
    onChange(id ? { arpId: id } : null);
  };

  const alterarQuantidade = (idx: number, descricao: string, valorUnitario: number, texto: string) => {
    if (!valor) return;
    const quantidade = Number(texto.replace(',', '.')) || 0;
    const outros = (valor.itens ?? []).filter((i) => i.idx !== idx);
    const itens: ItemUtilizadoArp[] = quantidade > 0 ? [...outros, { idx, descricao, quantidade, valorUnitario }] : outros;
    onChange({ arpId: valor.arpId, itens: itens.sort((a, b) => a.idx - b.idx) });
  };

  const alterarValor = (texto: string) => {
    setValorTexto(texto);
    if (!valor) return;
    const numero = parseValorMonetario(texto);
    onChange({ arpId: valor.arpId, ...(numero > 0 ? { valor: numero } : {}) });
  };

  const valorEstimadoNumero = Number(valorEstimado.replace(',', '.')) || 0;

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <label htmlFor="arpUtilizada" className="block text-sm font-medium text-gray-700">
          Ata do Órgão utilizada por este processo
        </label>
        <select
          id="arpUtilizada"
          value={valor?.arpId ?? ''}
          onChange={(e) => escolherAta(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
        >
          <option value="">Selecione a ata...</option>
          {atas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.numero} — {a.objeto}
              {a.fornecedor ? ` (${a.fornecedor})` : ''}
            </option>
          ))}
        </select>
        {atas.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Nenhuma ata do Órgão cadastrada. Cadastre em Contratos e ARPs › Gerenciador da ARP (&quot;Nova Ata&quot;).
          </p>
        )}
      </div>

      {ata && saldo && (
        <>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <p><span className="block text-gray-500 uppercase">Registrado</span><strong>{saldo.registrado > 0 ? formatarMoeda(saldo.registrado) : 'não informado'}</strong></p>
            <p><span className="block text-gray-500 uppercase">Já utilizado</span><strong>{formatarMoeda(saldo.utilizado)}</strong></p>
            <p>
              <span className="block text-gray-500 uppercase">Saldo antes deste processo</span>
              <strong className={saldo.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}>{saldo.registrado > 0 ? formatarMoeda(saldo.saldo) : '-'}</strong>
            </p>
          </div>

          {itensAta.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 uppercase">
                    <th className="py-1 pr-3 font-medium">Item</th>
                    <th className="py-1 pr-3 font-medium">Saldo (qtd)</th>
                    <th className="py-1 pr-3 font-medium">Valor unit.</th>
                    <th className="py-1 font-medium">Quantidade deste processo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {saldo.itens.map((item) => (
                    <tr key={item.idx}>
                      <td className="py-1.5 pr-3 text-gray-900">{item.descricao}</td>
                      <td className={`py-1.5 pr-3 ${item.saldo <= 0 ? 'text-red-700' : 'text-gray-700'}`}>{item.saldo} de {item.registrada}</td>
                      <td className="py-1.5 pr-3 text-gray-700">{formatarMoeda(item.valorUnitario)}</td>
                      <td className="py-1.5 w-40">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={quantidadeDoItem(item.idx) || ''}
                          onChange={(e) => alterarQuantidade(item.idx, item.descricao, item.valorUnitario, e.target.value)}
                          className={CLASSE_INPUT}
                          aria-label={`Quantidade de ${item.descricao}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-gray-700">
                Valor deste processo na ata: <strong>{formatarMoeda(deste)}</strong> (quantidade × valor do item)
              </p>
            </div>
          ) : (
            <div className="max-w-sm">
              <label htmlFor="valorAta" className="block text-xs font-medium text-gray-600 uppercase">Valor a utilizar da ata (R$)</label>
              <input
                id="valorAta"
                type="text"
                inputMode="decimal"
                value={valorTexto}
                onChange={(e) => alterarValor(e.target.value)}
                className={`${CLASSE_INPUT} mt-1`}
                placeholder="Ex.: 40.000,00"
              />
              {valorEstimadoNumero > 0 && !valor?.valor && (
                <button
                  type="button"
                  onClick={() => alterarValor(String(valorEstimadoNumero).replace('.', ','))}
                  className="mt-1 text-xs font-medium text-red-700 hover:underline"
                >
                  Usar o valor estimado do processo ({formatarMoeda(valorEstimadoNumero)})
                </button>
              )}
              <p className="mt-1 text-xs text-gray-500">Ata de serviço: só o valor total é controlado, sem quantidade.</p>
            </div>
          )}

          {(passouDoValor || itensEstouradosNoSaldo.length > 0) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900" role="alert">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                {passouDoValor && <p>Este processo passa do saldo da ata em {formatarMoeda(Math.abs(restante))}. O cadastro continua permitido.</p>}
                {itensEstouradosNoSaldo.map((item) => (
                  <p key={item.idx}>
                    {item.descricao}: pede {quantidadeDoItem(item.idx)} e o saldo é {item.saldo}.
                  </p>
                ))}
              </div>
            </div>
          )}
          {!passouDoValor && saldo.registrado > 0 && deste > 0 && (
            <p className="text-xs text-gray-600">Saldo da ata depois deste processo: <strong>{formatarMoeda(restante)}</strong></p>
          )}
        </>
      )}
    </div>
  );
}
