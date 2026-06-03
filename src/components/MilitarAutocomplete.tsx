import React, { useState, useRef, useEffect } from 'react';
import { Militar } from '../hooks/useMilitares';

interface MilitarAutocompleteProps {
  militares: Militar[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (militar: Militar) => void;
  placeholder?: string;
  name?: string;
  className?: string;
}

export function MilitarAutocomplete({ militares, value, onChange, onSelect, placeholder, name, className }: MilitarAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter based on input
  const filtered = value 
    ? militares.filter(m => 
        m.nome.toLowerCase().includes(value.toLowerCase()) || 
        m.cargo.toLowerCase().includes(value.toLowerCase()) ||
        m.matricula.includes(value)
      ).slice(0, 50) // Limit to 50 results for performance
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
          {filtered.map((m, index) => (
            <li
              key={index}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-red-50 text-gray-900"
              onClick={() => {
                onSelect(m);
                setIsOpen(false);
              }}
            >
              <div className="flex flex-col">
                <span className="font-medium truncate">{m.nome}</span>
                <span className="text-gray-500 text-xs truncate">{m.cargo} - Mat: {m.matricula}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
