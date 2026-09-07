import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Save } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { PcaAutocomplete } from '../components/PcaAutocomplete';
import { CHECKLISTS_RITOS } from '../types';
import { ID_PLANILHA_PROCESSOS } from '../lib/csv';
import { getAccessToken, googleSignIn, initAuth } from '../lib/googleAuth';
import { sincronizarProcessoNaPlanilha } from '../lib/sheetsService';
import { OPCOES_FONTE_PROCESSO, OPCOES_NATUREZA_DESPESA } from '../lib/planilhaProcessos';

const paraDataInput = (isoOuVazio?: string) => (isoOuVazio ? isoOuVazio.split('T')[0] : '');

export default function NovoProcesso() {
  const { id } = useParams<{ id: string }>();
  const { addProcesso, updateProcesso, processos, pcas, usuarioAtual } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const cancelar = initAuth();
    return () => cancelar();
  }, []);

  const emEdicao = !!id;
  const processo = id ? processos.find((p) => p.id === id) : undefined;
  const pcaVinculado = processo?.pca_id ? pcas.find((p) => p.id === processo.pca_id) : undefined;

  const [numeroProcesso, setNumeroProcesso] = useState(processo?.numero_processo ?? '');
  const [objeto, setObjeto] = useState(processo?.objeto ?? '');
  const [descricao, setDescricao] = useState(processo?.descricao ?? '');
  const [unidadeDemandante, setUnidadeDemandante] = useState(processo?.unidade_demandante ?? '');
  const [pcaId, setPcaId] = useState(processo?.pca_id ?? '');
  const [pcaSearchText, setPcaSearchText] = useState(
    pcaVinculado ? `${pcaVinculado.codigo_pca} - ${pcaVinculado.objeto_pca}` : '',
  );

  const [ritoProcessual, setRitoProcessual] = useState(processo?.rito_processual ?? '');
  const [checklistLocal, setChecklistLocal] = useState<string[]>(processo?.checklist_rito ?? []);
  const [naturezaDespesa, setNaturezaDespesa] = useState(processo?.natureza_despesa ?? '');
  const [fonte, setFonte] = useState(processo?.fonte ?? '');
  const [valorEstimado, setValorEstimado] = useState(
    processo?.valor_estimado != null ? String(processo.valor_estimado) : '',
  );
  const [salvando, setSalvando] = useState(false);

  const handleRitoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = e.target.value;
    setRitoProcessual(valor);
    setChecklistLocal([]); // Reset checklist on changing rito
  };

  const handleToggleChecklist = (item: string) => {
    setChecklistLocal(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const [andamento, setAndamento] = useState(processo?.andamento ?? '');

  const hoje = new Date().toISOString().split('T')[0];
  const [dataEntrada, setDataEntrada] = useState(paraDataInput(processo?.data_entrada) || hoje);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroProcesso || !objeto || !unidadeDemandante) return;

    setSalvando(true);
    try {
      const valorEstimadoNumero = valorEstimado ? Number(valorEstimado.replace(',', '.')) : undefined;

      const dadosComuns = {
        numero_processo: numeroProcesso,
        objeto,
        descricao,
        unidade_demandante: unidadeDemandante,
        pca_id: pcaId || '',
        rito_processual: ritoProcessual,
        checklist_rito: checklistLocal,
        andamento,
        data_entrada: new Date(dataEntrada).toISOString(),
        natureza_despesa: naturezaDespesa,
        fonte,
        valor_estimado: valorEstimadoNumero ?? 0,
      };

      // Pede a autorização do Google ANTES de gravar no Firestore: feita
      // depois, o popup de login perde a associação com o clique do
      // usuário e a maioria dos navegadores bloqueia silenciosamente.
      let googleToken: string | null = null;
      let erroGoogle: unknown = null;
      try {
        googleToken = await getAccessToken();
        if (!googleToken) {
          const resultado = await googleSignIn();
          googleToken = resultado?.accessToken ?? null;
        }
      } catch (erro) {
        erroGoogle = erro;
      }

      let processoId: string;
      if (emEdicao && id) {
        await updateProcesso(id, dadosComuns);
        processoId = id;
      } else {
        processoId = await addProcesso({
          ...dadosComuns,
          demandante_id: usuarioAtual?.id || '',
          fase_atual_id: '1',
        });
      }

      if (!googleToken) {
        alert(
          'O processo foi salvo no sistema, mas não foi possível conectar ao Google para ' +
            'replicar na planilha automaticamente' +
            (erroGoogle instanceof Error ? `: ${erroGoogle.message}` : '.') +
            ' Adicione/atualize a linha manualmente ou tente sincronizar depois.',
        );
      } else {
        try {
          const linha = await sincronizarProcessoNaPlanilha(
            googleToken,
            ID_PLANILHA_PROCESSOS,
            {
              numero_processo: numeroProcesso,
              objeto,
              descricao,
              unidade_demandante: unidadeDemandante,
              natureza_despesa: naturezaDespesa,
              fonte,
              valor_estimado: valorEstimadoNumero,
              rito_processual: ritoProcessual,
              andamento,
              data_entrada: new Date(dataEntrada).toISOString(),
              pca_id: pcaId,
            },
            processo?.planilha_linha,
          );
          if (linha !== processo?.planilha_linha) {
            await updateProcesso(processoId, { planilha_linha: linha });
          }
        } catch (erroPlanilha) {
          console.error('Erro ao gravar o processo na planilha:', erroPlanilha);
          alert(
            'O processo foi salvo no sistema, mas não foi possível gravá-lo na planilha automaticamente: ' +
              (erroPlanilha instanceof Error ? erroPlanilha.message : String(erroPlanilha)),
          );
        }
      }

      navigate(emEdicao ? `/sistema/processos/${processoId}` : '/sistema/aquisicoes');
    } catch (erro) {
      alert(
        'Não foi possível salvar o processo: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setSalvando(false);
    }
  };

  if (emEdicao && !processo) {
    return <div className="p-6">Processo não encontrado.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? `Editar Processo ${processo?.numero_processo}` : 'Novo Processo'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {emEdicao
              ? 'Atualize os dados cadastrais do processo.'
              : 'Cadastre um novo processo administrativo de aquisição ou contração.'}
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="numeroProcesso" className="block text-sm font-medium text-gray-700">
                Número do Processo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="numeroProcesso"
                required
                value={numeroProcesso}
                onChange={(e) => setNumeroProcesso(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="Ex: 2026/012345"
              />
            </div>

            <div>
              <label htmlFor="unidadeDemandante" className="block text-sm font-medium text-gray-700">
                Unidade Demandante <span className="text-red-500">*</span>
              </label>
              <select
                id="unidadeDemandante"
                required
                value={unidadeDemandante}
                onChange={(e) => setUnidadeDemandante(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione a Unidade...</option>
                <option value="AASINT/PEV">AASINT/PEV</option>
                <option value="AJG">AJG</option>
                <option value="ASCOM">ASCOM</option>
                <option value="CEDEC">CEDEC</option>
                <option value="CEINT">CEINT</option>
                <option value="CENTROPAT">CENTROPAT</option>
                <option value="COP">COP</option>
                <option value="COP/GMAF">COP/GMAF</option>
                <option value="COP/GSE">COP/GSE</option>
                <option value="CSMV/MOP">CSMV/MOP</option>
                <option value="DAL">DAL</option>
                <option value="DGCEP">DGCEP</option>
                <option value="DS">DS</option>
                <option value="DTIC">DTIC</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="pca" className="block text-sm font-medium text-gray-700 mb-1">
                Vincular PCA (Plano de Contratações Anual)
              </label>
              <PcaAutocomplete
                pcas={pcas}
                value={pcaSearchText}
                onChange={setPcaSearchText}
                onSelect={(pca) => setPcaId(pca.id)}
                placeholder="Digite a ordem, demandante ou descrição..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="ritoProcessual" className="block text-sm font-medium text-gray-700">Rito Processual</label>
              <select id="ritoProcessual" value={ritoProcessual} onChange={handleRitoChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                <option value="">Selecione um Rito...</option>
                {Object.keys(CHECKLISTS_RITOS).map(rito => (
                  <option key={rito} value={rito}>{rito}</option>
                ))}
              </select>

              {ritoProcessual && CHECKLISTS_RITOS[ritoProcessual] && (
                <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Checklist Inicial:</h4>
                  <div className="space-y-2">
                    {CHECKLISTS_RITOS[ritoProcessual].map((item, idx) => (
                      <div key={idx} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id={`check-novo-${idx}`}
                            type="checkbox"
                            checked={checklistLocal.includes(item)}
                            onChange={() => handleToggleChecklist(item)}
                            className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor={`check-novo-${idx}`} className={`font-medium cursor-pointer ${checklistLocal.includes(item) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {item}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="naturezaDespesa" className="block text-sm font-medium text-gray-700">Natureza de Despesa</label>
              <select
                id="naturezaDespesa"
                value={naturezaDespesa}
                onChange={(e) => setNaturezaDespesa(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione...</option>
                {OPCOES_NATUREZA_DESPESA.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fonte" className="block text-sm font-medium text-gray-700">Fonte</label>
              <select
                id="fonte"
                value={fonte}
                onChange={(e) => setFonte(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione...</option>
                {OPCOES_FONTE_PROCESSO.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="valorEstimado" className="block text-sm font-medium text-gray-700">Valor Estimado (R$)</label>
              <input
                type="number"
                id="valorEstimado"
                step="0.01"
                min="0"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="0,00"
              />
            </div>

            <div>
              <label htmlFor="andamento" className="block text-sm font-medium text-gray-700">Andamento</label>
              <input type="text" id="andamento" value={andamento} onChange={e => setAndamento(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border" placeholder="Aguardando assinatura, Em análise..." />
            </div>

            <div>
              <label htmlFor="dataEntrada" className="block text-sm font-medium text-gray-700">Data de Cadastro</label>
              <input type="date" id="dataEntrada" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border" />
              <p className="mt-1 text-xs text-gray-500">
                Tempo total: <span className="font-semibold text-gray-900">{dataEntrada ? Math.max(0, differenceInDays(new Date(), new Date(`${dataEntrada}T00:00:00`))) : 0} dias</span>
              </p>
            </div>

            {emEdicao && (
              <div className="md:col-span-2 rounded-md bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                Setor atual e última tramitação são atualizados automaticamente pela sincronização com a
                planilha de controle (PAE) e não são editáveis aqui.
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="objeto" className="block text-sm font-medium text-gray-700">
                Objeto <span className="text-red-500">*</span>
              </label>
              <textarea
                id="objeto"
                rows={2}
                required
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="Descrição resumida do objeto da aquisição"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">
                Observações
              </label>
              <textarea
                id="descricao"
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar Processo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
