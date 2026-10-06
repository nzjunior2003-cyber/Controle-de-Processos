import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { useAjustarChecklistRito } from '../../hooks/useAjustarChecklistRito';

/** "X" ao lado de uma etapa do checklist — só aparece pro master e pede confirmação (vale pro rito inteiro). */
export function BotaoExcluirEtapa({ rito, item }: { rito: string; item: string }) {
  const { podeAjustar, excluirEtapa } = useAjustarChecklistRito();
  if (!podeAjustar) return null;
  const excluir = async () => {
    if (!window.confirm(`Excluir a etapa "${item}" do checklist do rito "${rito}"?\n\nVale para todos os processos desse rito.`)) return;
    try {
      await excluirEtapa(rito, item);
    } catch (erro) {
      alert('Não foi possível excluir a etapa: ' + (erro instanceof Error ? erro.message : String(erro)));
    }
  };
  return (
    <button type="button" onClick={excluir} className="ml-2 p-1 text-gray-300 hover:text-red-600 flex-shrink-0" title="Excluir esta etapa do rito (master)">
      <X className="h-4 w-4" />
    </button>
  );
}

/** Linha "Nova etapa" no fim do checklist — só pro master; a etapa entra no checklist do rito inteiro. */
export function AdicionarEtapa({ rito }: { rito: string }) {
  const { podeAjustar, incluirEtapa } = useAjustarChecklistRito();
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  if (!podeAjustar) return null;

  const incluir = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await incluirEtapa(rito, texto);
      setTexto('');
    } catch (erro) {
      alert('Não foi possível incluir a etapa: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mt-3 flex gap-2 border-t border-gray-200 pt-3">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void incluir();
          }
        }}
        placeholder="Nova etapa do checklist (master)"
        className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm py-1.5 px-2 border bg-white"
      />
      <button
        type="button"
        disabled={salvando || !texto.trim()}
        onClick={() => void incluir()}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400"
      >
        <PlusCircle className="h-4 w-4 mr-1" /> Incluir
      </button>
    </div>
  );
}
