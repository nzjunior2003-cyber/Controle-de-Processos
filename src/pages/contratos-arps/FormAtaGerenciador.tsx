import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Paperclip, PlusCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import type { AditivoArp, Contrato, ProcedimentoLicitatorio, Processo } from '../../types';
import { saldoDaArp } from '../../lib/arp';
import { parseCurrencyBR } from '../../lib/csv';
import { formatarMoeda } from '../../lib/contratos';
import { uploadArquivoContrato } from '../../lib/driveUploadService';
import type { RegistroFormData } from './abas';

const CLASSE_INPUT =
  'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm';
const CLASSE_INPUT_PEQUENO =
  'block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm focus:outline-none focus:ring-red-500 focus:border-red-500';
const CLASSE_ROTULO = 'block text-sm font-medium text-gray-700';

const dataBr = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

const numeroDoTexto = (texto: unknown) => {
  const valor = parseCurrencyBR(texto);
  return Number.isFinite(valor) ? valor : 0;
};

const paraMoedaTexto = (valor: number) =>
  `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  formData: RegistroFormData;
  setFormData: (dados: RegistroFormData) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  processos: Processo[];
  contratos: Contrato[];
  /** Aditivos já registrados desta ata (só existem depois de salva). */
  aditivos: AditivoArp[];
  /** Abre o cadastro de aditivos da ata (precisa estar salva). */
  onAditivo: (procedimentoId: string) => void;
}

/**
 * Cadastro da ata (ARP) em que o CBMPA é o gerenciador: processo de origem, objeto, fornecedor, itens com valor
 * unitário e total, vigência, DOE, documento da ARP, aditivos e o saldo financeiro e por item.
 */
export default function FormAtaGerenciador({ formData, setFormData, onInputChange, processos, contratos, aditivos, onAditivo }: Props) {
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);

  // Depois de registrar um aditivo, a vigência da ata muda no banco; traz o novo fim para a tela, senão salvar o formulário desfaria a prorrogação.
  const quantidadeAditivos = useRef(aditivos.length);
  useEffect(() => {
    if (aditivos.length > quantidadeAditivos.current) {
      const maisRecente = aditivos.map((a) => a.novaFimVigencia).filter(Boolean).sort().at(-1);
      if (maisRecente) setFormData({ ...formData, vigenciaArp: maisRecente });
    }
    quantidadeAditivos.current = aditivos.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aditivos.length]);

  const idSalvo = typeof formData.id === 'string' && !formData.id.startsWith('auto-') ? formData.id : null;
  const itens: { descricao: string; quantidade: string; valorHomologado: string }[] = formData.itens ?? [];
  const processoOrigem = processos.find((p) => p.numero_processo === formData.pae);

  const totalDoItem = (item: { quantidade: string; valorHomologado: string }) =>
    (Number(String(item.quantidade).replace(',', '.')) || 0) * numeroDoTexto(item.valorHomologado);
  const totalDosItens = itens.reduce((acc, item) => acc + totalDoItem(item), 0);

  /** Atualiza a lista de itens e mantém o valor registrado da ata igual à soma deles. */
  const gravarItens = (proximos: typeof itens) => {
    const total = proximos.reduce((acc, item) => acc + totalDoItem(item), 0);
    setFormData({ ...formData, itens: proximos, ...(proximos.length > 0 ? { valorHomologado: paraMoedaTexto(total) } : {}) });
  };

  const alterarItem = (indice: number, campo: 'descricao' | 'quantidade' | 'valorHomologado', valor: string) =>
    gravarItens(itens.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)));

  // Saldo calculado com o que está na tela: o registrado acompanha os itens digitados.
  const saldo = idSalvo
    ? saldoDaArp(
        { id: idSalvo, valorHomologado: formData.valorHomologado, itens: formData.itens } as Pick<ProcedimentoLicitatorio, 'id' | 'valorHomologado' | 'itens'>,
        contratos,
        processos,
      )
    : null;
  const registradoNaTela = itens.length > 0 ? totalDosItens : numeroDoTexto(formData.valorHomologado);

  const anexar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(true);
    setErroAnexo(null);
    try {
      const referencia = String(formData.numero && formData.numero !== 'Aguardando' ? formData.numero : formData.pae || 'sem número').replace(/\//g, '-');
      const extensao = arquivo.name.includes('.') ? arquivo.name.slice(arquivo.name.lastIndexOf('.')) : '.pdf';
      const renomeado = new File([arquivo], `ARP_${referencia}${extensao}`, { type: arquivo.type || 'application/pdf' });
      const link = await uploadArquivoContrato(`ARP ${referencia}`, renomeado);
      setFormData({ ...formData, linkArp: link, arquivoArpNome: arquivo.name });
    } catch (erro) {
      setErroAnexo(erro instanceof Error ? erro.message : 'Não foi possível anexar o arquivo.');
    } finally {
      setEnviando(false);
      if (entradaArquivo.current) entradaArquivo.current.value = '';
    }
  };

  return (
    <>
      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Origem e objeto da ARP</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={CLASSE_ROTULO} htmlFor="ata-pae">Nº do PAE do processo que deu origem à ARP</label>
            <input
              id="ata-pae"
              type="text"
              name="pae"
              value={formData.pae || ''}
              onChange={onInputChange}
              list="ata-processos"
              className={CLASSE_INPUT}
              placeholder="Selecione ou digite o PAE..."
            />
            <datalist id="ata-processos">
              {processos.map((p) => (
                <option key={p.id} value={p.numero_processo}>
                  {p.rito_processual ? `${p.rito_processual} - ${p.objeto}` : p.objeto}
                </option>
              ))}
            </datalist>
            {processoOrigem && (
              <p className="mt-1 text-xs text-gray-500">
                {processoOrigem.unidade_demandante ? `Demandante: ${processoOrigem.unidade_demandante} · ` : ''}
                {processoOrigem.rito_processual ?? ''}
              </p>
            )}
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-numero">Nº da ARP</label>
            <input
              id="ata-numero"
              type="text"
              name="numero"
              value={formData.numero && formData.numero !== 'Aguardando' ? formData.numero : ''}
              onChange={onInputChange}
              className={CLASSE_INPUT}
              placeholder="Ex.: 023/2025"
            />
          </div>
          <div className="md:col-span-3">
            <div className="flex items-end justify-between gap-3">
              <label className={CLASSE_ROTULO} htmlFor="ata-objeto">Objeto</label>
              {processoOrigem?.objeto && formData.objeto !== processoOrigem.objeto && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, objeto: processoOrigem.objeto })}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Usar o objeto do processo
                </button>
              )}
            </div>
            <textarea id="ata-objeto" name="objeto" rows={2} value={formData.objeto || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Dados do fornecedor</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-forn-nome">Razão social</label>
            <input id="ata-forn-nome" type="text" name="fornecedorNome" value={formData.fornecedorNome || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-forn-cnpj">CNPJ</label>
            <input id="ata-forn-cnpj" type="text" name="fornecedor" value={formData.fornecedor || ''} onChange={onInputChange} className={CLASSE_INPUT} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-forn-email">E-mail</label>
            <input id="ata-forn-email" type="email" name="fornecedorEmail" value={formData.fornecedorEmail || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-forn-tel">Telefone</label>
            <input id="ata-forn-tel" type="text" name="fornecedorTelefone" value={formData.fornecedorTelefone || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-4">Vigência e publicação</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-ini">Início da vigência</label>
            <input id="ata-ini" type="date" name="inicioVigencia" value={formData.inicioVigencia || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-fim">Fim da vigência</label>
            <input id="ata-fim" type="date" name="vigenciaArp" value={formData.vigenciaArp || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-pub">Data de publicação</label>
            <input id="ata-pub" type="date" name="dataPublicacao" value={formData.dataPublicacao && formData.dataPublicacao !== '-' ? formData.dataPublicacao : ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
          <div>
            <label className={CLASSE_ROTULO} htmlFor="ata-doe">Nº DOE (Diário Oficial do Estado)</label>
            <input id="ata-doe" type="text" name="doe" value={formData.doe || ''} onChange={onInputChange} className={CLASSE_INPUT} />
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 pb-5">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-base font-medium text-gray-900">Itens da ata</h4>
          <button
            type="button"
            onClick={() => gravarItens([...itens, { descricao: '', quantidade: '', valorHomologado: '' }])}
            className="text-sm px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-medium whitespace-nowrap"
          >
            + Adicionar item
          </button>
        </div>

        {itens.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="py-1 pr-2 font-medium">Descrição</th>
                  <th className="py-1 pr-2 font-medium w-28">Quantidade</th>
                  <th className="py-1 pr-2 font-medium w-36">Valor unitário</th>
                  <th className="py-1 pr-2 font-medium w-36 text-right">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item, indice) => (
                  <tr key={indice} className="align-top">
                    <td className="pr-2 pb-2">
                      <input type="text" value={item.descricao} onChange={(e) => alterarItem(indice, 'descricao', e.target.value)} className={CLASSE_INPUT_PEQUENO} placeholder="Nome do item..." aria-label={`Descrição do item ${indice + 1}`} />
                    </td>
                    <td className="pr-2 pb-2">
                      <input type="text" inputMode="decimal" value={item.quantidade} onChange={(e) => alterarItem(indice, 'quantidade', e.target.value)} className={CLASSE_INPUT_PEQUENO} aria-label={`Quantidade do item ${indice + 1}`} />
                    </td>
                    <td className="pr-2 pb-2">
                      <input type="text" inputMode="decimal" value={item.valorHomologado} onChange={(e) => alterarItem(indice, 'valorHomologado', e.target.value)} className={CLASSE_INPUT_PEQUENO} placeholder="R$ 0,00" aria-label={`Valor unitário do item ${indice + 1}`} />
                    </td>
                    <td className="pr-2 pb-2 pt-2 text-right font-medium text-gray-900">{formatarMoeda(totalDoItem(item))}</td>
                    <td className="pb-2 pt-1">
                      <button type="button" onClick={() => gravarItens(itens.filter((_, i) => i !== indice))} className="p-1 text-gray-400 hover:text-red-500" aria-label={`Remover o item ${indice + 1}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-right text-sm text-gray-700">
              Valor total da ata: <strong className="text-gray-900">{formatarMoeda(totalDosItens)}</strong>
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 italic text-center py-3 bg-gray-50 rounded border border-dashed border-gray-200">
              Sem itens: ata de serviço, controlada só pelo valor total registrado.
            </p>
            <div className="mt-3 max-w-xs">
              <label className={CLASSE_ROTULO} htmlFor="ata-valor-total">Valor total registrado</label>
              <input id="ata-valor-total" type="text" inputMode="decimal" name="valorHomologado" value={formData.valorHomologado || ''} onChange={onInputChange} className={CLASSE_INPUT} placeholder="R$ 0,00" />
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 pb-5">
        <h4 className="text-base font-medium text-gray-900 mb-3">Saldo da ata</h4>
        {saldo ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><span className="block text-xs text-gray-500 uppercase">Registrado</span>{formatarMoeda(registradoNaTela)}</div>
              <div><span className="block text-xs text-gray-500 uppercase">Utilizado (contratos e processos)</span>{formatarMoeda(saldo.utilizado)}</div>
              <div>
                <span className="block text-xs text-gray-500 uppercase">Saldo financeiro</span>
                <strong className={registradoNaTela - saldo.utilizado < 0 ? 'text-red-700' : 'text-emerald-700'}>{formatarMoeda(registradoNaTela - saldo.utilizado)}</strong>
              </div>
            </div>
            {saldo.itens.length > 0 && (
              <div className="overflow-x-auto">
                <span className="block text-xs text-gray-500 uppercase mb-1">Saldo quantitativo por item</span>
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 uppercase">
                      <th className="py-1 pr-3 font-medium">Item</th>
                      <th className="py-1 pr-3 font-medium">Registrada</th>
                      <th className="py-1 pr-3 font-medium">Utilizada</th>
                      <th className="py-1 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {saldo.itens.map((item) => (
                      <tr key={item.idx}>
                        <td className="py-1 pr-3 text-gray-900">{item.descricao}</td>
                        <td className="py-1 pr-3">{item.registrada}</td>
                        <td className="py-1 pr-3">{item.utilizada}</td>
                        <td className={`py-1 font-semibold ${item.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{item.saldo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500">O que os processos e contratos já utilizaram aparece na lista da ata, na tela de Contratos e ARP&apos;s.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Registrado: <strong className="text-gray-900">{formatarMoeda(registradoNaTela)}</strong>. O saldo financeiro e por item aparece depois de salvar a ata, conforme os processos e contratos a utilizarem.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-base font-medium text-gray-900 mb-2">Documento da ARP</h4>
          <input ref={entradaArquivo} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => anexar(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => entradaArquivo.current?.click()}
            disabled={enviando}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4 mr-2" />
            {enviando ? 'Enviando...' : formData.linkArp ? 'Trocar o arquivo da ARP' : 'Anexar ARP'}
          </button>
          {formData.linkArp && (
            <p className="mt-2 text-sm">
              <a href={formData.linkArp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-red-700 hover:underline">
                <ExternalLink className="h-4 w-4 mr-1" />
                {formData.arquivoArpNome || 'Abrir a ARP anexada'}
              </a>
            </p>
          )}
          {erroAnexo && <p className="mt-2 text-sm text-red-700" role="alert">{erroAnexo}</p>}
          <p className="mt-1 text-xs text-gray-500">O arquivo vai para o Drive institucional ao anexar; salve a ata para guardar o vínculo.</p>
        </div>

        <div>
          <h4 className="text-base font-medium text-gray-900 mb-2">Aditivos da ARP</h4>
          <button
            type="button"
            onClick={() => idSalvo && onAditivo(idSalvo)}
            disabled={!idSalvo}
            title={idSalvo ? 'Registrar um aditivo (prorrogação da vigência)' : 'Salve a ata primeiro para registrar aditivos'}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Adicionar aditivo da ARP
          </button>
          {!idSalvo && <p className="mt-1 text-xs text-gray-500">Disponível depois que a ata for salva.</p>}
          {aditivos.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              {aditivos.map((a) => (
                <li key={a.id}>
                  Aditivo {a.numero} ({dataBr(a.data)}): vigência até <strong>{dataBr(a.novaFimVigencia)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
