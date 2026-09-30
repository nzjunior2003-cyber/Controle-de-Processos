import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ANO_ATUAL = new Date().getFullYear();

export default function PcaForm() {
  const { id } = useParams<{ id: string }>();
  const { pcas, addPca, updatePca, deletePca, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const pca = id ? pcas.find((p) => p.id === id) : undefined;

  const [codigoPca, setCodigoPca] = useState(pca?.codigo_pca ?? '');
  const [exercicio, setExercicio] = useState(pca?.exercicio ?? ANO_ATUAL);
  const [origem, setOrigem] = useState(pca?.origem ?? '');
  const [unidadeResponsavel, setUnidadeResponsavel] = useState(pca?.unidade_responsavel ?? '');
  const [itemPca, setItemPca] = useState(pca?.item_pca ?? '');
  const [subitem, setSubitem] = useState(pca?.subitem ?? '');
  const [grupoPca, setGrupoPca] = useState(pca?.grupo_pca ?? '');
  const [objetoPca, setObjetoPca] = useState(pca?.objeto_pca ?? '');
  const [quantidade, setQuantidade] = useState(pca?.quantidade ?? '');
  const [valorUnitarioEstimado, setValorUnitarioEstimado] = useState(
    pca?.valor_unitario_estimado != null ? String(pca.valor_unitario_estimado) : '',
  );
  const [valorPrevisto, setValorPrevisto] = useState(
    pca?.valor_previsto != null ? String(pca.valor_previsto) : '',
  );
  const [prioridade, setPrioridade] = useState(pca?.prioridade ?? '');
  const [fonteRecurso, setFonteRecurso] = useState(pca?.fonte_recurso ?? '');
  const [modalidadeLicitacao, setModalidadeLicitacao] = useState(pca?.modalidade_licitacao ?? '');
  const [numeroPae, setNumeroPae] = useState(pca?.numero_pae ?? '');
  const [contratoNovo, setContratoNovo] = useState(pca?.contrato_novo ?? false);
  const [qdqq, setQdqq] = useState({
    q1: pca?.qdqq?.q1 ?? false,
    q2: pca?.qdqq?.q2 ?? false,
    q3: pca?.qdqq?.q3 ?? false,
    q4: pca?.qdqq?.q4 ?? false,
  });

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoPca || !objetoPca || !unidadeResponsavel) return;

    setSalvando(true);
    try {
      const dadosComuns = {
        codigo_pca: codigoPca,
        exercicio,
        origem,
        unidade_responsavel: unidadeResponsavel,
        item_pca: itemPca,
        subitem,
        grupo_pca: grupoPca,
        objeto_pca: objetoPca,
        quantidade,
        valor_unitario_estimado: valorUnitarioEstimado ? Number(valorUnitarioEstimado.replace(',', '.')) : undefined,
        valor_previsto: valorPrevisto ? Number(valorPrevisto.replace(',', '.')) : 0,
        prioridade,
        fonte_recurso: fonteRecurso,
        modalidade_licitacao: modalidadeLicitacao,
        numero_pae: numeroPae,
        contrato_novo: contratoNovo,
        qdqq,
      };

      if (emEdicao && id) {
        await updatePca(id, dadosComuns);
      } else {
        await addPca(dadosComuns);
      }

      navigate('/sistema/pca');
    } catch (erro) {
      alert('Não foi possível salvar o item do PCA: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir este item do PCA? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await deletePca(id);
      navigate('/sistema/pca');
    } catch (erro) {
      alert('Não foi possível excluir o item: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setExcluindo(false);
    }
  };

  if (usuarioAtual?.perfil !== 'master' && usuarioAtual?.perfil !== 'bm4') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para cadastrar ou editar itens do PCA.
      </div>
    );
  }

  if (emEdicao && !pca) {
    return <div className="p-6">Item do PCA não encontrado.</div>;
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? `Editar Item do PCA Nº ${pca?.codigo_pca}` : 'Novo Item do PCA'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {emEdicao
              ? 'Atualize os dados deste item do Plano de Contratação Anual.'
              : 'Cadastre manualmente um item do PCA (útil para lançar um exercício ainda não coberto pela planilha).'}
          </p>
        </div>
        {emEdicao && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="-ml-1 mr-1.5 h-4 w-4" />
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="codigoPca" className="block text-sm font-medium text-gray-700">
                Ordem <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="codigoPca"
                required
                value={codigoPca}
                onChange={(e) => setCodigoPca(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="exercicio" className="block text-sm font-medium text-gray-700">
                Exercício <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="exercicio"
                required
                value={exercicio}
                onChange={(e) => setExercicio(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="origem" className="block text-sm font-medium text-gray-700">Origem</label>
              <input
                type="text"
                id="origem"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="unidadeResponsavel" className="block text-sm font-medium text-gray-700">
                Unidade Responsável (Demandante) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="unidadeResponsavel"
                required
                value={unidadeResponsavel}
                onChange={(e) => setUnidadeResponsavel(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="itemPca" className="block text-sm font-medium text-gray-700">Item</label>
              <input
                type="text"
                id="itemPca"
                value={itemPca}
                onChange={(e) => setItemPca(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="subitem" className="block text-sm font-medium text-gray-700">Subitem</label>
              <input
                type="text"
                id="subitem"
                value={subitem}
                onChange={(e) => setSubitem(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="grupoPca" className="block text-sm font-medium text-gray-700">Grupo</label>
              <input
                type="text"
                id="grupoPca"
                value={grupoPca}
                onChange={(e) => setGrupoPca(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="quantidade" className="block text-sm font-medium text-gray-700">Quantidade</label>
              <input
                type="text"
                id="quantidade"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="valorUnitarioEstimado" className="block text-sm font-medium text-gray-700">
                Valor Unitário Estimado (R$)
              </label>
              <input
                type="number"
                id="valorUnitarioEstimado"
                step="0.01"
                min="0"
                value={valorUnitarioEstimado}
                onChange={(e) => setValorUnitarioEstimado(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="valorPrevisto" className="block text-sm font-medium text-gray-700">
                Valor Total Previsto (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="valorPrevisto"
                required
                step="0.01"
                min="0"
                value={valorPrevisto}
                onChange={(e) => setValorPrevisto(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="prioridade" className="block text-sm font-medium text-gray-700">Prioridade</label>
              <select
                id="prioridade"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione...</option>
                <option value="ALTA">Alta</option>
                <option value="MÉDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>

            <div>
              <label htmlFor="fonteRecurso" className="block text-sm font-medium text-gray-700">Fonte do Recurso</label>
              <input
                type="text"
                id="fonteRecurso"
                value={fonteRecurso}
                onChange={(e) => setFonteRecurso(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="modalidadeLicitacao" className="block text-sm font-medium text-gray-700">
                Modalidade / Rito Processual Provável
              </label>
              <input
                type="text"
                id="modalidadeLicitacao"
                value={modalidadeLicitacao}
                onChange={(e) => setModalidadeLicitacao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="numeroPae" className="block text-sm font-medium text-gray-700">Nº do PAE</label>
              <input
                type="text"
                id="numeroPae"
                value={numeroPae}
                onChange={(e) => setNumeroPae(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div className="flex items-center">
              <input
                id="contratoNovo"
                type="checkbox"
                checked={contratoNovo}
                onChange={(e) => setContratoNovo(e.target.checked)}
                className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="contratoNovo" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                Contrato Novo
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quadrimestre(s) Previsto(s) para Efetivação/Entrega (QDQQ)
              </label>
              <div className="flex flex-wrap gap-4">
                {(['q1', 'q2', 'q3', 'q4'] as const).map((chave, idx) => (
                  <label key={chave} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={qdqq[chave]}
                      onChange={(e) => setQdqq((prev) => ({ ...prev, [chave]: e.target.checked }))}
                      className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer"
                    />
                    {idx + 1}º QDQQ
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="objetoPca" className="block text-sm font-medium text-gray-700">
                Descrição / Objeto <span className="text-red-500">*</span>
              </label>
              <textarea
                id="objetoPca"
                rows={3}
                required
                value={objetoPca}
                onChange={(e) => setObjetoPca(e.target.value)}
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
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
