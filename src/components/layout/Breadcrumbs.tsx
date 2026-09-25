import { Link, useLocation, matchPath } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface Trilha {
  path: string;
  titulos: string[];
}

/**
 * Nomenclatura igual à usada no menu lateral (Sidebar.tsx), como exige a
 * política institucional (art. 6.6) — o breadcrumb não pode usar termos
 * diferentes dos que o usuário já vê na navegação principal.
 */
const ROTAS: Trilha[] = [
  { path: '/sistema', titulos: ['Início'] },
  { path: '/sistema/apoio', titulos: ['Apoio e Suprimento'] },
  { path: '/sistema/aquisicoes', titulos: ['Apoio e Suprimento'] },
  { path: '/sistema/contratos-arps', titulos: ["Contratos e ARP's"] },
  { path: '/sistema/gestao-contratos', titulos: ['Gestão de Contratos'] },
  { path: '/sistema/gestao-contratos/novo', titulos: ['Gestão de Contratos', 'Novo Contrato'] },
  { path: '/sistema/gestao-contratos/:id/editar', titulos: ['Gestão de Contratos', 'Editar Contrato'] },
  { path: '/sistema/fiscal-contrato', titulos: ['Fiscal do Contrato'] },
  { path: '/sistema/fiscal-contrato/:id/gerenciar', titulos: ['Fiscal do Contrato', 'Gerenciar Execução'] },
  { path: '/sistema/processos/novo', titulos: ['Apoio e Suprimento', 'Novo Processo'] },
  { path: '/sistema/processos/:id/editar', titulos: ['Apoio e Suprimento', 'Editar Processo'] },
  { path: '/sistema/processos/:id', titulos: ['Apoio e Suprimento', 'Detalhes do Processo'] },
  { path: '/sistema/dashboard', titulos: ['Dashboard Corporativo'] },
  { path: '/sistema/usuarios', titulos: ['Usuários'] },
  { path: '/sistema/auditoria', titulos: ['Auditoria'] },
];

function encontrarTrilha(pathname: string): string[] | null {
  // Rotas mais específicas primeiro, pra "/gestao-contratos/:id/editar" não
  // cair no match genérico de "/gestao-contratos".
  const ordenadas = [...ROTAS].sort((a, b) => b.path.length - a.path.length);
  for (const rota of ordenadas) {
    if (matchPath({ path: rota.path, end: true }, pathname)) return rota.titulos;
  }
  return null;
}

/** Trilha de navegação (art. 6.6 da PIDS/DTIC) — omitida na página inicial, onde não agrega informação. */
export default function Breadcrumbs() {
  const location = useLocation();
  const titulos = encontrarTrilha(location.pathname);

  if (!titulos || titulos.length === 0 || location.pathname === '/sistema') return null;

  return (
    <nav aria-label="Trilha de navegação" className="flex items-center flex-wrap gap-1 text-sm text-gray-500 dark:text-slate-400 mb-4">
      <Link to="/sistema" className="flex items-center hover:text-red-700 dark:hover:text-red-400">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {titulos.map((titulo, indice) => (
        <span key={`${titulo}-${indice}`} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600" />
          <span className={indice === titulos.length - 1 ? 'font-medium text-gray-700 dark:text-slate-200' : ''}>
            {titulo}
          </span>
        </span>
      ))}
    </nav>
  );
}
