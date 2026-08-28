import React from 'react';
import { PlusCircle, X } from 'lucide-react';
import { MilitarAutocomplete } from '../../components/MilitarAutocomplete';
import type { Militar } from '../../hooks/useMilitares';
import type { RegistroFormData } from './abas';

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_INPUT_SEM_MARGEM =
  'block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_CONTATO =
  'mt-1 block w-full bg-white border border-gray-300 rounded py-1.5 px-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-500';
const CLASSE_VINCULADO =
  'mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-600';
const CLASSE_SUB = 'mt-1 block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500';

interface Props {
  formData: RegistroFormData;
  setFormData: (dados: RegistroFormData) => void;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  militares: Militar[];
}

export default function FormPortaria({
  formData,
  setFormData,
  onInputChange,
  militares,
}: Props) {
  const atualizarSubstituicao = (indice: number, campos: Record<string, string>) => {
    const substituicoes = [...(formData.substituicoes || [])];
    substituicoes[indice] = { ...substituicoes[indice], ...campos };
    setFormData({ ...formData, substituicoes });
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Contrato e Portaria</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Nº do Contrato (nnnn/aaaa)</label>
            <input type="text" name="contrato" placeholder="Ex: 015/2026" value={formData.contrato || ''} onChange={onInputChange} className="mt-1 block w-full sm:w-1/2 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 border-l-4 border-emerald-500 pl-4 py-3 bg-emerald-50/50 rounded-r-md">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Objeto do Contrato</label>
              <input type="text" className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa Contratada</label>
              <input type="text" name="empresa" value={formData.empresa || ''} onChange={onInputChange} className="mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800" placeholder="Empresa contratada" />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Homologado</label>
              <input type="text" className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Período de Vigência</label>
              <input type="text" className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
          </div>

          <div className="mt-4 md:col-span-2">
            <div className="flex items-center justify-between max-w-sm mb-1">
              <label className="block text-sm font-medium text-gray-700">Número da Portaria</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    portaria: `0${Math.floor(Math.random() * 90) + 10}/${new Date().getFullYear()}-DP`,
                  })
                }
                className="text-xs text-red-600 font-medium hover:text-red-800"
              >
                Gerar Número
              </button>
            </div>
            <input type="text" name="portaria" placeholder="Ex: 042/2026-DP" value={formData.portaria || ''} onChange={onInputChange} className="block w-full max-w-sm border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm font-medium text-gray-900" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Data de Publicação</label>
            <input type="date" name="dataPublicacao" value={formData.dataPublicacao || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">DOE da Publicação</label>
            <input type="text" name="doe" placeholder="Inserir posteriormente..." value={formData.doe || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">BG da Publicação</label>
            <input type="text" name="bg" placeholder="Inserir posteriormente..." value={formData.bg || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Nomeação de Fiscais</h4>

        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Militar - Fiscal Titular (Nome e Cargo da Planilha)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <MilitarAutocomplete
                  militares={militares}
                  name="fiscalTitularNome"
                  placeholder="Nome do Militar..."
                  value={formData.fiscalTitularNome || formData.fiscalTitular || ''}
                  onChange={(val) => setFormData({ ...formData, fiscalTitularNome: val, fiscalTitular: val })}
                  onSelect={(m) => setFormData({ ...formData, fiscalTitularNome: m.nome, fiscalTitular: m.nome, fiscalTitularCargo: m.cargo })}
                  className={CLASSE_INPUT_SEM_MARGEM}
                />
              </div>
              <div>
                <input type="text" name="fiscalTitularCargo" placeholder="Posto/Graduação (Cargo)..." value={formData.fiscalTitularCargo || ''} onChange={onInputChange} className={CLASSE_INPUT_SEM_MARGEM} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-1 md:col-span-1">
                <label className="block text-xs text-gray-500">Contato</label>
                <input type="text" name="fiscalTitularContato" value={formData.fiscalTitularContato || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="(91) 9..." />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-500">E-mail</label>
                <input type="email" name="fiscalEmail" value={formData.fiscalEmail || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="email@bombeiros.pa.gov.br" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-gray-500">UBM / Lotação</label>
                <input type="text" name="fiscalTitularUbm" value={formData.fiscalTitularUbm || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="Unidade..." />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Militar - Fiscal Suplente (Nome e Cargo da Planilha)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <MilitarAutocomplete
                  militares={militares}
                  name="fiscalSuplenteNome"
                  placeholder="Nome do Militar..."
                  value={formData.fiscalSuplenteNome || formData.fiscalSuplente || ''}
                  onChange={(val) => setFormData({ ...formData, fiscalSuplenteNome: val, fiscalSuplente: val })}
                  onSelect={(m) => setFormData({ ...formData, fiscalSuplenteNome: m.nome, fiscalSuplente: m.nome, fiscalSuplenteCargo: m.cargo })}
                  className={CLASSE_INPUT_SEM_MARGEM}
                />
              </div>
              <div>
                <input type="text" name="fiscalSuplenteCargo" placeholder="Posto/Graduação (Cargo)..." value={formData.fiscalSuplenteCargo || ''} onChange={onInputChange} className={CLASSE_INPUT_SEM_MARGEM} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-1 md:col-span-1">
                <label className="block text-xs text-gray-500">Contato</label>
                <input type="text" name="fiscalSuplenteContato" value={formData.fiscalSuplenteContato || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="(91) 9..." />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs text-gray-500">E-mail</label>
                <input type="email" name="fiscalSuplenteEmail" value={formData.fiscalSuplenteEmail || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="email@bombeiros.pa.gov.br" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-gray-500">UBM / Lotação</label>
                <input type="text" name="fiscalSuplenteUbm" value={formData.fiscalSuplenteUbm || ''} onChange={onInputChange} className={CLASSE_CONTATO} placeholder="Unidade..." />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-base font-medium text-gray-900">Substituições de Fiscais no Contrato</h4>
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                substituicoes: [
                  ...(formData.substituicoes || []),
                  {
                    data: new Date().toISOString().split('T')[0],
                    tipoAfastamento: '',
                    fiscalSubstituto: '',
                  },
                ],
              })
            }
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            <PlusCircle className="mr-1.5 h-4 w-4 text-gray-500" />
            Registrar Substituição
          </button>
        </div>

        {!formData.substituicoes || formData.substituicoes.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-sm text-gray-500">
            Nenhuma substituição registrada nesta portaria ainda.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center w-4 h-full left-4" aria-hidden="true">
              <div className="w-0.5 h-full bg-gray-200"></div>
            </div>

            <div className="space-y-6">
              {formData.substituicoes.map((sub: any, index: number) => (
                <div key={index} className="relative pl-10 pr-2">
                  <div className="absolute top-4 left-3 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white ring-red-600 ring-2 z-10"></div>
                  <div className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm hover:border-gray-300 relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const substituicoes = [...formData.substituicoes];
                        substituicoes.splice(index, 1);
                        setFormData({ ...formData, substituicoes });
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hidden group-hover:block transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Data de Substituição</label>
                        <input type="date" value={sub.data || ''} onChange={(e) => atualizarSubstituicao(index, { data: e.target.value })} className={CLASSE_SUB} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Quem foi substituído / Tipo</label>
                        <select value={sub.tipoAfastamento || ''} onChange={(e) => atualizarSubstituicao(index, { tipoAfastamento: e.target.value })} className={CLASSE_SUB}>
                          <option value="">Selecione...</option>
                          <option value="Titular Exonerado">Fiscal Titular - Transferência/Definitivo</option>
                          <option value="Titular Férias">Fiscal Titular - Férias/Licença (Temp)</option>
                          <option value="Suplente Exonerado">O Fiscal Suplente</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700">Novo Fiscal / Militar Substituto (Nome)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          <MilitarAutocomplete
                            militares={militares}
                            placeholder="Nome do Militar..."
                            value={sub.fiscalSubstituto || ''}
                            onChange={(val) => atualizarSubstituicao(index, { fiscalSubstituto: val })}
                            onSelect={(m) => atualizarSubstituicao(index, { fiscalSubstituto: m.nome, cargoSubstituto: m.cargo })}
                            className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500"
                          />
                          <input type="text" placeholder="Cargo/Posto..." value={sub.cargoSubstituto || ''} onChange={(e) => atualizarSubstituicao(index, { cargoSubstituto: e.target.value })} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          <input type="text" placeholder="Contato..." value={sub.contatoSubstituto || ''} onChange={(e) => atualizarSubstituicao(index, { contatoSubstituto: e.target.value })} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                          <input type="email" placeholder="E-mail..." value={sub.emailSubstituto || ''} onChange={(e) => atualizarSubstituicao(index, { emailSubstituto: e.target.value })} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                          <input type="text" placeholder="UBM..." value={sub.ubmSubstituto || ''} onChange={(e) => atualizarSubstituicao(index, { ubmSubstituto: e.target.value })} className="block w-full border border-gray-300 rounded py-1 px-2 text-sm focus:outline-none focus:border-red-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">DOE da Alteração</label>
                        <input type="text" placeholder="Opcional..." value={sub.doe || ''} onChange={(e) => atualizarSubstituicao(index, { doe: e.target.value })} className={CLASSE_SUB} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">BG da Alteração</label>
                        <input type="text" placeholder="Opcional..." value={sub.bg || ''} onChange={(e) => atualizarSubstituicao(index, { bg: e.target.value })} className={CLASSE_SUB} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
