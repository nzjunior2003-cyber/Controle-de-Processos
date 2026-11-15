/**
 * Matriz de permissões esperada das Firestore Rules (perfil × coleção ×
 * ler/criar/editar/apagar). É a ÚNICA fonte da verdade dos testes: o teste
 * gera os casos "permitido" e "negado" a partir daqui, e
 * `npm run rules:matriz` imprime a tabela para revisão.
 */
export const PERFIS = [
  'master', 'contratos', 'apoio', 'gestao', 'fiscal', 'bm4',
  'financeiro', 'dga', 'dal', 'df', 'dca', 'demandante',
] as const;
export type PerfilTeste = (typeof PERFIS)[number];

const TODOS: PerfilTeste[] = [...PERFIS];
const DIRETORIA: PerfilTeste[] = ['dga', 'dal', 'df', 'dca', 'bm4'];
const OPERACIONAL = TODOS.filter((p) => !DIRETORIA.includes(p));

export interface Permissoes {
  ler: PerfilTeste[];
  criar: PerfilTeste[];
  editar: PerfilTeste[];
  apagar: PerfilTeste[];
}

const so = (perfis: PerfilTeste[], ler: PerfilTeste[] = TODOS): Permissoes => ({
  ler, criar: perfis, editar: perfis, apagar: perfis,
});

export const MATRIZ: Record<string, Permissoes> = {
  processos: { ler: TODOS, criar: OPERACIONAL, editar: OPERACIONAL, apagar: ['master'] },
  movimentacoes: so(OPERACIONAL),
  estadas_processo: so(OPERACIONAL),
  alertas: so(OPERACIONAL),
  pareceres: so(OPERACIONAL),
  pcas: so(['master', 'bm4']),
  contratos: { ler: TODOS, criar: ['master', 'contratos', 'gestao'], editar: ['master', 'contratos', 'gestao'], apagar: ['master'] },
  execucoes: so(['master', 'contratos', 'gestao']),
  ocorrencias: so(['master', 'contratos', 'gestao']),
  aditivos: so(['master', 'contratos', 'gestao']),
  procedimentos: so(['master', 'contratos']),
  sancionatorios: so(['master', 'contratos']),
  portarias: so(['master', 'contratos']),
  irps: so(['master', 'bm4']),
  sincronizacoes: so(['master', 'apoio', 'contratos', 'gestao'], ['master', 'apoio', 'contratos', 'gestao']),
  pagamentos: so(['master', 'financeiro']),
  empenhos: so(['master', 'financeiro']),
  dotacoes: so(['master', 'financeiro']),
  aditivos_arp: so(['master', 'contratos']),
  apostilamentos: so(['master', 'contratos', 'gestao']),
  ajustes_rito: so(['master']),
  catalogo_orcamentario: {
    ler: TODOS,
    criar: ['master', 'financeiro', 'apoio', 'contratos', 'gestao'],
    editar: ['master', 'financeiro', 'apoio', 'contratos', 'gestao'],
    apagar: ['master', 'financeiro'],
  },
  usuarios: { ler: TODOS, criar: ['master'], editar: ['master'], apagar: ['master'] },
  logs_acesso: { ler: ['master'], criar: [], editar: [], apagar: [] }, // criar é público (caso especial testado à parte)
  logs_auditoria: { ler: ['master'], criar: [], editar: [], apagar: [] }, // criar: ver caso especial
};

export function tabelaMarkdown(): string {
  const linhas = ['| Coleção | Ler | Criar | Editar | Apagar |', '|---|---|---|---|---|'];
  const fmt = (l: PerfilTeste[]) => (l.length === TODOS.length ? 'todos ativos' : l.length ? l.join(', ') : '—');
  for (const [colecao, p] of Object.entries(MATRIZ)) {
    linhas.push(`| ${colecao} | ${fmt(p.ler)} | ${fmt(p.criar)} | ${fmt(p.editar)} | ${fmt(p.apagar)} |`);
  }
  return linhas.join('\n');
}
