import React, { useState, useRef, useEffect } from 'react';
import { PCA } from '../types';

interface PcaAutocompleteProps {
  pcas: PCA[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (pca: PCA) => void;
  placeholder?: string;
  name?: string;
  className?: string;
}

export function PcaAutocomplete({ pcas, value, onChange, onSelect, placeholder, name, className }: PcaAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter based on input
  const filtered = value 
    ? pcas.filter(p => 
        p.codigo_pca.toLowerCase().includes(value.toLowerCase()) || 
        p.objeto_pca.toLowerCase().includes(value.toLowerCase()) ||
        p.unidade_responsavel.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 50) 
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value) setIsOpen(true);
        }}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm mt-1">
          {filtered.map((p, index) => (
            <li
              key={index}
              className="cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-red-50 text-gray-900 border-b border-gray-100 last:border-0"
              onClick={() => {
                onChange(`Ordem: ${p.codigo_pca} - ${p.objeto_pca}`);
                onSelect(p);
                setIsOpen(false);
              }}
            >
              <div className="flex flex-col">
                <span className="font-medium text-sm text-gray-900 line-clamp-1">Ordem: {p.codigo_pca} - {p.objeto_pca}</span>
                <span className="text-xs text-gray-500 mt-0.5">{p.unidade_responsavel} • {p.fonte_recurso} • R$ {p.valor_previsto?.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
