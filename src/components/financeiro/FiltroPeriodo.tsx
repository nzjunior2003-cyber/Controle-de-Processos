import { NOMES_MESES, alternarValor, filtroPeriodoAtivo, type FiltroPeriodo as Filtro } from '../../lib/periodo';

interface Props {
  valor: Filtro;
  onChange: (valor: Filtro) => void;
  anosDisponiveis: number[];
}

const CHIP = 'px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer select-none transition-colors';
const CHIP_ON = 'bg-red-700 text-white border-red-700';
const CHIP_OFF = 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';

/** Seleção de vários anos e/ou vários meses (nada marcado = todos). */
export default function FiltroPeriodo({ valor, onChange, anosDisponiveis }: Props) {
  return (
    <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase w-12">Anos</span>
        {anosDisponiveis.map((ano) => (
          <button
            key={ano}
            type="button"
            aria-pressed={valor.anos.includes(ano)}
            onClick={() => onChange({ ...valor, anos: alternarValor(valor.anos, ano) })}
            className={`${CHIP} ${valor.anos.includes(ano) ? CHIP_ON : CHIP_OFF}`}
          >
            {ano}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase w-12">Meses</span>
        {NOMES_MESES.map((nome, indice) => {
          const mes = indice + 1;
          return (
            <button
              key={nome}
              type="button"
              aria-pressed={valor.meses.includes(mes)}
              onClick={() => onChange({ ...valor, meses: alternarValor(valor.meses, mes) })}
              className={`${CHIP} ${valor.meses.includes(mes) ? CHIP_ON : CHIP_OFF}`}
            >
              {nome}
            </button>
          );
        })}
        {filtroPeriodoAtivo(valor) && (
          <button type="button" onClick={() => onChange({ anos: [], meses: [] })} className="ml-2 text-xs font-medium text-red-700 hover:underline">
            Limpar período
          </button>
        )}
      </div>
    </div>
  );
}
