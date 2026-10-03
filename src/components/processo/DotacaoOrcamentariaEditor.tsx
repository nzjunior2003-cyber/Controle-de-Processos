import { useState } from 'react';
import { PlusCircle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { descricaoDoCodigo, normalizarCodigoOrcamentario } from '../../lib/orcamento';
import { CAMPOS_ORCAMENTARIOS, type CampoOrcamentario, type ClassificacaoOrcamentaria } from '../../types';

interface Props {
  linhas: ClassificacaoOrcamentaria[];
  onChange: (linhas: ClassificacaoOrcamentaria[]) => void;
  somenteLeitura?: boolean;
}

const CLASSE_INPUT =
  'block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm py-1.5 px-2 border';

/**
 * Campos da dotação orçamentária em linha (formato da ficha da Finanças), cada
 * um com o rótulo acima. Ao digitar um código já cadastrado a descrição
 * aparece sozinha; um código novo pede a descrição e entra no catálogo. Dá
 * pra acrescentar mais linhas (ex.: duas fontes ou duas naturezas).
 */
export default function DotacaoOrcamentariaEditor({ linhas, onChange, somenteLeitura = false }: Props) {
  const { catalogoOrcamentario, salvarItemCatalogo } = useApp();
  // Descrições digitadas pra códigos ainda sem cadastro — gravadas no catálogo ao sair do campo.
  const [rascunho, setRascunho] = useState<Record<string, string>>({});

  const atualizarCampo = (indice: number, campo: CampoOrcamentario, valor: string) =>
    onChange(linhas.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)));

  const guardarDescricao = async (campo: CampoOrcamentario, codigo: string) => {
    const texto = rascunho[`${campo}|${codigo}`];
    if (!texto?.trim()) return;
    try {
      await salvarItemCatalogo(campo, codigo, texto);
      setRascunho((anterior) => {
        const { [`${campo}|${codigo}`]: _removido, ...resto } = anterior;
        return resto;
      });
    } catch (erro) {
      alert('Não foi possível salvar a descrição: ' + (erro instanceof Error ? erro.message : String(erro)));
    }
  };

  const codigosDoCampo = (campo: CampoOrcamentario) => catalogoOrcamentario.filter((i) => i.campo === campo);

  return (
    <div className="mt-3 space-y-3">
      {linhas.map((linha, indice) => (
        <div key={indice} className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase">Dotação {linhas.length > 1 ? indice + 1 : ''}</span>
            {!somenteLeitura && linhas.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(linhas.filter((_, i) => i !== indice))}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Remover esta linha"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3">
            {CAMPOS_ORCAMENTARIOS.map(({ chave, rotulo, exemplo }) => {
              const codigo = linha[chave] ?? '';
              const codigoLimpo = normalizarCodigoOrcamentario(codigo);
              const descricao = descricaoDoCodigo(catalogoOrcamentario, chave, codigoLimpo);
              const idLista = `catalogo-${chave}-${indice}`;
              return (
                <div key={chave}>
                  <label className="block text-[11px] font-medium text-gray-600 uppercase" htmlFor={`${idLista}-input`}>{rotulo}</label>
                  <input
                    id={`${idLista}-input`}
                    type="text"
                    list={idLista}
                    value={codigo}
                    disabled={somenteLeitura}
                    onChange={(e) => atualizarCampo(indice, chave, e.target.value)}
                    className={`${CLASSE_INPUT} mt-1 disabled:bg-gray-50`}
                    placeholder={exemplo}
                  />
                  <datalist id={idLista}>
                    {codigosDoCampo(chave).map((i) => <option key={i.id} value={i.codigo}>{i.descricao}</option>)}
                  </datalist>
                  {codigoLimpo && descricao && <p className="mt-1 text-xs text-gray-500">{descricao}</p>}
                  {codigoLimpo && !descricao && !somenteLeitura && (
                    <input
                      type="text"
                      value={rascunho[`${chave}|${codigoLimpo}`] ?? ''}
                      onChange={(e) => setRascunho((anterior) => ({ ...anterior, [`${chave}|${codigoLimpo}`]: e.target.value }))}
                      onBlur={() => guardarDescricao(chave, codigoLimpo)}
                      className={`${CLASSE_INPUT} mt-1 border-amber-300 bg-amber-50`}
                      placeholder="Código novo — informe a descrição"
                      aria-label={`Descrição de ${rotulo}`}
                    />
                  )}
                  {codigoLimpo && !descricao && somenteLeitura && <p className="mt-1 text-xs text-gray-400">sem descrição cadastrada</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {!somenteLeitura && (
        <button
          type="button"
          onClick={() => onChange([...linhas, {}])}
          className="inline-flex items-center text-sm font-medium text-red-700 hover:underline"
        >
          <PlusCircle className="h-4 w-4 mr-1" /> Adicionar outra dotação
        </button>
      )}
    </div>
  );
}
