import {
  BadgeCheck,
  BookOpen,
  Building,
  FilePlus,
  FileText,
  FileWarning,
  Users,
  type LucideIcon,
} from 'lucide-react';

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

export const MENU_ABAS: DefinicaoAba[] = [
  {
    id: 'contratos',
    nome: 'Contratos e ARPs',
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
    id: 'pregoes',
    nome: 'Pregões',
    icone: FileText,
    color: 'red-600',
    bgClass: 'bg-red-50/50',
    borderLClass: 'border-l-red-600',
    ringClass: 'ring-red-600',
    borderClass: 'border-red-200',
    textClass: 'text-red-600',
    textThemeClass: 'text-red-800',
    textNumClass: 'text-red-900',
  },
  {
    id: 'inexigibilidades',
    nome: 'Inexigibilidades',
    icone: BadgeCheck,
    color: 'blue-500',
    bgClass: 'bg-blue-50/50',
    borderLClass: 'border-l-blue-500',
    ringClass: 'ring-blue-500',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-500',
    textThemeClass: 'text-blue-800',
    textNumClass: 'text-blue-900',
  },
  {
    id: 'dispensas',
    nome: 'Dispensas',
    icone: Building,
    color: 'amber-500',
    bgClass: 'bg-amber-50/50',
    borderLClass: 'border-l-amber-500',
    ringClass: 'ring-amber-500',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-500',
    textThemeClass: 'text-amber-800',
    textNumClass: 'text-amber-900',
  },
  {
    id: 'adesoes',
    nome: 'Adesões',
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
    nome: 'Partícipe',
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
  {
    id: 'sancionatorios',
    nome: 'Sancionatórios',
    icone: FileWarning,
    color: 'purple-500',
    bgClass: 'bg-purple-50/50',
    borderLClass: 'border-l-purple-500',
    ringClass: 'ring-purple-500',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-500',
    textThemeClass: 'text-purple-800',
    textNumClass: 'text-purple-900',
  },
  {
    id: 'portarias',
    nome: 'Portarias de Fiscais',
    icone: BookOpen,
    color: 'gray-500',
    bgClass: 'bg-gray-50/50',
    borderLClass: 'border-l-gray-500',
    ringClass: 'ring-gray-500',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-500',
    textThemeClass: 'text-gray-800',
    textNumClass: 'text-gray-900',
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
