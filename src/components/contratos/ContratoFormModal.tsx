import { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { Contrato } from '../../types';

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_LABEL = 'block text-sm font-medium text-gray-700';

interface FormState {
  pae: string;
  numero: string;
  objeto: string;
  empresa: string;
  cnpj: string;
  contatosFornecedor: string;
  contatoEmail: string;
  contatoTelefone: string;
  valorGlobal: string;
  saldoInicialFinanceiro: string;
  controlaQuantidade: boolean;
  saldoInicialQuantitativo: string;
  inicioVigencia: string;
  fimVigencia: string;
  fiscalTitular: string;
  fiscalEmail: string;
  fiscalTitularContato: string;
  fiscalSuplente: string;
  fiscalSuplenteEmail: string;
  fiscalSuplenteContato: string;
  portaria: string;
  fonteRecurso: string;
  prd: string;
  empenho: string;
  dotacao: string;
  linkContrato: string;
}

const estadoVazio: FormState = {
  pae: '',
  numero: '',
  objeto: '',
  empresa: '',
  cnpj: '',
  contatosFornecedor: '',
  contatoEmail: '',
  contatoTelefone: '',
  valorGlobal: '',
  saldoInicialFinanceiro: '',
  controlaQuantidade: false,
  saldoInicialQuantitativo: '',
  inicioVigencia: '',
  fimVigencia: '',
  fiscalTitular: '',
  fiscalEmail: '',
  fiscalTitularContato: '',
  fiscalSuplente: '',
  fiscalSuplenteEmail: '',
  fiscalSuplenteContato: '',
  portaria: '',
  fonteRecurso: '',
  prd: '',
  empenho: '',
  dotacao: '',
  linkContrato: '',
};

function contratoParaFormulario(contrato?: Contrato | null): FormState {
  if (!contrato) return estadoVazio;
  return {
    pae: contrato.pae ?? '',
    numero: contrato.numero ?? '',
    objeto: contrato.objeto ?? '',
    empresa: contrato.empresa ?? '',
    cnpj: contrato.cnpj ?? '',
    contatosFornecedor: contrato.contatosFornecedor ?? '',
    contatoEmail: contrato.contatoEmail ?? '',
    contatoTelefone: contrato.contatoTelefone ?? '',
    valorGlobal: contrato.valorGlobal != null ? String(contrato.valorGlobal) : '',
    saldoInicialFinanceiro:
      contrato.saldoInicialFinanceiro != null ? String(contrato.saldoInicialFinanceiro) : '',
    controlaQuantidade: contrato.saldoInicialQuantitativo != null,
    saldoInicialQuantitativo:
      contrato.saldoInicialQuantitativo != null ? String(contrato.saldoInicialQuantitativo) : '',
    inicioVigencia: contrato.inicioVigencia ?? '',
    fimVigencia: contrato.fimVigencia ?? '',
    fiscalTitular: contrato.fiscalTitular ?? '',
    fiscalEmail: contrato.fiscalEmail ?? '',
    fiscalTitularContato: contrato.fiscalTitularContato ?? '',
    fiscalSuplente: contrato.fiscalSuplente ?? '',
    fiscalSuplenteEmail: contrato.fiscalSuplenteEmail ?? '',
    fiscalSuplenteContato: contrato.fiscalSuplenteContato ?? '',
    portaria: contrato.portaria ?? '',
    fonteRecurso: contrato.fonteRecurso ?? '',
    prd: contrato.prd ?? '',
    empenho: contrato.empenho ?? '',
    dotacao: contrato.dotacao ?? '',
    linkContrato: contrato.linkContrato ?? '',
  };
}

interface Props {
  /** Presente em modo de edição; ausente em modo de cadastro (novo contrato). */
  contrato?: Contrato | null;
  onSalvar: (dados: Omit<Contrato, 'id'>) => Promise<void>;
  onFechar: () => void;
}

/**
 * Cadastro/edição de Contrato. Em modo de cadastro, o Gestor informa o saldo
 * inicial (financeiro e, opcionalmente, quantitativo) que servirá de base
 * para o abatimento das execuções (NFs) lançadas depois.
 */
export default function ContratoFormModal({ contrato, onSalvar, onFechar }: Props) {
  const [form, setForm] = useState<FormState>(() => contratoParaFormulario(contrato));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const emEdicao = !!contrato;

  const camposInvalidos =
    !form.pae ||
    !form.numero ||
    !form.objeto ||
    !form.empresa ||
    !form.valorGlobal ||
    !form.saldoInicialFinanceiro ||
    !form.inicioVigencia ||
    !form.fimVigencia;

  const handleChange = (campo: keyof FormState, valor: string | boolean) => {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const handleSalvar = async () => {
    if (camposInvalidos) return;
    setSalvando(true);
    setErro(null);
    try {
      const dados: Omit<Contrato, 'id'> = {
        pae: form.pae,
        numero: form.numero,
        objeto: form.objeto,
        empresa: form.empresa,
        cnpj: form.cnpj || '',
        contatosFornecedor: form.contatosFornecedor || '',
        contatoEmail: form.contatoEmail || '',
        contatoTelefone: form.contatoTelefone || '',
        valorGlobal: Number(form.valorGlobal) || 0,
        saldoInicialFinanceiro: Number(form.saldoInicialFinanceiro) || 0,
        // Em cadastro, o AppContext força saldoAtual = saldoInicial; em
        // edição, o saldo atual não é alterado por este formulário.
        saldoAtualFinanceiro: emEdicao
          ? (contrato?.saldoAtualFinanceiro ?? (Number(form.saldoInicialFinanceiro) || 0))
          : Number(form.saldoInicialFinanceiro) || 0,
        ...(form.controlaQuantidade
          ? {
              saldoInicialQuantitativo: Number(form.saldoInicialQuantitativo) || 0,
              saldoAtualQuantitativo: emEdicao
                ? (contrato?.saldoAtualQuantitativo ??
                  (Number(form.saldoInicialQuantitativo) || 0))
                : Number(form.saldoInicialQuantitativo) || 0,
            }
          : {}),
        inicioVigencia: form.inicioVigencia,
        fimVigencia: form.fimVigencia,
        fiscalTitular: form.fiscalTitular || '',
        fiscalEmail: form.fiscalEmail || '',
        fiscalTitularContato: form.fiscalTitularContato || '',
        fiscalSuplente: form.fiscalSuplente || '',
        fiscalSuplenteEmail: form.fiscalSuplenteEmail || '',
        fiscalSuplenteContato: form.fiscalSuplenteContato || '',
        portaria: form.portaria || '',
        fonteRecurso: form.fonteRecurso || '',
        prd: form.prd || '',
        empenho: form.empenho || '',
        dotacao: form.dotacao || '',
        linkContrato: form.linkContrato || null,
      };

      await onSalvar(dados);
    } catch (erroCapturado) {
      setErro(
        erroCapturado instanceof Error
          ? erroCapturado.message
          : 'Não foi possível salvar o contrato.',
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-500 bg-opacity-75 overflow-hidden"
      onClick={onFechar}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[95vh] p-4 sm:p-6 text-left transform transition-all flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900 border-l-4 border-red-600 pl-3">
            {emEdicao ? `Editar Contrato nº ${contrato?.numero}` : 'Novo Contrato'}
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={onFechar}
          >
            <span className="sr-only">Fechar</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3">
              {erro}
            </div>
          )}

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Identificação
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Nº do Processo (PAE)</label>
                <input
                  type="text"
                  value={form.pae}
                  onChange={(e) => handleChange('pae', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Nº do Contrato (nnnn/aaaa)</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={(e) => handleChange('numero', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div className="md:col-span-2">
                <label className={CLASSE_LABEL}>Objeto</label>
                <textarea
                  rows={2}
                  value={form.objeto}
                  onChange={(e) => handleChange('objeto', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Empresa Contratada</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(e) => handleChange('empresa', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => handleChange('cnpj', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fornecedor</label>
                <input
                  type="text"
                  value={form.contatosFornecedor}
                  onChange={(e) => handleChange('contatosFornecedor', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fornecedor</label>
                <input
                  type="email"
                  value={form.contatoEmail}
                  onChange={(e) => handleChange('contatoEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Telefone do Fornecedor</label>
                <input
                  type="text"
                  value={form.contatoTelefone}
                  onChange={(e) => handleChange('contatoTelefone', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Link do Contrato</label>
                <input
                  type="text"
                  value={form.linkContrato}
                  onChange={(e) => handleChange('linkContrato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Vigência e Valores
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Início da Vigência</label>
                <input
                  type="date"
                  value={form.inicioVigencia}
                  onChange={(e) => handleChange('inicioVigencia', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Fim da Vigência</label>
                <input
                  type="date"
                  value={form.fimVigencia}
                  onChange={(e) => handleChange('fimVigencia', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Valor Global (R$)</label>
                <input
                  type="number"
                  value={form.valorGlobal}
                  onChange={(e) => handleChange('valorGlobal', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Saldo Financeiro Inicial (R$)</label>
                <input
                  type="number"
                  value={form.saldoInicialFinanceiro}
                  onChange={(e) => handleChange('saldoInicialFinanceiro', e.target.value)}
                  className={CLASSE_INPUT}
                  disabled={emEdicao}
                  title={
                    emEdicao
                      ? 'O saldo inicial não é alterado na edição; ele é abatido pelas execuções lançadas.'
                      : undefined
                  }
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="controlaQuantidade"
                  type="checkbox"
                  checked={form.controlaQuantidade}
                  onChange={(e) => handleChange('controlaQuantidade', e.target.checked)}
                  disabled={emEdicao}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="controlaQuantidade" className="text-sm text-gray-700">
                  Este contrato também tem controle de saldo por quantidade (bens/materiais)
                </label>
              </div>
              {form.controlaQuantidade && (
                <div>
                  <label className={CLASSE_LABEL}>Saldo Quantitativo Inicial</label>
                  <input
                    type="number"
                    value={form.saldoInicialQuantitativo}
                    onChange={(e) => handleChange('saldoInicialQuantitativo', e.target.value)}
                    className={CLASSE_INPUT}
                    disabled={emEdicao}
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Fiscalização
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitular}
                  onChange={(e) => handleChange('fiscalTitular', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fiscal Titular</label>
                <input
                  type="email"
                  value={form.fiscalEmail}
                  onChange={(e) => handleChange('fiscalEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fiscal Titular</label>
                <input
                  type="text"
                  value={form.fiscalTitularContato}
                  onChange={(e) => handleChange('fiscalTitularContato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div></div>
              <div>
                <label className={CLASSE_LABEL}>Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplente}
                  onChange={(e) => handleChange('fiscalSuplente', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>E-mail do Fiscal Suplente</label>
                <input
                  type="email"
                  value={form.fiscalSuplenteEmail}
                  onChange={(e) => handleChange('fiscalSuplenteEmail', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Contato do Fiscal Suplente</label>
                <input
                  type="text"
                  value={form.fiscalSuplenteContato}
                  onChange={(e) => handleChange('fiscalSuplenteContato', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Nº da Portaria de Fiscalização</label>
                <input
                  type="text"
                  value={form.portaria}
                  onChange={(e) => handleChange('portaria', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
              Dados Orçamentários
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={CLASSE_LABEL}>Fonte de Recurso</label>
                <input
                  type="text"
                  value={form.fonteRecurso}
                  onChange={(e) => handleChange('fonteRecurso', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>PRD</label>
                <input
                  type="text"
                  value={form.prd}
                  onChange={(e) => handleChange('prd', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Empenho</label>
                <input
                  type="text"
                  value={form.empenho}
                  onChange={(e) => handleChange('empenho', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
              <div>
                <label className={CLASSE_LABEL}>Dotação</label>
                <input
                  type="text"
                  value={form.dotacao}
                  onChange={(e) => handleChange('dotacao', e.target.value)}
                  className={CLASSE_INPUT}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex-shrink-0 flex justify-end gap-3 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || camposInvalidos}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
          >
            <Save className="-ml-1 mr-2 h-4 w-4" />
            {salvando ? 'Salvando...' : 'Salvar Contrato'}
          </button>
        </div>
      </div>
    </div>
  );
}
