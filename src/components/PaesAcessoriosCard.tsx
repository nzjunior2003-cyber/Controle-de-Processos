import { useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSituacaoPaesAcessorios } from '../hooks/useSituacaoPaesAcessorios';
import {
  FINALIDADES_CONTRATO,
  FINALIDADES_PROCESSO,
  adicionarPaeAcessorio,
  chavePae,
  removerPaeAcessorio,
  type EscopoPae,
} from '../lib/paesAcessorios';
import type { PaeAcessorio } from '../types';

interface Props {
  escopo: EscopoPae;
  /** Id do processo ou do contrato dono dos PAEs. */
  donoId: string;
  paes?: PaeAcessorio[];
  /** PAEs já usados em outros lugares (principal do processo, outros acessórios) — evita cadastrar o mesmo duas vezes. */
  jaExistentes?: string[];
  podeEditar: boolean;
}

const CLASSE_INPUT =
  'block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm py-1.5 px-2 border';

/**
 * PAEs abertos à parte: solicitação de análise a outro órgão (no processo) ou
 * fatura / recebimento de objeto / pagamento (no contrato). A finalidade tem
 * sugestões, mas aceita texto livre. O robô consulta cada um e o setor atual
 * aparece aqui assim que ele rodar.
 */
export default function PaesAcessoriosCard({ escopo, donoId, paes, jaExistentes = [], podeEditar }: Props) {
  const { salvarPaesAcessorios, processos, contratos } = useApp();
  const situacoes = useSituacaoPaesAcessorios();
  const sugestoes = escopo === 'processo' ? FINALIDADES_PROCESSO : FINALIDADES_CONTRATO;
  const [numero, setNumero] = useState('');
  const [finalidade, setFinalidade] = useState<string>(sugestoes[0]);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'aviso'; texto: string } | null>(null);

  const lista = paes ?? [];
  // Um PAE não pode repetir em nenhum outro processo/contrato (o robô consulta cada número uma vez).
  const emOutrosLugares = [
    ...jaExistentes,
    ...processos.filter((p) => p.id !== donoId || escopo !== 'processo').flatMap((p) => (p.paes_acessorios ?? []).map((x) => x.numero)),
    ...contratos.filter((c) => c.id !== donoId || escopo !== 'contrato').flatMap((c) => (c.paes_acessorios ?? []).map((x) => x.numero)),
  ];

  const gravar = async (novaLista: PaeAcessorio[]) => {
    setSalvando(true);
    setMensagem(null);
    try {
      const { publicado } = await salvarPaesAcessorios(escopo, donoId, novaLista);
      if (!publicado) {
        setMensagem({ tipo: 'aviso', texto: 'PAE salvo, mas a planilha não respondeu — o robô só o enxerga depois de publicado. Tente salvar de novo mais tarde.' });
      }
      return true;
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: 'Não foi possível salvar: ' + (erro instanceof Error ? erro.message : String(erro)) });
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const handleAdicionar = async () => {
    const resultado = adicionarPaeAcessorio(lista, { numero, finalidade, observacao }, new Date(), emOutrosLugares);
    if (resultado.erro) {
      setMensagem({ tipo: 'erro', texto: resultado.erro });
      return;
    }
    if (await gravar(resultado.lista)) {
      setNumero('');
      setObservacao('');
    }
  };

  const handleRemover = async (pae: PaeAcessorio) => {
    if (!window.confirm(`Remover o PAE ${pae.numero}? O robô deixa de rastreá-lo.`)) return;
    await gravar(removerPaeAcessorio(lista, pae.id));
  };

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900">PAEs acessórios</h2>
      <p className="mt-1 text-xs text-gray-500">
        {escopo === 'processo'
          ? 'Protocolos abertos à parte, como a solicitação de análise a outro órgão do Estado. O robô acompanha o setor de cada um.'
          : 'Protocolos de fatura, recebimento de objeto e pagamento deste contrato. O robô acompanha o setor de cada um.'}
      </p>

      {lista.length === 0 && <p className="mt-4 text-sm text-gray-500">Nenhum PAE acessório cadastrado.</p>}
      {lista.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border border-gray-200 rounded-md">
          {lista.map((pae) => {
            const situacao = situacoes.get(chavePae(pae.numero));
            return (
              <li key={pae.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">
                    {pae.numero} <span className="font-normal text-gray-500">— {pae.finalidade}</span>
                  </p>
                  {pae.observacao && <p className="text-gray-600">{pae.observacao}</p>}
                  <p className="text-xs text-gray-500 mt-0.5">
                    {situacao && situacao.situacao === 'SUCESSO'
                      ? `Setor atual: ${situacao.setorAtual || '—'}${situacao.ultimaTramitacao ? ` (última tramitação ${situacao.ultimaTramitacao})` : ''}`
                      : situacao && situacao.situacao
                        ? `Última consulta: ${situacao.situacao.toLowerCase()}`
                        : 'Aguardando a próxima rodada do robô.'}
                  </p>
                </div>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => handleRemover(pae)}
                    disabled={salvando}
                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Remover este PAE"
                    aria-label={`Remover o PAE ${pae.numero}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {podeEditar && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label htmlFor={`pae-acessorio-${escopo}`} className="block text-[11px] font-medium text-gray-600 uppercase">Nº do PAE</label>
            <input id={`pae-acessorio-${escopo}`} type="text" value={numero} onChange={(e) => setNumero(e.target.value)} className={`${CLASSE_INPUT} mt-1`} placeholder="Ex.: 2026/2617141" />
          </div>
          <div>
            <label htmlFor={`finalidade-acessorio-${escopo}`} className="block text-[11px] font-medium text-gray-600 uppercase">Finalidade</label>
            <input
              id={`finalidade-acessorio-${escopo}`}
              type="text"
              list={`finalidades-${escopo}`}
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              className={`${CLASSE_INPUT} mt-1`}
              placeholder="Escolha ou escreva"
            />
            <datalist id={`finalidades-${escopo}`}>
              {sugestoes.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label htmlFor={`obs-acessorio-${escopo}`} className="block text-[11px] font-medium text-gray-600 uppercase">Observação (opcional)</label>
            <input id={`obs-acessorio-${escopo}`} type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={`${CLASSE_INPUT} mt-1`} />
          </div>
          <button
            type="button"
            onClick={handleAdicionar}
            disabled={salvando}
            className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400"
          >
            <PlusCircle className="h-4 w-4 mr-1" /> {salvando ? 'Salvando...' : 'Adicionar PAE'}
          </button>
        </div>
      )}
      {mensagem && (
        <p className={`mt-3 text-sm ${mensagem.tipo === 'erro' ? 'text-red-700' : 'text-amber-700'}`} role="alert">{mensagem.texto}</p>
      )}
    </div>
  );
}
