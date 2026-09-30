/**
 * Cor determinística por setor/unidade, usada para diferenciar visualmente
 * as linhas do Plano de Contratação Anual por setor demandante. Como os
 * nomes de setor vêm de texto livre da planilha (nem sempre batem com
 * `OPCOES_UNIDADE_DEMANDANTE`, ex.: "CFAE"), a cor é escolhida por hash do
 * nome sobre uma paleta fixa — sem precisar cadastrar cada setor.
 */
export interface CorSetor {
  bg: string;
  text: string;
  border: string;
}

const PALETA: CorSetor[] = [
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' },
  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-300' },
  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-300' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-300' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-300' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-300' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
  { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-300' },
  { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-300' },
  { bg: 'bg-zinc-50', text: 'text-zinc-700', border: 'border-zinc-300' },
];

const CINZA_PADRAO: CorSetor = { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-300' };

/**
 * Devolve sempre a mesma cor para o mesmo nome de setor (hash simples da
 * soma dos códigos de caractere, módulo o tamanho da paleta).
 */
export function corDoSetor(nome: string | undefined): CorSetor {
  const texto = (nome ?? '').trim();
  if (!texto) return CINZA_PADRAO;

  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash + texto.charCodeAt(i) * (i + 1)) % PALETA.length;
  }
  return PALETA[hash];
}
