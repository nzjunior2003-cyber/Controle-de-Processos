import React from 'react';
import type { RegistroFormData } from './abas';

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';

interface Props {
  formData: RegistroFormData;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
}

export default function FormSancionatorio({ formData, onInputChange }: Props) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700">Processo</label>
        <input type="text" name="processo" value={formData.processo || ''} onChange={onInputChange} className={CLASSE_INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Empresa</label>
        <input type="text" name="empresa" value={formData.empresa || ''} onChange={onInputChange} className={CLASSE_INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Motivo</label>
        <textarea name="motivo" rows={3} value={formData.motivo || ''} onChange={onInputChange} className={CLASSE_INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Fase</label>
        <input type="text" name="fase" value={formData.fase || ''} onChange={onInputChange} className={CLASSE_INPUT} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Data de Abertura</label>
        <input type="date" name="dataAbertura" value={formData.dataAbertura || ''} onChange={onInputChange} className={CLASSE_INPUT} />
      </div>
    </>
  );
}
