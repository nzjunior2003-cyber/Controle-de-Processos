import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle, RotateCcw, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useEtapasOficiaisPorRito } from '../../hooks/useEtapasPorRito';
import { aplicarAjustesRito, idAjusteRito } from '../../lib/ajustesRito';

/**
 * Master: inclui ou exclui itens do checklist de cada rito processual. A lista
 * oficial continua vindo da planilha; o que se muda aqui fica guardado como
 * diferença sobre ela (ver lib/ajustesRito.ts), então uma atualização da
 * planilha não desfaz os ajustes.
 */
export default function AjustarRitos() {
  const navigate = useNavigate();
  const { usuarioAtual, ajustesRito, salvarAjusteRito } = useApp();
  const oficiais = useEtapasOficiaisPorRito();
  const [rito, setRito] = useState('');
  const [novoItem, setNovoItem] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ajusteAtual = useMemo(
    () => ajustesRito.find((a) => a.id === idAjusteRito(rito)),
    [ajustesRito, rito],
  );
  const adicionados = ajusteAtual?.adicionar ?? [];
  const removidos = ajusteAtual?.remover ?? [];

  const oficial = oficiais[rito] ?? [];
  const ritos = Object.keys(oficiais);

  if (usuarioAtual?.perfil !== 'master') {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar esta página.</div>;
  }

  const gravar = async (proximoAdicionar: string[], proximoRemover: string[]) => {
    setSalvando(true);
    try {
      await salvarAjusteRito(rito, proximoAdicionar, proximoRemover);
    } catch (erro) {
      alert('Não foi possível salvar: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const adicionar = async () => {
    const item = novoItem.trim();
    if (!item || !rito) return;
    if (adicionados.some((a) => a.toLowerCase() === item.toLowerCase())) return setNovoItem('');
    // Se for um item oficial removido antes, só "restaura".
    const removidoIgual = removidos.find((r) => r.toLowerCase() === item.toLowerCase());
    if (removidoIgual) await gravar(adicionados, removidos.filter((r) => r !== removidoIgual));
    else await gravar([...adicionados, item], removidos);
    setNovoItem('');
  };

  const remover = (item: string) => {
    if (adicionados.includes(item)) return gravar(adicionados.filter((a) => a !== item), removidos);
    return gravar(adicionados, [...removidos, item]);
  };
  const restaurar = (item: string) => gravar(adicionados, removidos.filter((r) => r !== item));

  const listaAtual = aplicarAjustesRito({ [rito]: oficial }, [{ rito, adicionar: adicionados, remover: removidos }])[rito] ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checklists dos ritos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Inclua ou exclua etapas de um rito. A lista oficial é a da planilha; seus ajustes ficam por cima dela.
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="rito" className="block text-sm font-medium text-gray-700">Rito processual</label>
          <select id="rito" value={rito} onChange={(e) => setRito(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
            <option value="">Selecione um rito...</option>
            {ritos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {rito && (
          <>
            <p className="text-xs text-gray-500">
              {listaAtual.length} etapa(s) no checklist. Processos que já marcaram uma etapa excluída deixam de contá-la no percentual.
            </p>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
              {listaAtual.map((item) => (
                <li key={item} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-800">
                    {item}
                    {adicionados.includes(item) && <span className="ml-2 text-xs text-emerald-700">(incluída)</span>}
                  </span>
                  <button type="button" disabled={salvando} onClick={() => remover(item)} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50" title="Excluir do checklist">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {removidos.map((item) => (
                <li key={`removido-${item}`} className="flex items-center justify-between px-3 py-2 text-sm bg-gray-50">
                  <span className="text-gray-400 line-through">{item}</span>
                  <button type="button" disabled={salvando} onClick={() => restaurar(item)} className="inline-flex items-center text-xs font-medium text-red-700 hover:underline disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> restaurar
                  </button>
                </li>
              ))}
              {listaAtual.length === 0 && removidos.length === 0 && (
                <li className="px-3 py-4 text-sm text-gray-500">Este rito não tem etapas.</li>
              )}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void adicionar(); } }}
                placeholder="Nova etapa do checklist"
                className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
              <button type="button" disabled={salvando || !novoItem.trim()} onClick={() => void adicionar()} className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400">
                <PlusCircle className="h-4 w-4 mr-1" /> Incluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
