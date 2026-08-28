import React from 'react';
import { X } from 'lucide-react';
import type { PCA, PortariaFiscal, Processo } from '../../types';
import type { Militar } from '../../hooks/useMilitares';
import { isAbaProcedimento, type AbaContratos, type RegistroFormData } from './abas';
import FormProcedimento from './FormProcedimento';
import FormSancionatorio from './FormSancionatorio';
import FormPortaria from './FormPortaria';

interface Props {
  abaAtiva: AbaContratos;
  formData: RegistroFormData;
  setFormData: (dados: RegistroFormData) => void;
  processos: Processo[];
  pcas: PCA[];
  portarias: PortariaFiscal[];
  militares: Militar[];
  salvando: boolean;
  onFechar: () => void;
  onSalvar: () => void;
}

export default function RegistroModal({
  abaAtiva,
  formData,
  setFormData,
  processos,
  pcas,
  portarias,
  militares,
  salvando,
  onFechar,
  onSalvar,
}: Props) {
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 overflow-hidden bg-gray-500 bg-opacity-75"
      onClick={onFechar}
    >
      <div
        className="relative bg-white sm:rounded-lg shadow-xl w-full max-w-[100vw] sm:max-w-[95vw] h-full sm:max-h-[95vh] p-4 sm:p-6 text-left transform transition-all flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 sm:mb-5 flex-shrink-0">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {abaAtiva === 'sancionatorios' && 'Novo Processo Sancionatório'}
            {abaAtiva === 'portarias' && 'Nova Portaria de Fiscal'}
            {isAbaProcedimento(abaAtiva) && 'Novo Procedimento'}
          </h3>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-2">
          {isAbaProcedimento(abaAtiva) && (
            <FormProcedimento
              abaAtiva={abaAtiva}
              formData={formData}
              setFormData={setFormData}
              onInputChange={handleInputChange}
              processos={processos}
              pcas={pcas}
              portarias={portarias}
            />
          )}

          {abaAtiva === 'sancionatorios' && (
            <FormSancionatorio formData={formData} onInputChange={handleInputChange} />
          )}

          {abaAtiva === 'portarias' && (
            <FormPortaria
              formData={formData}
              setFormData={setFormData}
              onInputChange={handleInputChange}
              militares={militares}
            />
          )}
        </div>

        <div className="mt-6 sm:flex sm:flex-row-reverse flex-shrink-0 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onSalvar}
            disabled={salvando}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
