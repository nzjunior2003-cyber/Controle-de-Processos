import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OPCOES_FONTE_PROCESSO } from '../../lib/planilhaProcessos';

const ANO_ATUAL = new Date().getFullYear();

export default function DotacaoForm() {
  const { id } = useParams<{ id: string }>();
  const { dotacoes, addDotacao, updateDotacao, deleteDotacao, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const dotacao = id ? dotacoes.find((d) => d.id === id) : undefined;

  const [exercicio, setExercicio] = useState(dotacao?.exercicio ?? ANO_ATUAL);
  const [codigo, setCodigo] = useState(dotacao?.codigo ?? '');
  const [descricao, setDescricao] = useState(dotacao?.descricao ?? '');
  const [fonteRecurso, setFonteRecurso] = useState(dotacao?.fonteRecurso ?? '');
  const [valorDotado, setValorDotado] = useState(dotacao?.valorDotado != null ? String(dotacao.valorDotado) : '');
  const [funcionalProgramatica, setFuncionalProgramatica] = useState(dotacao?.funcionalProgramatica ?? '');
  const [projetoAtividade, setProjetoAtividade] = useState(dotacao?.projetoAtividade ?? '');
  const [naturezaDespesa, setNaturezaDespesa] = useState(dotacao?.naturezaDespesa ?? '');
  const [fonteCodigo, setFonteCodigo] = useState(dotacao?.fonteCodigo ?? '');
  const [detalhamento, setDetalhamento] = useState(dotacao?.detalhamento ?? '');
  const [planoInterno, setPlanoInterno] = useState(dotacao?.planoInterno ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !descricao) return;

    setSalvando(true);
    try {
      const dadosComuns = {
        exercicio,
        codigo,
        descricao,
        fonteRecurso,
        // Nas fichas de controle da Diretoria de Finanças não há valor dotado
        // por linha; vazio vale 0 (o saldo da dotação só faz sentido com valor).
        valorDotado: valorDotado ? Number(valorDotado.replace(',', '.')) : 0,
        funcionalProgramatica,
        projetoAtividade,
        naturezaDespesa,
        fonteCodigo,
        detalhamento,
        planoInterno,
      };

      if (emEdicao && id) {
        await updateDotacao(id, dadosComuns);
      } else {
        await addDotacao(dadosComuns);
      }

      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível salvar a dotação: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir esta dotação? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await deleteDotacao(id);
      navigate('/sistema/financeiro');
    } catch (erro) {
      alert('Não foi possível excluir a dotação: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setExcluindo(false);
    }
  };

  if (usuarioAtual?.perfil !== 'master' && usuarioAtual?.perfil !== 'financeiro') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  if (emEdicao && !dotacao) {
    return <div className="p-6">Dotação não encontrada.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? 'Editar Dotação Orçamentária' : 'Nova Dotação Orçamentária'}
          </h1>
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
              <label htmlFor="codigo" className="block text-sm font-medium text-gray-700">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="codigo"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="Ex.: 3.3.90.30"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="descricao"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="fonteRecurso" className="block text-sm font-medium text-gray-700">Fonte do Recurso</label>
              <select
                id="fonteRecurso"
                value={fonteRecurso}
                onChange={(e) => setFonteRecurso(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione...</option>
                {OPCOES_FONTE_PROCESSO.map((opcao) => (
                  <option key={opcao} value={opcao}>{opcao}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="valorDotado" className="block text-sm font-medium text-gray-700">
                Valor Dotado (R$)
              </label>
              <input
                type="number"
                id="valorDotado"
                step="0.01"
                min="0"
                value={valorDotado}
                onChange={(e) => setValorDotado(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div className="md:col-span-2 pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-900">Ficha de controle da Diretoria de Finanças</p>
              <p className="text-xs text-gray-500">Campos do cabeçalho da planilha de controle de cada contrato.</p>
            </div>

            {([
              ['funcionalProgramatica', 'Funcional (programática)', funcionalProgramatica, setFuncionalProgramatica, 'Ex.: 06.122.1297-8338'],
              ['projetoAtividade', 'Projeto-Atividade ou Operações Especiais', projetoAtividade, setProjetoAtividade, 'Ex.: Operacionalização das Ações Administrativas'],
              ['naturezaDespesa', 'Natureza da Despesa', naturezaDespesa, setNaturezaDespesa, 'Ex.: 339033'],
              ['fonteCodigo', 'Fonte (código)', fonteCodigo, setFonteCodigo, 'Ex.: 01500.000001'],
              ['detalhamento', 'Detalhamento', detalhamento, setDetalhamento, 'Ex.: 006359'],
              ['planoInterno', 'Plano Interno', planoInterno, setPlanoInterno, 'Ex.: 4110008338C'],
            ] as const).map(([chave, rotulo, valor, definir, exemplo]) => (
              <div key={chave} className={chave === 'projetoAtividade' ? 'md:col-span-2' : ''}>
                <label htmlFor={chave} className="block text-sm font-medium text-gray-700">{rotulo}</label>
                <input
                  type="text"
                  id={chave}
                  value={valor}
                  onChange={(e) => definir(e.target.value)}
                  placeholder={exemplo}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                />
              </div>
            ))}
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
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar Dotação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
