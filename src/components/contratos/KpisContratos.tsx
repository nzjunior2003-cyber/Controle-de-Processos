import { AlertTriangle, Archive, CheckCircle, Clock, FileSignature } from 'lucide-react';
import type { ContratoComStatus } from '../../lib/contratos';

export type FiltroKpi = 'vigentes' | 'atencao' | 'vencidos' | 'concluidos' | null;

interface Props {
  contratos: ContratoComStatus[];
  /** Quando informado, os cards viram filtros clicáveis. */
  filtro?: FiltroKpi;
  onFiltrar?: (filtro: FiltroKpi) => void;
}

export default function KpisContratos({ contratos, filtro, onFiltrar }: Props) {
  // Contratos já concluídos não contam nos KPIs de vigência/vencimento —
  // não há mais nada pendente neles, mesmo que a data já tenha passado.
  const contratosAtivos = contratos.filter((c) => !c.concluido);
  const vigentes = contratosAtivos.filter((c) => c.diasRestantes > 90).length;
  const atencao = contratosAtivos.filter((c) => c.diasRestantes >= 0 && c.diasRestantes <= 90).length;
  const vencidos = contratosAtivos.filter((c) => c.diasRestantes < 0).length;
  // Concluídos/encerrados (marcados pelo Gestor) — ficam fora de vigência e vencimento.
  const concluidos = contratos.filter((c) => c.concluido).length;
  const valorTotalVigente = contratosAtivos
    .filter((c) => c.diasRestantes >= 0)
    .reduce((acumulado, atual) => acumulado + (atual.valorGlobal || 0), 0);

  const clicavel = !!onFiltrar;
  const classeBase = 'bg-white px-3 py-2 rounded-lg border shadow-sm border-l-[3px] transition-colors';

  const classeCard = (chave: Exclude<FiltroKpi, null> | 'total', borda: string, ativo: string) =>
    `${classeBase} ${borda} ${clicavel ? 'cursor-pointer' : ''} ${
      clicavel && (chave === 'total' ? filtro === null : filtro === chave)
        ? ativo
        : 'border-gray-200 hover:bg-gray-50'
    }`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div
        onClick={() => onFiltrar?.(filtro === 'vigentes' ? null : 'vigentes')}
        className={classeCard('vigentes', 'border-l-emerald-500', 'ring-2 ring-emerald-500 bg-emerald-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">Contratos Vigentes</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{vigentes}</h3>
          </div>
          <CheckCircle className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(filtro === 'atencao' ? null : 'atencao')}
        className={classeCard('atencao', 'border-l-amber-500', 'ring-2 ring-amber-500 bg-amber-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">Vencendo (Até 90 dias)</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{atencao}</h3>
          </div>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(filtro === 'vencidos' ? null : 'vencidos')}
        className={classeCard('vencidos', 'border-l-red-600', 'ring-2 ring-red-600 bg-red-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">Contratos Vencidos</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{vencidos}</h3>
          </div>
          <AlertTriangle className="w-4 h-4 text-red-600" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(filtro === 'concluidos' ? null : 'concluidos')}
        className={classeCard('concluidos', 'border-l-slate-500', 'ring-2 ring-slate-500 bg-slate-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">Concluídos / Encerrados</p>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{concluidos}</h3>
          </div>
          <Archive className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      <div
        onClick={() => onFiltrar?.(null)}
        className={classeCard('total', 'border-l-blue-600', 'ring-2 ring-blue-600 bg-blue-50')}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide leading-tight">Valor Global Ativo</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">
              {valorTotalVigente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
          </div>
          <FileSignature className="w-4 h-4 text-blue-600" />
        </div>
      </div>
    </div>
  );
}
