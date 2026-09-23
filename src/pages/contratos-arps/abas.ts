import { FilePlus, FileText, Users, type LucideIcon } from 'lucide-react';

export type AbaContratos =
  | 'contratos'
  | 'pregoes'
  | 'inexigibilidades'
  | 'dispensas'
  | 'adesoes'
  | 'participe'
  | 'sancionatorios'
  | 'portarias';

/** Abas que compartilham o mesmo formulário de procedimento licitatório. */
export const ABAS_PROCEDIMENTO: AbaContratos[] = [
  'pregoes',
  'inexigibilidades',
  'dispensas',
  'adesoes',
  'participe',
];

export const isAbaProcedimento = (aba: AbaContratos) => ABAS_PROCEDIMENTO.includes(aba);

/** Dados do formulário do modal — o mesmo modal atende a vários tipos. */
export type RegistroFormData = Record<string, any>;

export interface DefinicaoAba {
  id: AbaContratos;
  nome: string;
  icone: LucideIcon;
  color: string;
  bgClass: string;
  borderLClass: string;
  ringClass: string;
  borderClass: string;
  textClass: string;
  textThemeClass: string;
  textNumClass: string;
}

/**
 * Só 3 cards ficam visíveis (Contratos, ARP's e Partícipes) — os demais
 * tipos (pregões, inexigibilidades, dispensas, sancionatórios, portarias)
 * continuam com seus dados/telas no código (nada foi apagado do
 * Firestore), só não têm mais card de acesso nesta tela.
 */
export const MENU_ABAS: DefinicaoAba[] = [
  {
    id: 'contratos',
    nome: 'Contratos',
    icone: FileText,
    color: 'emerald-500',
    bgClass: 'bg-emerald-50/50',
    borderLClass: 'border-l-emerald-500',
    ringClass: 'ring-emerald-500',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-500',
    textThemeClass: 'text-emerald-800',
    textNumClass: 'text-emerald-900',
  },
  {
    id: 'adesoes',
    nome: "ARP's",
    icone: FilePlus,
    color: 'teal-500',
    bgClass: 'bg-teal-50/50',
    borderLClass: 'border-l-teal-500',
    ringClass: 'ring-teal-500',
    borderClass: 'border-teal-200',
    textClass: 'text-teal-500',
    textThemeClass: 'text-teal-800',
    textNumClass: 'text-teal-900',
  },
  {
    id: 'participe',
    nome: 'Partícipes',
    icone: Users,
    color: 'indigo-500',
    bgClass: 'bg-indigo-50/50',
    borderLClass: 'border-l-indigo-500',
    ringClass: 'ring-indigo-500',
    borderClass: 'border-indigo-200',
    textClass: 'text-indigo-500',
    textThemeClass: 'text-indigo-800',
    textNumClass: 'text-indigo-900',
  },
];

/** Modalidade padrão gravada quando o formulário não define uma. */
export function modalidadePadrao(aba: AbaContratos): string {
  switch (aba) {
    case 'pregoes':
      return 'Pregão Eletrônico';
    case 'inexigibilidades':
      return 'Inexigibilidade';
    case 'dispensas':
      return 'Dispensa';
    case 'adesoes':
      return 'Adesão';
    case 'participe':
      return 'Partícipe';
    default:
      return '';
  }
}

/** Termo usado para filtrar os procedimentos exibidos em cada aba. */
export function filtroModalidade(aba: AbaContratos): string {
  switch (aba) {
    case 'pregoes':
      return 'Pregão';
    case 'inexigibilidades':
      return 'Inexigibilidade';
    case 'dispensas':
      return 'Dispensa';
    case 'adesoes':
      return 'Adesão';
    case 'participe':
      return 'Partícipe';
    default:
      return '';
  }
}

export const rotuloNovoRegistro = (aba: AbaContratos): string => {
  switch (aba) {
    case 'pregoes':
      return 'Novo Pregão';
    case 'inexigibilidades':
      return 'Nova Inexigibilidade';
    case 'dispensas':
      return 'Nova Dispensa';
    case 'adesoes':
      return 'Nova Adesão';
    case 'participe':
      return 'Novo Partícipe';
    case 'sancionatorios':
      return 'Novo Processo';
    default:
      return 'Nova Portaria';
  }
};
