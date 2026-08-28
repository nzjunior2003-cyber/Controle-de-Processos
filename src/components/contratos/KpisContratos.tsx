import { AlertTriangle, CheckCircle, Clock, FileSignature } from 'lucide-react';
import type { ContratoComStatus } from '../../lib/contratos';

export type FiltroKpi = 'vigentes' | 'atencao' | 'vencidos' | null;

interface Props {
  contratos: ContratoComStatus[];
  /** Quando informado, os cards viram filtros clicáveis. */
  filtro?: FiltroKpi;
  onFiltrar?: (filtro: FiltroKpi) => void;
}

export default function KpisContratos({ contratos, filtro, onFiltrar }: Props) {
  const vigentes = contratos.filter((c) => c.diasRestantes > 90).length;
  const atencao = contratos.filter((c) => c.diasRestantes >= 0 && c.diasRestantes <= 90).length;
  const vencidos = contratos.filter((c) => c.diasRestantes < 0).length;
  const valorTotalVigente = contratos
    .filter((c) => c.diasRestantes >= 0)
    .reduce((acumulado, atual) => acumulado + (atual.valorGlobal || 0), 0);

  const clicavel = !!onFiltrar;
  const classeBase = 'bg-white p-5 rounded-lg border shadow-sm border-l-4 transition-colors';

  const classeCard = (chave: Exclude<FiltroKpi, null> | 'total', borda: string, ativo: string) =>
    `${classeBase} ${borda} ${clicavel ? 'cursor-pointer' : ''} ${
      clicavel && (chave === 'total' ? filtro === null : filtro === chave)
        ? ativo
        : 'border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div
        onClick={() => onFiltrar?.(filtro === 'vigentes' ? null : 'vigentes')}
        className={classeCard('vigentes', 'border-l-emerald-500', 'ring-2 ring-emerald-500 bg-emerald-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos Vigentes</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{vigentes}</h3>
          </div>
          <CheckCircle className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(filtro === 'atencao' ? null : 'atencao')}
        className={classeCard('atencao', 'border-l-amber-500', 'ring-2 ring-amber-500 bg-amber-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Vencendo (Até 90 dias)</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{atencao}</h3>
          </div>
          <Clock className="w-5 h-5 text-amber-500" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(filtro === 'vencidos' ? null : 'vencidos')}
        className={classeCard('vencidos', 'border-l-red-600', 'ring-2 ring-red-600 bg-red-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos Vencidos</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">{vencidos}</h3>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(null)}
        className={classeCard('total', 'border-l-blue-600', 'ring-2 ring-blue-600 bg-blue-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Global Ativo</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              {valorTotalVigente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
          </div>
          <FileSignature className="w-5 h-5 text-blue-600" />
        </div>
      </div>
    </div>
  );
}
