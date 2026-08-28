import { useState } from 'react';
import { FileText, PlusCircle, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { getAccessToken, googleSignIn } from '../../lib/googleAuth';
import { getOrCreateFolder, uploadFileToDrive } from '../../lib/driveService';
import {
  formatarMoeda,
  type ContratoComStatus,
  type ExecucaoContrato,
  type NotificacaoContrato,
} from '../../lib/contratos';

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

interface Props {
  contrato: ContratoComStatus;
  execucoes: ExecucaoContrato[];
  notificacoes: NotificacaoContrato[];
  onAddExecucao: (execucao: Omit<ExecucaoContrato, 'id'>) => void;
  onAddNotificacao?: (texto: string) => void;
  /** Exibe a aba de notificações (módulo de Gestão). */
  comNotificacoes?: boolean;
  /** Exibe os campos de abatimento por quantidade (módulo Fiscal). */
  comQuantidade?: boolean;
  usuarioNome?: string;
  onFechar: () => void;
}

/**
 * Modal de execução financeira / notificações de um contrato.
 * Compartilhado por Gestão de Contratos e Fiscal do Contrato.
 */
export default function ExecucaoModal({
  contrato,
  execucoes,
  notificacoes,
  onAddExecucao,
  onAddNotificacao,
  comNotificacoes = false,
  comQuantidade = false,
  usuarioNome,
  onFechar,
}: Props) {
  const [aba, setAba] = useState<'execucao' | 'notificacoes'>('execucao');
  const [novaExecucao, setNovaExecucao] = useState<NovaExecucao>(EXECUCAO_VAZIA);
  const [novaNotificacao, setNovaNotificacao] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const execucoesDoContrato = execucoes.filter((e) => e.contratoId === contrato.id);
  const valorExecutado = execucoesDoContrato.reduce((acc, atual) => acc + atual.valor, 0);
  const saldo = (contrato.valorGlobal || 0) - valorExecutado;
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

      onAddExecucao({
        contratoId: contrato.id,
        tipo: novaExecucao.tipo,
        nf: novaExecucao.nf,
        data: novaExecucao.data,
        valor: Number(novaExecucao.valor) || 0,
        quantidade: Number(novaExecucao.quantidade) || 1,
        observacao: novaExecucao.observacao,
        arquivoLink,
      });

      setNovaExecucao(EXECUCAO_VAZIA);
    } catch (erro) {
      console.error(erro);
      alert('Erro ao realizar o upload para o Google Drive. Verifique suas permissões.');
    } finally {
      setIsUploading(false);
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
            <button
              type="button"
              onClick={() => alert('Relatório gerado com sucesso!')}
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

        {comNotificacoes && (
          <div className="flex border-b border-gray-200 mb-4">
            <button
              className={`py-2 px-4 font-medium text-sm border-b-2 ${aba === 'execucao' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setAba('execucao')}
            >
              Execução Financeira
            </button>
            <button
              className={`py-2 px-4 font-medium text-sm border-b-2 ${aba === 'notificacoes' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              onClick={() => setAba('notificacoes')}
            >
              Notificações
            </button>
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
          </div>

          {(!comNotificacoes || aba === 'execucao') && (
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

          {comNotificacoes && aba === 'notificacoes' && (
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Nova Notificação
                </h4>
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={novaNotificacao}
                    onChange={(e) => setNovaNotificacao(e.target.value)}
                    placeholder="Digite a ocorrência / notificação para este contrato..."
                    className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (novaNotificacao.trim() && onAddNotificacao) {
                        onAddNotificacao(novaNotificacao.trim());
                        setNovaNotificacao('');
                      }
                    }}
                    className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none"
                  >
                    <PlusCircle className="-ml-1 mr-2 h-4 w-4" />
                    Adicionar
                  </button>
                </div>

                <h4 className="text-base font-medium text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  Histórico de Notificações
                </h4>
                <div className="space-y-4">
                  {notificacoes
                    .filter((n) => n.contratoId === contrato.id)
                    .map((notif) => (
                      <div key={notif.id} className="bg-white border text-left border-gray-200 rounded-md p-4 shadow-sm">
                        <p className="text-sm text-gray-800">{notif.texto}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {format(new Date(notif.data), 'dd/MM/yyyy HH:mm')} - Registrado por {usuarioNome}
                        </p>
                      </div>
                    ))}
                  {notificacoes.filter((n) => n.contratoId === contrato.id).length === 0 && (
                    <div className="text-sm text-gray-500 italic">
                      Nenhuma notificação registrada para este contrato.
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
