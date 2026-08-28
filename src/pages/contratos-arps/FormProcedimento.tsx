import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { PCA, PortariaFiscal, Processo } from '../../types';
import type { AbaContratos, RegistroFormData } from './abas';

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_INPUT_PEQUENO =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:ring-red-500 focus:border-red-500';
const CLASSE_VINCULADO =
  'mt-1 block w-full bg-transparent border-0 border-b border-gray-300 py-1 text-sm focus:ring-0 text-gray-800 font-medium';

interface Props {
  abaAtiva: AbaContratos;
  formData: RegistroFormData;
  setFormData: (dados: RegistroFormData) => void;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  processos: Processo[];
  pcas: PCA[];
  portarias: PortariaFiscal[];
}

/** Formulário de pregões, inexigibilidades, dispensas, adesões e partícipes. */
export default function FormProcedimento({
  abaAtiva,
  formData,
  setFormData,
  onInputChange,
  processos,
  pcas,
  portarias,
}: Props) {
  const atualizarInstrumentos = (indice: number, campo: string, valor: string) => {
    const instrumentos = [...(formData.instrumentosDerivados || [])];
    instrumentos[indice] = { ...instrumentos[indice], [campo]: valor };
    setFormData({ ...formData, instrumentosDerivados: instrumentos });
  };

  const removerInstrumento = (indice: number) => {
    const instrumentos = [...(formData.instrumentosDerivados || [])];
    instrumentos.splice(indice, 1);
    setFormData({ ...formData, instrumentosDerivados: instrumentos });
  };

  const linkedProcesso = processos.find((p) => p.numero_processo === formData.pae);
  const linkedPca = linkedProcesso?.pca_id
    ? pcas.find((pca) => pca.id === linkedProcesso.pca_id)
    : null;
  const valorFormatado = linkedPca?.valor_previsto
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        linkedPca.valor_previsto,
      )
    : '';

  return (
    <>
      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Processo</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-end justify-between border-b border-gray-100 pb-4">
            <div className="flex-1 mr-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº PAE</label>
              <input
                type="text"
                name="pae"
                value={formData.pae || ''}
                onChange={onInputChange}
                list="processos-list"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Selecione ou digite o PAE..."
              />
              <datalist id="processos-list">
                {processos.map((p) => (
                  <option key={p.id} value={p.numero_processo}>
                    {p.rito_processual ? `${p.rito_processual} - ${p.objeto}` : p.objeto}
                  </option>
                ))}
              </datalist>
            </div>
            {abaAtiva === 'pregoes' && (
              <div className="flex items-center mb-2">
                <input
                  id="registroPrecos"
                  name="registroPrecos"
                  type="checkbox"
                  checked={formData.registroPrecos || false}
                  onChange={(e) => setFormData({ ...formData, registroPrecos: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="registroPrecos" className="ml-2 block text-sm font-medium text-gray-900 whitespace-nowrap">
                  SRP (Registro de Preços)
                </label>
              </div>
            )}
          </div>

          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-l-4 border-blue-500 pl-4 py-3 bg-blue-50/50 rounded-r-md">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Demandante</label>
              <input type="text" value={linkedProcesso?.unidade_demandante || ''} className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Objeto</label>
              <input type="text" value={linkedProcesso?.objeto || ''} className={`${CLASSE_VINCULADO} truncate`} title={linkedProcesso?.objeto} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Fonte / Dotação Orçamentária</label>
              <input type="text" value={linkedPca?.fonte_recurso || linkedProcesso?.fonte || ''} className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Estimado</label>
              <input type="text" value={valorFormatado} className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Nº do Parecer / BG</label>
              <input type="text" className={CLASSE_VINCULADO} placeholder="Vinculado automaticamente" readOnly />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Publicação e Homologação</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {abaAtiva === 'pregoes'
                ? 'Nº do Edital'
                : abaAtiva === 'adesoes' || abaAtiva === 'participe'
                  ? 'Nº da ARP'
                  : abaAtiva === 'dispensas'
                    ? 'Nº do Aviso/Adesão'
                    : 'Nº do Termo de Inexigibilidade'}
            </label>
            <input type="text" name="documento_referencia" value={formData.documento_referencia || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>

          {(abaAtiva === 'adesoes' || abaAtiva === 'participe') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Órgão Gerenciador/UF</label>
                <input type="text" name="orgaoGerenciador" value={formData.orgaoGerenciador || ''} onChange={onInputChange} className={CLASSE_INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Vigência da ARP</label>
                <input type="date" name="vigenciaArp" value={formData.vigenciaArp || ''} onChange={onInputChange} className={CLASSE_INPUT} />
              </div>
            </>
          )}

          {abaAtiva !== 'participe' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {abaAtiva === 'adesoes' ? 'Data da Adesão' : 'Data de Publicação'}
              </label>
              <input type="date" name="dataPublicacao" value={formData.dataPublicacao || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">DOE</label>
            <input type="text" name="doe" value={formData.doe || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Link PNCP</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input type="url" name="linkPncp" placeholder="https://" value={formData.linkPncp || ''} onChange={onInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                <button type="button" onClick={() => formData.linkPncp && window.open(formData.linkPncp, '_blank')} disabled={!formData.linkPncp} className="inline-flex items-center px-4 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Acessar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Link Compras GOV</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input type="url" name="linkComprasGov" placeholder="https://" value={formData.linkComprasGov || ''} onChange={onInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                <button type="button" onClick={() => formData.linkComprasGov && window.open(formData.linkComprasGov, '_blank')} disabled={!formData.linkComprasGov} className="inline-flex items-center px-4 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Acessar
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {abaAtiva === 'adesoes' || abaAtiva === 'participe' ? 'Fornecedor da ARP (CNPJ)' : 'Fornecedor Homologado (CNPJ)'}
              </label>
              <input type="text" name="fornecedor" placeholder="Após homologação..." value={formData.fornecedor || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Valor Homologado</label>
              <input type="text" name="valorHomologado" placeholder="R$ Após homologação..." value={formData.valorHomologado || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          </div>
        </div>
      </div>

      {abaAtiva === 'pregoes' && formData.registroPrecos ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-base font-medium text-gray-900 flex-1">Atas de Registro de Preço (ARP) e Contratos</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    instrumentosDerivados: [
                      ...(formData.instrumentosDerivados || []),
                      { id: Math.random().toString(), tipo: 'ARP', numero: '', doe: '', bg: '', vigenciaFim: '', link: '' },
                    ],
                  })
                }
                className="text-sm px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium whitespace-nowrap"
              >
                + Adicionar ARP
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    instrumentosDerivados: [
                      ...(formData.instrumentosDerivados || []),
                      { id: Math.random().toString(), tipo: 'CONTRATO', numero: '', origem: '', bg: '', vigenciaFim: '', link: '' },
                    ],
                  })
                }
                className="text-sm px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium whitespace-nowrap"
              >
                + Adicionar Contrato
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {(formData.instrumentosDerivados || []).map((inst: any, idx: number) => (
              <div key={inst.id ?? idx} className={`p-4 border rounded-md relative ${inst.tipo === 'ARP' ? 'bg-red-50/30 border-red-200' : 'bg-blue-50/30 border-blue-200'}`}>
                <button type="button" onClick={() => removerInstrumento(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                  <X className="w-5 h-5" />
                </button>
                <h5 className="text-sm font-bold text-gray-800 mb-2">{inst.tipo === 'ARP' ? 'Ata de Registro de Preço' : 'Contrato'}</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Nº do Documento</label>
                    <input type="text" value={inst.numero} onChange={(e) => atualizarInstrumentos(idx, 'numero', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                  </div>
                  {inst.tipo === 'CONTRATO' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Origem (Nº da ARP / Pregão)</label>
                      <input type="text" value={inst.origem || ''} onChange={(e) => atualizarInstrumentos(idx, 'origem', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Fim Vigência</label>
                    <input type="date" value={inst.vigenciaFim || ''} onChange={(e) => atualizarInstrumentos(idx, 'vigenciaFim', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-700">Link Acesso (Drive)</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input type="url" placeholder="Cole o link do Google Drive aqui..." value={inst.link || ''} onChange={(e) => atualizarInstrumentos(idx, 'link', e.target.value)} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-1.5 px-3 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                      <button type="button" onClick={() => inst.link && window.open(inst.link, '_blank')} disabled={!inst.link} className="inline-flex items-center px-3 py-1.5 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar Documento
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!formData.instrumentosDerivados || formData.instrumentosDerivados.length === 0) && (
              <p className="text-sm text-gray-500 italic py-3 text-center border rounded-md bg-gray-50">
                Nenhum instrumento adicionado. Clique nos botões acima para cadastrar.
              </p>
            )}
          </div>
        </div>
      ) : abaAtiva === 'pregoes' && !formData.registroPrecos ? (
        <div>
          <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Pregão</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Nº do Pregão</label>
              <input type="text" name="numeroContrato" placeholder="Ex: 001/2026" value={formData.numeroContrato || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Nº DOE</label>
              <input type="text" name="doeContrato" value={formData.doeContrato || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Fornecedores Homologados</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    fornecedoresHomologados: [
                      ...(formData.fornecedoresHomologados || []),
                      { id: Math.random().toString(), cnpj: '', valor: '' },
                    ],
                  })
                }
                className="text-xs px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium"
              >
                + Adicionar Fornecedor
              </button>
            </div>
            <div className="space-y-2">
              {(formData.fornecedoresHomologados || []).map((forn: any, idx: number) => (
                <div key={forn.id ?? idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="CNPJ / Nome do Fornecedor"
                    value={forn.cnpj}
                    onChange={(e) => {
                      const lista = [...formData.fornecedoresHomologados];
                      lista[idx] = { ...lista[idx], cnpj: e.target.value };
                      setFormData({ ...formData, fornecedoresHomologados: lista });
                    }}
                    className="flex-1 block border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                  <input
                    type="text"
                    placeholder="R$ Valor Homologado"
                    value={forn.valor}
                    onChange={(e) => {
                      const lista = [...formData.fornecedoresHomologados];
                      lista[idx] = { ...lista[idx], valor: e.target.value };
                      setFormData({ ...formData, fornecedoresHomologados: lista });
                    }}
                    className="flex-1 block border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const lista = [...formData.fornecedoresHomologados];
                      lista.splice(idx, 1);
                      setFormData({ ...formData, fornecedoresHomologados: lista });
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-base font-medium text-gray-900 flex-1">Dados do Contrato</h4>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    instrumentosDerivados: [
                      ...(formData.instrumentosDerivados || []),
                      {
                        id: Math.random().toString(),
                        tipo: 'CONTRATO',
                        numero: '',
                        fornecedorIdx: '',
                        valor: '',
                        vigenciaInicio: '',
                        vigenciaFim: '',
                        prd: '',
                        empenho: '',
                        fiscalTitular: '',
                        fiscalSuplente: '',
                        link: '',
                      },
                    ],
                  })
                }
                className="text-sm px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium whitespace-nowrap"
              >
                + Adicionar Contrato
              </button>
            </div>

            <div className="space-y-4">
              {(formData.instrumentosDerivados || []).map((inst: any, idx: number) => (
                <div key={inst.id ?? idx} className="p-4 border rounded-md relative bg-blue-50/30 border-blue-200">
                  <button type="button" onClick={() => removerInstrumento(idx)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                    <X className="w-5 h-5" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700">Nº do Contrato (nnnn/aaaa)</label>
                      <input type="text" value={inst.numero} onChange={(e) => atualizarInstrumentos(idx, 'numero', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Fornecedor</label>
                      <select value={inst.fornecedorIdx} onChange={(e) => atualizarInstrumentos(idx, 'fornecedorIdx', e.target.value)} className={CLASSE_INPUT_PEQUENO}>
                        <option value="">Selecione um fornecedor</option>
                        {(formData.fornecedoresHomologados || []).map((f: any, i: number) => (
                          <option key={f.id ?? i} value={i}>{f.cnpj || `Fornecedor ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Valor (Total/Item para saldo)</label>
                      <input type="text" value={inst.valor || ''} onChange={(e) => atualizarInstrumentos(idx, 'valor', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Início da Vigência</label>
                      <input type="date" value={inst.vigenciaInicio || ''} onChange={(e) => atualizarInstrumentos(idx, 'vigenciaInicio', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Fim da Vigência</label>
                      <input type="date" value={inst.vigenciaFim || ''} onChange={(e) => atualizarInstrumentos(idx, 'vigenciaFim', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Nº da PRD</label>
                      <input type="text" value={inst.prd || ''} onChange={(e) => atualizarInstrumentos(idx, 'prd', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Nº do Empenho</label>
                      <input type="text" value={inst.empenho || ''} onChange={(e) => atualizarInstrumentos(idx, 'empenho', e.target.value)} className={CLASSE_INPUT_PEQUENO} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Fiscal Titular</label>
                      <select value={inst.fiscalTitular || ''} onChange={(e) => atualizarInstrumentos(idx, 'fiscalTitular', e.target.value)} className={CLASSE_INPUT_PEQUENO}>
                        <option value="">Selecione...</option>
                        {portarias.map((p) => (
                          <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Fiscal Suplente</label>
                      <select value={inst.fiscalSuplente || ''} onChange={(e) => atualizarInstrumentos(idx, 'fiscalSuplente', e.target.value)} className={CLASSE_INPUT_PEQUENO}>
                        <option value="">Selecione...</option>
                        {portarias.map((p) => (
                          <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700">Link Acesso (Drive)</label>
                      <div className="mt-1 flex rounded-md shadow-sm">
                        <input type="url" placeholder="Cole o link do Google Drive aqui..." value={inst.link || ''} onChange={(e) => atualizarInstrumentos(idx, 'link', e.target.value)} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-1.5 px-3 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500" />
                        <button type="button" onClick={() => inst.link && window.open(inst.link, '_blank')} disabled={!inst.link} className="inline-flex items-center px-3 py-1.5 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Acessar Documento
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!formData.instrumentosDerivados || formData.instrumentosDerivados.length === 0) && (
                <p className="text-sm text-gray-500 italic py-3 text-center border rounded-md bg-gray-50">Nenhum contrato adicionado.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h4 className="text-base font-medium text-gray-900 mb-4">Dados do Contrato / ARP</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Nº do Contrato / ARP (nnnn/aaaa)</label>
              <input type="text" name="numeroContrato" placeholder="Ex: 001/2026" value={formData.numeroContrato || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">DOE do Contrato</label>
              <input type="text" name="doeContrato" value={formData.doeContrato || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">BG do Contrato</label>
              <input type="text" name="bgContrato" value={formData.bgContrato || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Número da PRD</label>
              <input type="text" name="prd" placeholder="Ex: PRD 123/2026" value={formData.prd || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Número do Empenho</label>
              <input type="text" name="empenho" placeholder="Ex: 2026NE0001" value={formData.empenho || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Início da Vigência</label>
              <input type="date" name="inicioVigencia" value={formData.inicioVigencia || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fim da Vigência</label>
              <input type="date" name="fimVigencia" value={formData.fimVigencia || ''} onChange={onInputChange} className={CLASSE_INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Link de Acesso ao Contrato (Drive)</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input type="url" name="linkContrato" placeholder="Cole o link do Google Drive aqui..." value={formData.linkContrato || ''} onChange={onInputChange} className="flex-1 block w-full border border-gray-300 rounded-none rounded-l-md py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" />
                <button type="button" onClick={() => formData.linkContrato && window.open(formData.linkContrato, '_blank')} disabled={!formData.linkContrato} className="inline-flex items-center px-4 py-2 rounded-r-md border border-l-0 border-gray-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 focus:outline-none disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed sm:text-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Acessar Documento
                </button>
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Fiscal Titular</label>
              <select name="fiscal" value={formData.fiscal || ''} onChange={onInputChange} className={CLASSE_INPUT}>
                <option value="">Selecione...</option>
                {portarias.map((p) => (
                  <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700">Fiscal Suplente</label>
              <select name="suplente" value={formData.suplente || ''} onChange={onInputChange} className={CLASSE_INPUT}>
                <option value="">Selecione...</option>
                {portarias.map((p) => (
                  <option key={p.id} value={p.fiscalTitular}>{p.fiscalTitular} (Port. {p.portaria})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-5">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-base font-medium text-gray-900">
            {abaAtiva === 'adesoes' || abaAtiva === 'participe' ? 'Itens Solicitados' : 'Itens Homologados'}
          </h4>
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                itens: [...(formData.itens || []), { descricao: '', quantidade: '', valorHomologado: '' }],
              })
            }
            className="text-sm px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium"
          >
            + Adicionar Item
          </button>
        </div>
        <div className="space-y-3">
          {(formData.itens || []).map((item: any, index: number) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Nome do item..."
                  value={item.descricao}
                  onChange={(e) => {
                    const itens = [...(formData.itens || [])];
                    itens[index] = { ...itens[index], descricao: e.target.value };
                    setFormData({ ...formData, itens });
                  }}
                  className={CLASSE_INPUT}
                />
              </div>
              <div className="w-24">
                <input
                  type="text"
                  placeholder="Qtd"
                  value={item.quantidade}
                  onChange={(e) => {
                    const itens = [...(formData.itens || [])];
                    itens[index] = { ...itens[index], quantidade: e.target.value };
                    setFormData({ ...formData, itens });
                  }}
                  className={CLASSE_INPUT}
                />
              </div>
              <div className="w-32">
                <input
                  type="text"
                  placeholder="R$ Valor"
                  value={item.valorHomologado}
                  onChange={(e) => {
                    const itens = [...(formData.itens || [])];
                    itens[index] = { ...itens[index], valorHomologado: e.target.value };
                    setFormData({ ...formData, itens });
                  }}
                  className={CLASSE_INPUT}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const itens = [...(formData.itens || [])];
                  itens.splice(index, 1);
                  setFormData({ ...formData, itens });
                }}
                className="mt-2 p-1 text-gray-400 hover:text-red-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
          {(!formData.itens || formData.itens.length === 0) && (
            <p className="text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded border border-dashed border-gray-200">
              Nenhum item cadastrado. Clique em &quot;+ Adicionar Item&quot; para inserir.
            </p>
          )}
        </div>

        {formData.itens && formData.itens.length > 0 && (
          <div className="mt-6 flex justify-end">
            <div className="text-right border-t border-gray-200 pt-4 px-4 w-full md:w-auto">
              <p className="text-sm text-gray-500 uppercase tracking-wider font-medium mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatarTotalItens(formData.itens)}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Soma quantidade x valor de cada item, aceitando os formatos digitados. */
function formatarTotalItens(itens: any[]): string {
  const total = itens.reduce((acumulado: number, item: any) => {
    const paraNumero = (entrada: unknown, padrao: number) => {
      let texto = (entrada ?? '').toString().replace(/[^\d.,]/g, '');
      if (texto.includes(',') && texto.includes('.')) {
        texto = texto.replace(/\./g, '').replace(',', '.');
      } else if (texto.includes(',')) {
        texto = texto.replace(',', '.');
      }
      const numero = parseFloat(texto);
      return Number.isFinite(numero) ? numero : padrao;
    };

    return acumulado + paraNumero(item.valorHomologado, 0) * paraNumero(item.quantidade, 1);
  }, 0);

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
}
