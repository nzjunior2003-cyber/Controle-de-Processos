import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatarMoeda } from '../../lib/contratos';
import type { Contrato } from '../../types';

/** Normaliza pra comparar sem acento/caixa. */
const normalizar = (texto?: string) =>
  (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Primeiro passo de "Novo pagamento": achar o contrato por número, fornecedor,
 * objeto, fiscal, PAE ou CNPJ. Escolhido o contrato, a tela do pagamento abre
 * já com os dados dos demais módulos (contrato, fiscal, NFs a pagar, NEs).
 */
export default function BuscaContrato({ onSelecionar }: { onSelecionar: (contrato: Contrato) => void }) {
  const { contratos } = useApp();
  const [busca, setBusca] = useState('');

  const resultados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    return contratos
      .filter((c) => {
        const alvo = normalizar(
          [c.numero, c.empresa, c.objeto, c.cnpj, c.pae, c.fiscalTitular, c.fiscalSuplente, c.portaria, c.fonteRecurso].join(' '),
        );
        return termos.every((t) => alvo.includes(t));
      })
      .sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }))
      .slice(0, 50);
  }, [contratos, busca]);

  return (
    <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Escolha o contrato</h2>
        <p className="text-xs text-gray-500 mt-1">Busque por número, fornecedor, objeto, fiscal, PAE ou CNPJ.</p>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
          placeholder="Ex.: 133/2024, webtrip, passagem aérea, nome do fiscal..."
        />
      </div>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md max-h-96 overflow-y-auto">
        {resultados.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onSelecionar(c)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">{c.numero} — {c.empresa}</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">Saldo {formatarMoeda(c.saldoAtualFinanceiro ?? 0)}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{c.objeto}</p>
              {c.fiscalTitular && <p className="text-xs text-gray-400">Fiscal: {c.fiscalTitular}</p>}
            </button>
          </li>
        ))}
        {resultados.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-500">Nenhum contrato encontrado.</li>}
      </ul>
    </section>
  );
}
