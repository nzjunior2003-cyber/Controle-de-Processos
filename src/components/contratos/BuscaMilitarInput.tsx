import { useEffect, useRef, useState } from 'react';
import { buscarMilitares, formatarNomeMilitar, type Militar } from '../../lib/militares';

interface Props {
  militares: Militar[];
  value: string;
  onChange: (valor: string) => void;
  className: string;
  placeholder?: string;
}

/**
 * Campo de texto livre para Fiscal/Suplente que também busca na planilha
 * de militares (por cargo, nome, MF ou UBM) e sugere candidatos — sem
 * travar a digitação: o Gestor pode sempre digitar manualmente, a lista
 * de sugestões é só um atalho.
 */
export default function BuscaMilitarInput({ militares, value, onChange, className, placeholder }: Props) {
  const [sugestoesVisiveis, setSugestoesVisiveis] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setSugestoesVisiveis(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const sugestoes = sugestoesVisiveis ? buscarMilitares(militares, value) : [];

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSugestoesVisiveis(true);
        }}
        onFocus={() => setSugestoesVisiveis(true)}
        className={className}
        placeholder={placeholder ?? 'Digite ou busque por cargo, nome, MF ou UBM...'}
        autoComplete="off"
      />
      {sugestoes.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto text-sm">
          {sugestoes.map((militar, indice) => (
            <li
              key={indice}
              onClick={() => {
                onChange(formatarNomeMilitar(militar));
                setSugestoesVisiveis(false);
              }}
              className="px-3 py-2 hover:bg-red-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <p className="font-medium text-gray-900">{formatarNomeMilitar(militar)}</p>
              <p className="text-xs text-gray-500">MF: {militar.mf || '—'} · UBM: {militar.ubm || '—'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
