import { useState } from 'react';
import { FileText, PlusCircle, Trash2, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { getAccessToken, googleSignIn } from '../../lib/googleAuth';
import { getOrCreateFolder, uploadFileToDrive } from '../../lib/driveService';
import {
  formatarMoeda,
  TIPO_ADITIVO_LABELS,
  TIPO_OCORRENCIA_LABELS,
  type Aditivo,
  type ConsumoItemExecucao,
  type ContratoComStatus,
  type ExecucaoContrato,
  type Ocorrencia,
  type TipoAditivo,
  type TipoOcorrencia,
} from '../../lib/contratos';

interface LinhaItemConsumido {
  itemId: string;
  quantidade: string;
}

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';

interface NovaExecucao {
  tipoDeducao: 'valor' | 'quantidade';
  tipo: string;
  nf: string;
  data: string;
  valor: string;
  quantidade: string;
  observacao: string;
  arquivo: File | null;
}

const EXECUCAO_VAZIA: NovaExecucao = {
  tipoDeducao: 'valor',
  tipo: 'NF/Fatura',
  nf: '',
  data: '',
  valor: '',
  quantidade: '1',
  observacao: '',
  arquivo: null,
};

const TIPOS_OCORRENCIA_PADRAO: TipoOcorrencia[] = ['OCORRENCIA', 'ADITIVO', 'ESCLARECIMENTO'];

interface NovoAditivoForm {
  tipo: TipoAditivo;
  numero: string;
  data: string;
  valorAcrescido: string;
  novaFimVigencia: string;
  observacao: string;
}

const ADITIVO_VAZIO: NovoAditivoForm = {
  tipo: 'FINANCEIRO',
  numero: '',
  data: '',
  valorAcrescido: '',
  novaFimVigencia: '',
  observacao: '',
};

interface Props {
  contrato: ContratoComStatus;
  execucoes: ExecucaoContrato[];
  ocorrencias: Ocorrencia[];
  aditivos?: Aditivo[];
  onAddExecucao: (execucao: Omit<ExecucaoContrato, 'id'>) => void | Promise<void>;
  onAddOcorrencia?: (dados: { descricao: string; tipo: TipoOcorrencia }) => void | Promise<void>;
  onAddAditivo?: (dados: {
    tipo: TipoAditivo;
    numero: string;
    data: string;
    valorAcrescido?: number;
    novaFimVigencia?: string;
    itensAcrescidos?: ConsumoItemExecucao[];
    observacao?: string;
  }) => void | Promise<void>;
  /** Exibe a aba de ocorrências. */
  comOcorrencias?: boolean;
  /** Exibe a aba de aditivos (apenas Gestão/Master/Contratos). */
  comAditivos?: boolean;
  /** Tipos de ocorrência que este usuário pode registrar (varia por perfil). */
  tiposOcorrenciaPermitidos?: TipoOcorrencia[];
  /** Exibe os campos de abatimento por quantidade (módulo Fiscal). */
  comQuantidade?: boolean;
  onFechar: () => void;
}

/**
 * Modal de execução financeira / ocorrências de um contrato.
 * Compartilhado por Gestão de Contratos e Fiscal do Contrato.
 */
export default function ExecucaoModal({
  contrato,
  execucoes,
  ocorrencias,
  aditivos = [],
  onAddExecucao,
  onAddOcorrencia,
  onAddAditivo,
  comOcorrencias = false,
  comAditivos = false,
  tiposOcorrenciaPermitidos = TIPOS_OCORRENCIA_PADRAO,
  comQuantidade = false,
  onFechar,
}: Props) {
  const [aba, setAba] = useState<'execucao' | 'ocorrencias' | 'aditivos'>('execucao');
  const [novaExecucao, setNovaExecucao] = useState<NovaExecucao>(EXECUCAO_VAZIA);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoOcorrencia>(
    tiposOcorrenciaPermitidos[0] ?? 'OCORRENCIA',
  );
  const [salvandoOcorrencia, setSalvandoOcorrencia] = useState(false);
  const [novoAditivo, setNovoAditivo] = useState<NovoAditivoForm>(ADITIVO_VAZIO);
  const [linhasItensAditivo, setLinhasItensAditivo] = useState<LinhaItemConsumido[]>([]);
  const [salvandoAditivo, setSalvandoAditivo] = useState(false);
  const [erroAditivo, setErroAditivo] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [linhasItens, setLinhasItens] = useState<LinhaItemConsumido[]>([]);

  const itensContrato = contrato.itens ?? [];
  const temItens = itensContrato.length > 0;

  const handleAddLinhaItem = () => {
    setLinhasItens((anterior) => [...anterior, { itemId: itensContrato[0]?.id ?? '', quantidade: '' }]);
  };
  const handleLinhaItemChange = (indice: number, campo: keyof LinhaItemConsumido, valor: string) => {
    setLinhasItens((anterior) =>
      anterior.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );
  };
  const handleRemoveLinhaItem = (indice: number) => {
    setLinhasItens((anterior) => anterior.filter((_, i) => i !== indice));
  };

  const handleAddLinhaItemAditivo = () => {
    setLinhasItensAditivo((anterior) => [...anterior, { itemId: itensContrato[0]?.id ?? '', quantidade: '' }]);
  };
  const handleLinhaItemAditivoChange = (indice: number, campo: keyof LinhaItemConsumido, valor: string) => {
    setLinhasItensAditivo((anterior) =>
      anterior.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );
  };
  const handleRemoveLinhaItemAditivo = (indice: number) => {
    setLinhasItensAditivo((anterior) => anterior.filter((_, i) => i !== indice));
  };

  const execucoesDoContrato = execucoes.filter((e) => e.contratoId === contrato.id);
  const valorExecutado = execucoesDoContrato.reduce((acc, atual) => acc + atual.valor, 0);
  const saldo = contrato.saldoAtualFinanceiro ?? (contrato.valorGlobal || 0) - valorExecutado;
  const percExec = contrato.valorGlobal
    ? ((valorExecutado / contrato.valorGlobal) * 100).toFixed(1)
    : '0.0';

  const camposInvalidos =
    !novaExecucao.nf ||
    !novaExecucao.data ||
    (comQuantidade && novaExecucao.tipoDeducao === 'quantidade'
      ? !novaExecucao.quantidade
      : !novaExecucao.valor);

  const handleAddExecucao = async () => {
    if (camposInvalidos) return;

    setIsUploading(true);
    try {
      let arquivoLink: string | null = null;

      if (novaExecucao.arquivo) {
        let token = await getAccessToken();
        if (!token) {
          const resultado = await googleSignIn();
          token = resultado?.accessToken ?? null;
        }

        if (token) {
          const arquivo = new File(
            [novaExecucao.arquivo],
            `NF_${novaExecucao.nf}.pdf`,
            { type: novaExecucao.arquivo.type || 'application/pdf' },
          );
          const pastaRaiz = await getOrCreateFolder(token, 'Documentos de Contratos');
          const pastaContrato = await getOrCreateFolder(
            token,
            `Contrato ${contrato.numero} - ${contrato.empresa}`,
            pastaRaiz,
          );
          arquivoLink = await uploadFileToDrive(token, arquivo, pastaContrato);
        }
      }

      const itensConsumidos: ConsumoItemExecucao[] = linhasItens
        .filter((linha) => linha.itemId && Number(linha.quantidade) > 0)
        .map((linha) => ({ itemId: linha.itemId, quantidade: Number(linha.quantidade) }));

      await onAddExecucao({
        contratoId: contrato.id,
        tipo: novaExecucao.tipo,
        nf: novaExecucao.nf,
        data: novaExecucao.data,
        valor: Number(novaExecucao.valor) || 0,
        quantidade: Number(novaExecucao.quantidade) || 1,
        observacao: novaExecucao.observacao,
        arquivoLink,
        ...(itensConsumidos.length > 0 ? { itensConsumidos } : {}),
      });

      setNovaExecucao(EXECUCAO_VAZIA);
      setLinhasItens([]);
    } catch (erro) {
      console.error(erro);
      alert(
        erro instanceof Error
          ? erro.message
          : 'Erro ao registrar a execução. Verifique os dados e tente novamente.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const aditivoExigeValor = novoAditivo.tipo === 'FINANCEIRO' || novoAditivo.tipo === 'FINANCEIRO_E_PRAZO';
  const aditivoExigePrazo = novoAditivo.tipo === 'PRAZO' || novoAditivo.tipo === 'FINANCEIRO_E_PRAZO';
  const aditivoExigeItens = novoAditivo.tipo === 'QUANTIDADE';
  const itensAcrescidosValidos = linhasItensAditivo.filter(
    (linha) => linha.itemId && Number(linha.quantidade) > 0,
  );

  const aditivoCamposInvalidos =
    !novoAditivo.numero ||
    !novoAditivo.data ||
    (aditivoExigeValor && !novoAditivo.valorAcrescido) ||
    (aditivoExigePrazo && !novoAditivo.novaFimVigencia) ||
    (aditivoExigeItens && itensAcrescidosValidos.length === 0);

  const handleAddAditivo = async () => {
    if (aditivoCamposInvalidos || !onAddAditivo) return;
    setSalvandoAditivo(true);
    setErroAditivo(null);
    try {
      await onAddAditivo({
        tipo: novoAditivo.tipo,
        numero: novoAditivo.numero,
        data: novoAditivo.data,
        ...(aditivoExigeValor ? { valorAcrescido: Number(novoAditivo.valorAcrescido) || 0 } : {}),
        ...(aditivoExigePrazo ? { novaFimVigencia: novoAditivo.novaFimVigencia } : {}),
        ...(aditivoExigeItens
          ? {
              itensAcrescidos: itensAcrescidosValidos.map((linha) => ({
                itemId: linha.itemId,
                quantidade: Number(linha.quantidade),
              })),
            }
          : {}),
        observacao: novoAditivo.observacao || '',
      });
      setNovoAditivo(ADITIVO_VAZIO);
      setLinhasItensAditivo([]);
    } catch (erro) {
      setErroAditivo(
        erro instanceof Error ? erro.message : 'Erro ao registrar o aditivo. Tente novamente.',
      );
    } finally {
      setSalvandoAditivo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-500 bg-opacity-75 overflow-hidden"
      onClick={onFechar}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl h-full max-h-[95vh] p-4 sm:p-6 text-left transform transition-all flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900 border-l-4 border-red-600 pl-3">
            Gestão do Contrato nº {contrato.numero}
          </h3>
          <div className="flex items-center space-x-2">
            {contrato.contratoPdfLink && (
              <a
                href={contrato.contratoPdfLink}
                target="_blank"
                rel="noreferrer"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-gray-300 flex items-center"
              >
                <FileText className="w-4 h-4 mr-1" />
                Ver PDF do Contrato
              </a>
            )}
            <button
              type="button"
              onClick={() => window.open(`/sistema/gestao-contratos/${contrato.id}/relatorio`, '_blank')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-gray-300 flex items-center"
            >
              <FileText className="w-4 h-4 mr-1" />
              Gerar Relatório
            </button>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none ml-2"
              onClick={onFechar}
            >
              <span className="sr-only">Fechar</span>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {(comOcorrencias || comAditivos) && (
          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`py-2 px-4 font-medium text-sm border-b-2 ${aba === 'execucao' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setAba('execucao')}
            >
              Execução Financeira
            </button>
            {comOcorrencias && (
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 ${aba === 'ocorrencias' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAba('ocorrencias')}
              >
                Ocorrências
              </button>
            )}
            {comAditivos && (
              <button
                className={`py-2 px-4 font-medium text-sm border-b-2 ${aba === 'aditivos' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAba('aditivos')}
              >
                Aditivos
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Empresa Contratada</p>
                <p className="font-semibold text-gray-900">{contrato.empresa}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Objeto</p>
                <p className="text-sm text-gray-900 line-clamp-2">{contrato.objeto}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-200 pt-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Valor Global</p>
                <p className="text-xl font-bold text-gray-900">{formatarMoeda(contrato.valorGlobal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Valor Executado (Deduzido)</p>
                <p className="text-xl font-bold text-red-600">{formatarMoeda(valorExecutado)}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, Number(percExec))}%` }}></div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">Saldo Restante</p>
                <p className="text-xl font-bold text-emerald-600">{formatarMoeda(saldo)}</p>
              </div>
            </div>

            {temItens && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">Saldo por Item</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {itensContrato.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-white border border-gray-200 rounded px-3 py-1.5">
                      <span className="text-gray-700 truncate mr-2">{item.descricao}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap">
                        {item.quantidadeAtual}/{item.quantidadeInicial}{item.unidade ? ` ${item.unidade}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(!(comOcorrencias || comAditivos) || aba === 'execucao') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Nova Execução / NF
                </h4>
                <div className="space-y-4">
                  {comQuantidade && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Abatimento de Saldo</label>
                        <select
                          value={novaExecucao.tipoDeducao}
                          onChange={(e) =>
                            setNovaExecucao({
                              ...novaExecucao,
                              tipoDeducao: e.target.value as 'valor' | 'quantidade',
                            })
                          }
                          className={CLASSE_INPUT}
                        >
                          <option value="valor">Abater por Valor Mês/Serviço (R$)</option>
                          <option value="quantidade">Abater por Quantidade (Bens/Materiais)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo de Documento</label>
                        <select
                          value={novaExecucao.tipo}
                          onChange={(e) => setNovaExecucao({ ...novaExecucao, tipo: e.target.value })}
                          className={CLASSE_INPUT}
                        >
                          <option value="NF/Fatura">NF/Fatura</option>
                          <option value="Recibo">Recibo do Fornecedor</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {comQuantidade ? 'Identificação do Doc. (Nº NF / Recibo)' : 'Nº da Nota Fiscal / Fatura'}
                    </label>
                    <input
                      type="text"
                      value={novaExecucao.nf}
                      onChange={(e) => setNovaExecucao({ ...novaExecucao, nf: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {comQuantidade ? 'Data do Faturamento / Recibo' : 'Data do Faturamento'}
                    </label>
                    <input
                      type="date"
                      value={novaExecucao.data}
                      onChange={(e) => setNovaExecucao({ ...novaExecucao, data: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {comQuantidade && novaExecucao.tipoDeducao === 'quantidade' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Qtd. Utilizada (Obrigatório)</label>
                        <input
                          type="number"
                          value={novaExecucao.quantidade}
                          onChange={(e) => setNovaExecucao({ ...novaExecucao, quantidade: e.target.value })}
                          className={CLASSE_INPUT}
                        />
                      </div>
                    )}
                    <div className={!comQuantidade || novaExecucao.tipoDeducao === 'valor' ? 'col-span-2' : ''}>
                      <label className="block text-sm font-medium text-gray-700">
                        Valor (R$){' '}
                        {comQuantidade && novaExecucao.tipoDeducao !== 'valor' ? '(Opcional)' : ''}
                      </label>
                      <input
                        type="number"
                        value={novaExecucao.valor}
                        onChange={(e) => setNovaExecucao({ ...novaExecucao, valor: e.target.value })}
                        className={CLASSE_INPUT}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Observação / Competência</label>
                    <textarea
                      rows={2}
                      value={novaExecucao.observacao}
                      onChange={(e) => setNovaExecucao({ ...novaExecucao, observacao: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </div>
                  {temItens && (
                    <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">Itens Recebidos/Consumidos</p>
                      <div className="space-y-2">
                        {linhasItens.map((linha, indice) => {
                          const item = itensContrato.find((i) => i.id === linha.itemId);
                          return (
                            <div key={indice} className="flex items-center gap-2">
                              <select
                                value={linha.itemId}
                                onChange={(e) => handleLinhaItemChange(indice, 'itemId', e.target.value)}
                                className={`${CLASSE_INPUT} flex-1`}
                              >
                                {itensContrato.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.descricao} (saldo: {i.quantidadeAtual}{i.unidade ? ` ${i.unidade}` : ''})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                placeholder="Qtd."
                                value={linha.quantidade}
                                onChange={(e) => handleLinhaItemChange(indice, 'quantidade', e.target.value)}
                                className={`${CLASSE_INPUT} w-24`}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveLinhaItem(indice)}
                                className="text-gray-400 hover:text-red-600"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              {item && Number(linha.quantidade) > item.quantidadeAtual && (
                                <p className="text-xs text-amber-600">Acima do saldo</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddLinhaItem}
                        className="mt-2 inline-flex items-center text-xs font-medium text-red-700 hover:text-red-800"
                      >
                        <PlusCircle className="w-3 h-3 mr-1" />
                        Adicionar item
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Comprovante (NF / Recibo)</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) =>
                        setNovaExecucao({
                          ...novaExecucao,
                          arquivo: e.target.files ? e.target.files[0] : null,
                        })
                      }
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExecucao}
                    disabled={isUploading || camposInvalidos}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
                  >
                    {isUploading ? (
                      <>
                        <Upload className="-ml-1 mr-2 h-4 w-4 animate-bounce" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                        Registrar Dedução
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Linha do Tempo de Execução
                </h4>
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                  {execucoesDoContrato
                    .slice()
                    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                    .map((exec) => (
                      <div key={exec.id} className="relative">
                        <div className="absolute -left-6 mt-1 w-4 h-4 bg-red-600 rounded-full border-2 border-white"></div>
                        <div className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm hover:border-gray-300">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                {exec.tipo || 'NF / Fatura'}: {exec.nf}
                                {comQuantidade && exec.quantidade ? ` (Qtd: ${exec.quantidade})` : ''}
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(exec.data), 'dd/MM/yyyy')} - Ref: {exec.observacao}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-red-600">- {formatarMoeda(exec.valor)}</p>
                            </div>
                          </div>
                          {exec.itensConsumidos && exec.itensConsumidos.length > 0 && (
                            <ul className="text-xs text-gray-600 mb-2 list-disc list-inside">
                              {exec.itensConsumidos.map((consumo) => {
                                const item = itensContrato.find((i) => i.id === consumo.itemId);
                                return (
                                  <li key={consumo.itemId}>
                                    {item?.descricao ?? 'Item removido'}: {consumo.quantidade}
                                    {item?.unidade ? ` ${item.unidade}` : ''}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {exec.arquivoLink && (
                            <a
                              href={exec.arquivoLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-red-600 hover:text-red-800 font-medium inline-flex items-center"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              Ver Comprovante
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  {execucoesDoContrato.length === 0 && (
                    <div className="text-sm text-gray-500 italic pb-4">
                      Nenhuma execução financeira registrada para este contrato.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {comOcorrencias && aba === 'ocorrencias' && (
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Nova Ocorrência
                </h4>
                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                  {tiposOcorrenciaPermitidos.length > 1 && (
                    <select
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value as TipoOcorrencia)}
                      className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm sm:w-64"
                    >
                      {tiposOcorrenciaPermitidos.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {TIPO_OCORRENCIA_LABELS[tipo]}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={novaDescricao}
                    onChange={(e) => setNovaDescricao(e.target.value)}
                    placeholder="Ex.: atraso na entrega, atraso de pagamento, item em desconformidade..."
                    className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    disabled={salvandoOcorrencia || !novaDescricao.trim()}
                    onClick={async () => {
                      if (!novaDescricao.trim() || !onAddOcorrencia) return;
                      setSalvandoOcorrencia(true);
                      try {
                        await onAddOcorrencia({ descricao: novaDescricao.trim(), tipo: novoTipo });
                        setNovaDescricao('');
                      } catch (erro) {
                        console.error(erro);
                        alert(
                          erro instanceof Error
                            ? erro.message
                            : 'Erro ao registrar a ocorrência. Tente novamente.',
                        );
                      } finally {
                        setSalvandoOcorrencia(false);
                      }
                    }}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
                  >
                    <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                    {salvandoOcorrencia ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>

                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Histórico de Ocorrências
                </h4>
                <div className="space-y-4">
                  {ocorrencias
                    .filter((o) => o.contratoId === contrato.id)
                    .map((ocorrencia) => (
                      <div key={ocorrencia.id} className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 mb-2">
                          {TIPO_OCORRENCIA_LABELS[ocorrencia.tipo] ?? ocorrencia.tipo}
                        </span>
                        <p className="text-sm text-gray-800">{ocorrencia.descricao}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(ocorrencia.data), 'dd/MM/yyyy HH:mm')} - Registrado por{' '}
                          {ocorrencia.registradoPorNome}
                        </p>
                      </div>
                    ))}
                  {ocorrencias.filter((o) => o.contratoId === contrato.id).length === 0 && (
                    <div className="text-sm text-gray-500 italic">
                      Nenhuma ocorrência registrada para este contrato.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {comAditivos && aba === 'aditivos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Novo Aditivo
                </h4>
                {erroAditivo && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md p-3 mb-4">
                    {erroAditivo}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Aditivo</label>
                    <select
                      value={novoAditivo.tipo}
                      onChange={(e) =>
                        setNovoAditivo({ ...novoAditivo, tipo: e.target.value as TipoAditivo })
                      }
                      className={CLASSE_INPUT}
                    >
                      {(Object.keys(TIPO_ADITIVO_LABELS) as TipoAditivo[]).map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {TIPO_ADITIVO_LABELS[tipo]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nº do Aditivo / Processo
                    </label>
                    <input
                      type="text"
                      value={novoAditivo.numero}
                      onChange={(e) => setNovoAditivo({ ...novoAditivo, numero: e.target.value })}
                      className={CLASSE_INPUT}
                      placeholder="Ex: 1º Termo Aditivo, Processo 2026/000123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Data do Instrumento
                    </label>
                    <input
                      type="date"
                      value={novoAditivo.data}
                      onChange={(e) => setNovoAditivo({ ...novoAditivo, data: e.target.value })}
                      className={CLASSE_INPUT}
                    />
                  </div>
                  {aditivoExigeValor && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Valor Acrescido (R$)
                      </label>
                      <input
                        type="number"
                        value={novoAditivo.valorAcrescido}
                        onChange={(e) =>
                          setNovoAditivo({ ...novoAditivo, valorAcrescido: e.target.value })
                        }
                        className={CLASSE_INPUT}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Somado ao valor global e ao saldo disponível do contrato.
                      </p>
                    </div>
                  )}
                  {aditivoExigePrazo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Nova Data de Fim de Vigência
                      </label>
                      <input
                        type="date"
                        value={novoAditivo.novaFimVigencia}
                        onChange={(e) =>
                          setNovoAditivo({ ...novoAditivo, novaFimVigencia: e.target.value })
                        }
                        className={CLASSE_INPUT}
                      />
                    </div>
                  )}
                  {aditivoExigeItens && (
                    <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-700 mb-2">Itens Acrescidos</p>
                      {!temItens && (
                        <p className="text-xs text-gray-500">
                          Este contrato ainda não tem itens cadastrados — cadastre-os na edição do
                          contrato antes de registrar um aditivo de quantidade.
                        </p>
                      )}
                      {temItens && (
                        <>
                          <div className="space-y-2">
                            {linhasItensAditivo.map((linha, indice) => (
                              <div key={indice} className="flex items-center gap-2">
                                <select
                                  value={linha.itemId}
                                  onChange={(e) =>
                                    handleLinhaItemAditivoChange(indice, 'itemId', e.target.value)
                                  }
                                  className={`${CLASSE_INPUT} flex-1`}
                                >
                                  {itensContrato.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.descricao} (atual: {i.quantidadeInicial}
                                      {i.unidade ? ` ${i.unidade}` : ''})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  placeholder="Qtd. a acrescer"
                                  value={linha.quantidade}
                                  onChange={(e) =>
                                    handleLinhaItemAditivoChange(indice, 'quantidade', e.target.value)
                                  }
                                  className={`${CLASSE_INPUT} w-28`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLinhaItemAditivo(indice)}
                                  className="text-gray-400 hover:text-red-600"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleAddLinhaItemAditivo}
                            className="mt-2 inline-flex items-center text-xs font-medium text-red-700 hover:text-red-800"
                          >
                            <PlusCircle className="w-3 h-3 mr-1" />
                            Adicionar item
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Observação</label>
                    <textarea
                      rows={2}
                      value={novoAditivo.observacao}
                      onChange={(e) =>
                        setNovoAditivo({ ...novoAditivo, observacao: e.target.value })
                      }
                      className={CLASSE_INPUT}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAditivo}
                    disabled={salvandoAditivo || aditivoCamposInvalidos}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none"
                  >
                    <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                    {salvandoAditivo ? 'Salvando...' : 'Registrar Aditivo'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Histórico de Aditivos
                </h4>
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-6">
                  {aditivos
                    .filter((a) => a.contratoId === contrato.id)
                    .slice()
                    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                    .map((aditivo) => (
                      <div key={aditivo.id} className="relative">
                        <div className="absolute -left-6 mt-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
                        <div className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm hover:border-gray-300">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                {TIPO_ADITIVO_LABELS[aditivo.tipo] ?? aditivo.tipo}
                              </span>
                              <p className="text-sm font-medium text-gray-900 mt-1">
                                {aditivo.numero}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(aditivo.data), 'dd/MM/yyyy')} - Registrado por{' '}
                                {aditivo.registradoPorNome}
                              </p>
                            </div>
                            {typeof aditivo.valorAcrescido === 'number' && (
                              <p className="text-lg font-bold text-emerald-600 text-right">
                                + {formatarMoeda(aditivo.valorAcrescido)}
                              </p>
                            )}
                          </div>
                          {aditivo.novaFimVigencia && (
                            <p className="text-xs text-gray-700">
                              Nova vigência até{' '}
                              <span className="font-medium">
                                {format(new Date(aditivo.novaFimVigencia), 'dd/MM/yyyy')}
                              </span>
                            </p>
                          )}
                          {aditivo.itensAcrescidos && aditivo.itensAcrescidos.length > 0 && (
                            <ul className="text-xs text-gray-700 list-disc list-inside">
                              {aditivo.itensAcrescidos.map((acrescimo) => {
                                const item = itensContrato.find((i) => i.id === acrescimo.itemId);
                                return (
                                  <li key={acrescimo.itemId}>
                                    + {acrescimo.quantidade}
                                    {item?.unidade ? ` ${item.unidade}` : ''} em {item?.descricao ?? 'item removido'}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {aditivo.observacao && (
                            <p className="text-xs text-gray-500 mt-1">{aditivo.observacao}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  {aditivos.filter((a) => a.contratoId === contrato.id).length === 0 && (
                    <div className="text-sm text-gray-500 italic pb-4">
                      Nenhum aditivo registrado para este contrato.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
