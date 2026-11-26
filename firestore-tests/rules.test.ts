// @vitest-environment node
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, setLogLevel } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { MATRIZ, PERFIS } from './matriz';

let env: RulesTestEnvironment;
const uid = (p: string) => `u_${p}`;
const emailDe = (p: string) => `${p}@teste.com`;

beforeAll(async () => {
  setLogLevel('error');
  env = await initializeTestEnvironment({
    projectId: 'demo-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const p of PERFIS) {
      await setDoc(doc(db, 'usuarios', uid(p)), { nome: p, email: emailDe(p), perfil: p, ativo: true, setor_id: '1', unidadeDemandante: 'UNID_A' });
    }
    await setDoc(doc(db, 'usuarios', 'u_inativo'), { nome: 'x', email: 'inativo@teste.com', perfil: 'master', ativo: false, setor_id: '1' });
    for (const c of Object.keys(MATRIZ)) {
      await setDoc(doc(db, c, 'existente'), { teste: true, excluido: false, contratoId: 'c1', fiscalEmail: emailDe('fiscal') });
      await setDoc(doc(db, c, 'apagavel'), { teste: true });
    }
    await setDoc(doc(db, 'matriculas', '123'), { email: 'a@b.com' });
    await setDoc(doc(db, 'busca_publica', 'x'), { n: 1 });
  });
});
afterAll(async () => env?.cleanup());

const como = (p: string) => env.authenticatedContext(uid(p), { email: emailDe(p) }).firestore();

describe('matriz perfil × coleção (gerada de matriz.ts)', () => {
  for (const [colecao, perm] of Object.entries(MATRIZ)) {
    for (const p of PERFIS) {
      const casos: [keyof typeof perm, () => Promise<unknown>][] = [
        ['ler', () => getDoc(doc(como(p), colecao, 'existente'))],
        ['criar', () => setDoc(doc(como(p), colecao, `novo_${p}`), { teste: true, contratoId: 'c1' })],
        ['editar', () => updateDoc(doc(como(p), colecao, 'existente'), { teste2: `${p}-${Math.random()}` })],
        ['apagar', () => deleteDoc(doc(como(p), colecao, 'apagavel'))],
      ];
      for (const [op, exec] of casos) {
        if (colecao === 'logs_auditoria' && op === 'criar') continue;
        const permitido = perm[op].includes(p);
        it(`${colecao}: ${p} ${permitido ? 'PODE' : 'NÃO pode'} ${op}`, async () => {
          await (permitido ? assertSucceeds(exec()) : assertFails(exec()));
        });
      }
    }
  }
});

describe('sem sessão e usuário inativo', () => {
  for (const c of Object.keys(MATRIZ)) {
    it(`${c}: anônimo não lê`, async () => {
      await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), c, 'existente')));
    });
    it(`${c}: inativo não lê nem escreve`, async () => {
      const db = env.authenticatedContext('u_inativo', { email: 'inativo@teste.com' }).firestore();
      if (c !== 'usuarios') await assertFails(getDoc(doc(db, c, 'existente')));
      await assertFails(setDoc(doc(db, c, 'novo_inativo'), { teste: true }));
    });
  }
  it('anônimo lê busca_publica e uma matrícula (get), mas não lista matrículas', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'busca_publica', 'x')));
    await assertSucceeds(getDoc(doc(db, 'matriculas', '123')));
    await assertFails(getDocs(collection(db, 'matriculas')));
    await assertFails(setDoc(doc(db, 'busca_publica', 'y'), { n: 1 }));
  });
});

describe('autocadastro e anti-autopromoção', () => {
  const novo = (db: ReturnType<typeof como>, id: string, dados: Record<string, unknown>) => setDoc(doc(db, 'usuarios', id), dados);
  const ctxNovo = (id: string, email: string) => env.authenticatedContext(id, { email }).firestore();
  const base = { nome: 'Novo', email: 'novo@teste.com', cargo: '', perfil: 'fiscal', setor_id: '1', ativo: false };

  it('cria a si mesmo inativo como fiscal', async () => {
    await assertSucceeds(novo(ctxNovo('n1', 'novo@teste.com'), 'n1', base));
  });
  it('aceita e-mail com caixa diferente do token', async () => {
    await assertSucceeds(novo(ctxNovo('n2', 'novo2@teste.com'), 'n2', { ...base, email: 'Novo2@Teste.com' }));
  });
  it('não cria já ativo', async () => {
    await assertFails(novo(ctxNovo('n3', 'novo@teste.com'), 'n3', { ...base, ativo: true }));
  });
  it('não escolhe outro perfil (master, financeiro...)', async () => {
    await assertFails(novo(ctxNovo('n4', 'novo@teste.com'), 'n4', { ...base, perfil: 'master' }));
    await assertFails(novo(ctxNovo('n5', 'novo@teste.com'), 'n5', { ...base, perfil: 'financeiro' }));
  });
  it('não cria usuário com id de outra pessoa', async () => {
    await assertFails(novo(ctxNovo('n6', 'novo@teste.com'), 'u_master', base));
  });
  it('não usa o e-mail de outra pessoa', async () => {
    await assertFails(novo(ctxNovo('n7', 'novo@teste.com'), 'n7', { ...base, email: 'master@teste.com' }));
  });
  it('não grava campos extras (ex.: unidadeDemandante, senha)', async () => {
    await assertFails(novo(ctxNovo('n8', 'novo@teste.com'), 'n8', { ...base, unidadeDemandante: 'UNID_A' }));
    await assertFails(novo(ctxNovo('n9', 'novo@teste.com'), 'n9', { ...base, senha: '123' }));
  });
  it('usuário ativo não promove a si mesmo nem muda e-mail/unidade', async () => {
    const db = como('fiscal');
    await assertFails(updateDoc(doc(db, 'usuarios', uid('fiscal')), { perfil: 'master' }));
    await assertFails(updateDoc(doc(db, 'usuarios', uid('fiscal')), { ativo: false }));
    await assertFails(updateDoc(doc(db, 'usuarios', uid('fiscal')), { email: 'outro@x.com' }));
    await assertFails(updateDoc(doc(db, 'usuarios', uid('demandante')), { unidadeDemandante: 'UNID_B' }));
    await assertSucceeds(updateDoc(doc(db, 'usuarios', uid('fiscal')), { nomeGuerra: 'Fulano' }));
  });
  it('usuário inativo não se ativa', async () => {
    const db = env.authenticatedContext('u_inativo', { email: 'inativo@teste.com' }).firestore();
    await assertFails(updateDoc(doc(db, 'usuarios', 'u_inativo'), { ativo: true }));
  });
  it('master aprova (ativa) e muda perfil de outro', async () => {
    await assertSucceeds(updateDoc(doc(como('master'), 'usuarios', 'n1'), { ativo: true, perfil: 'apoio' }));
  });
});

describe('processos: exclusão lógica', () => {
  const marcar = (p: string) => updateDoc(doc(como(p), 'processos', 'existente'), { excluido: true, excluido_em: 'agora', excluido_por: uid(p) });
  for (const p of PERFIS) {
    const admin = ['master', 'contratos', 'apoio'].includes(p);
    it(`${p} ${admin ? 'PODE' : 'NÃO pode'} marcar processo como excluído`, async () => {
      await (admin ? assertSucceeds(marcar(p)) : assertFails(marcar(p)));
      await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'processos', 'existente'), { excluido: false }); });
    });
  }
});

describe('casos especiais por regra de negócio', () => {
  it('fiscal do contrato só altera os campos de saldo', async () => {
    const db = como('fiscal');
    await assertSucceeds(updateDoc(doc(db, 'contratos', 'existente'), { saldoAtualFinanceiro: 10, atualizado_em: 'x' }));
    await assertFails(updateDoc(doc(db, 'contratos', 'existente'), { valorGlobal: 1 }));
  });
  it('financeiro só altera saldo/dotação do contrato', async () => {
    const db = como('financeiro');
    await assertSucceeds(updateDoc(doc(db, 'contratos', 'existente'), { saldoAtualFinanceiro: 10 }));
    await assertFails(updateDoc(doc(db, 'contratos', 'existente'), { empresa: 'X' }));
  });
  it('fiscal cria execução só do próprio contrato', async () => {
    const db = como('fiscal');
    await assertSucceeds(setDoc(doc(db, 'execucoes', 'e1'), { contratoId: 'existente' }));
    await assertFails(setDoc(doc(db, 'execucoes', 'e2'), { contratoId: 'outro' }));
  });
  it('notificações: só o destinatário lê/marca lida/apaga', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'notificacoes', 'n1'), { destinatarioId: uid('apoio'), lida: false }); });
    await assertSucceeds(getDoc(doc(como('apoio'), 'notificacoes', 'n1')));
    await assertFails(getDoc(doc(como('gestao'), 'notificacoes', 'n1')));
    await assertFails(updateDoc(doc(como('gestao'), 'notificacoes', 'n1'), { lida: true }));
    await assertFails(updateDoc(doc(como('apoio'), 'notificacoes', 'n1'), { destinatarioId: uid('gestao') }));
    await assertSucceeds(updateDoc(doc(como('apoio'), 'notificacoes', 'n1'), { lida: true }));
    await assertSucceeds(setDoc(doc(como('gestao'), 'notificacoes', 'n2'), { destinatarioId: uid('apoio'), lida: false }));
    await assertFails(deleteDoc(doc(como('gestao'), 'notificacoes', 'n1')));
    await assertSucceeds(deleteDoc(doc(como('apoio'), 'notificacoes', 'n1')));
  });
  it('push_subscriptions: só o dono grava, só endpoint https', async () => {
    const sub = { usuarioId: uid('apoio'), endpoint: 'https://fcm.googleapis.com/x' };
    await assertSucceeds(setDoc(doc(como('apoio'), 'push_subscriptions', 'p1'), sub));
    await assertFails(setDoc(doc(como('gestao'), 'push_subscriptions', 'p2'), sub));
    await assertFails(setDoc(doc(como('apoio'), 'push_subscriptions', 'p3'), { ...sub, endpoint: 'http://x' }));
    await assertFails(deleteDoc(doc(como('gestao'), 'push_subscriptions', 'p1')));
    await assertSucceeds(deleteDoc(doc(como('apoio'), 'push_subscriptions', 'p1')));
  });
  it('IRP: demandante só responde IRP da própria unidade e só campos de resposta', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'irps', 'i1'), { setoresDemandantes: ['UNID_A'], status: 'aberta' });
      await setDoc(doc(ctx.firestore(), 'irps', 'i2'), { setoresDemandantes: ['UNID_B'], status: 'aberta' });
    });
    const db = como('demandante');
    await assertSucceeds(updateDoc(doc(db, 'irps', 'i1'), { status: 'aderida', atualizado_em: 'x' }));
    await assertFails(updateDoc(doc(db, 'irps', 'i1'), { objeto: 'x' }));
    await assertFails(updateDoc(doc(db, 'irps', 'i2'), { status: 'aderida' }));
  });
  it('log de acesso: criação pública só no formato esperado; leitura só master', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(anon, 'logs_acesso', 'a1'), { userId: null, email: 'a@b.com', sucesso: false, dataHora: 'x', userAgent: 'ua' }));
    await assertFails(setDoc(doc(anon, 'logs_acesso', 'a2'), { email: 'a@b.com', sucesso: false, extra: 1 }));
    await assertFails(setDoc(doc(anon, 'logs_acesso', 'a3'), { email: 'a@b.com', sucesso: false, userAgent: 'x'.repeat(500) }));
    await assertFails(getDoc(doc(como('apoio'), 'logs_acesso', 'a1')));
  });
  it('log de auditoria: ativo grava só em nome de si; imutável; leitura só master', async () => {
    const dados = { colecao: 'processos', documentoId: 'p', acao: 'UPDATE', usuarioId: uid('apoio'), usuarioNome: 'a', dataHora: 'x', resumo: 'r' };
    await assertSucceeds(setDoc(doc(como('apoio'), 'logs_auditoria', 'l1'), dados));
    await assertFails(setDoc(doc(como('apoio'), 'logs_auditoria', 'l2'), { ...dados, usuarioId: uid('master') }));
    await assertFails(setDoc(doc(env.authenticatedContext('u_inativo', { email: 'inativo@teste.com' }).firestore(), 'logs_auditoria', 'l3'), { ...dados, usuarioId: 'u_inativo' }));
    await assertFails(updateDoc(doc(como('master'), 'logs_auditoria', 'l1'), { resumo: 'alterado' }));
    await assertFails(deleteDoc(doc(como('master'), 'logs_auditoria', 'l1')));
    await assertFails(getDoc(doc(como('apoio'), 'logs_auditoria', 'l1')));
    await assertSucceeds(getDoc(doc(como('master'), 'logs_auditoria', 'l1')));
  });
  it('coleção desconhecida é negada para todos (deny by default)', async () => {
    await assertFails(getDoc(doc(como('master'), 'qualquer_coisa', 'x')));
    await assertFails(setDoc(doc(como('master'), 'qualquer_coisa', 'x'), { a: 1 }));
  });
});

describe('processos: campos do fluxo de compras', () => {
  // Cada teste parte do mesmo documento limpo (sem campos do fluxo).
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'processos', 'existente'), { teste: true, excluido: false });
    });
  });
  const confirmar = (p: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(como(p), 'processos', 'existente'), {
      etapaAtualId: 'E07', etapaOrigem: 'auto', etapaConfirmadaEm: new Date().toISOString(), etapaConfirmadaPor: uid(p), ...extra,
    });

  for (const p of PERFIS) {
    const pode = ['master', 'apoio', 'contratos'].includes(p);
    it(`${p} ${pode ? 'PODE' : 'NÃO pode'} confirmar etapa do fluxo`, async () => {
      await (pode ? assertSucceeds(confirmar(p)) : assertFails(confirmar(p)));
    });
    it(`${p} ${pode ? 'PODE' : 'NÃO pode'} responder pergunta do fluxo`, async () => {
      const r = updateDoc(doc(como(p), 'processos', 'existente'), { necessitaDotacao: true });
      await (pode ? assertSucceeds(r) : assertFails(r));
    });
  }

  it('não dá para forjar quem confirmou', async () => {
    await assertFails(confirmar('apoio', { etapaConfirmadaPor: uid('master') }));
  });
  it('mudar a etapa sem registrar a confirmação em nome próprio é negado', async () => {
    await assertFails(updateDoc(doc(como('apoio'), 'processos', 'existente'), { etapaAtualId: 'E10' }));
  });
  it('valores inválidos são negados (etapa, origem, rito, decisão)', async () => {
    await assertFails(confirmar('apoio', { etapaAtualId: 'E36' }));
    await assertFails(confirmar('apoio', { etapaAtualId: 'X01' }));
    await assertFails(confirmar('apoio', { etapaOrigem: 'robo' }));
    await assertFails(updateDoc(doc(como('apoio'), 'processos', 'existente'), { ritoProcessual: 'qualquer' }));
    await assertFails(updateDoc(doc(como('apoio'), 'processos', 'existente'), { haveraFaseExterna: 'sim' }));
    await assertSucceeds(updateDoc(doc(como('apoio'), 'processos', 'existente'), { ritoProcessual: 'concorrencia' }));
  });
  it('perfis sem permissão continuam editando os demais campos do processo', async () => {
    await assertSucceeds(updateDoc(doc(como('fiscal'), 'processos', 'existente'), { observacao: `x${Math.random()}` }));
  });
  it('criar processo já com campos do fluxo: só os perfis permitidos', async () => {
    await assertSucceeds(setDoc(doc(como('apoio'), 'processos', 'novo_fluxo_ok'), { ritoProcessual: 'pregao' }));
    await assertFails(setDoc(doc(como('fiscal'), 'processos', 'novo_fluxo_fiscal'), { ritoProcessual: 'pregao' }));
    await assertFails(setDoc(doc(como('apoio'), 'processos', 'novo_fluxo_ruim'), { ritoProcessual: 'xxx' }));
    await assertSucceeds(setDoc(doc(como('fiscal'), 'processos', 'novo_sem_fluxo'), { numero_processo: 'x' }));
  });
});

describe('config_fluxo (prazos do fluxo de compras)', () => {
  const prazos = (p: string, dados: Record<string, unknown>) => setDoc(doc(como(p), 'config_fluxo', 'prazos'), dados);
  const valido = (p: string) => ({ diasPorEtapa: { E07: 20, E19: 7 }, prazoAteContratoPorRito: { pregao: 120 }, atualizado_em: 'x', atualizado_por: uid(p) });

  for (const p of PERFIS) {
    const pode = ['master', 'dal'].includes(p);
    it(`${p} ${pode ? 'PODE' : 'NÃO pode'} gravar os prazos`, async () => {
      await (pode ? assertSucceeds(prazos(p, valido(p))) : assertFails(prazos(p, valido(p))));
    });
    it(`${p} PODE ler os prazos`, async () => {
      await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'config_fluxo', 'prazos'), { diasPorEtapa: {} }); });
      await assertSucceeds(getDoc(doc(como(p), 'config_fluxo', 'prazos')));
    });
  }
  it('anônimo e inativo não leem', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'config_fluxo', 'prazos')));
    await assertFails(getDoc(doc(env.authenticatedContext('u_inativo', { email: 'inativo@teste.com' }).firestore(), 'config_fluxo', 'prazos')));
  });
  it('valores inválidos são negados (número fora da faixa, texto, etapa ou rito inexistente, campo extra)', async () => {
    await assertFails(prazos('dal', { ...valido('dal'), diasPorEtapa: { E07: -1 } }));
    await assertFails(prazos('dal', { ...valido('dal'), diasPorEtapa: { E07: 400 } }));
    await assertFails(prazos('dal', { ...valido('dal'), diasPorEtapa: { E07: 'vinte' } }));
    await assertFails(prazos('dal', { ...valido('dal'), diasPorEtapa: { E99: 5 } }));
    await assertFails(prazos('dal', { ...valido('dal'), prazoAteContratoPorRito: { qualquer: 5 } }));
    await assertFails(prazos('dal', { ...valido('dal'), extra: true }));
  });
  it('não dá para forjar quem atualizou', async () => {
    await assertFails(prazos('dal', { ...valido('dal'), atualizado_por: uid('master') }));
  });
  it('só o documento "prazos" é aceito e só o master apaga', async () => {
    await assertFails(setDoc(doc(como('dal'), 'config_fluxo', 'outro'), valido('dal')));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'config_fluxo', 'prazos'), { diasPorEtapa: {} }); });
    await assertFails(deleteDoc(doc(como('dal'), 'config_fluxo', 'prazos')));
    await assertSucceeds(deleteDoc(doc(como('master'), 'config_fluxo', 'prazos')));
  });
});

describe('processos: histórico das etapas (Fase D)', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'processos', 'existente'), { teste: true, excluido: false });
    });
  });
  const historico = [{ etapaId: 'E07', inicio: '2026-11-01T12:00:00Z', fim: '2026-11-16T12:00:00Z' }, { etapaId: 'E08', inicio: '2026-11-16T12:00:00Z' }];
  const gravar = (p: string, h: unknown) => updateDoc(doc(como(p), 'processos', 'existente'), { historicoEtapas: h });

  for (const p of PERFIS) {
    const pode = ['master', 'apoio', 'contratos'].includes(p);
    it(`${p} ${pode ? 'PODE' : 'NÃO pode'} gravar o histórico das etapas`, async () => {
      await (pode ? assertSucceeds(gravar(p, historico)) : assertFails(gravar(p, historico)));
    });
  }
  it('o histórico precisa ser uma lista de até 80 itens', async () => {
    await assertFails(gravar('apoio', 'texto'));
    await assertFails(gravar('apoio', { etapaId: 'E07' }));
    await assertFails(gravar('apoio', Array.from({ length: 81 }, () => ({ etapaId: 'E07', inicio: 'x' }))));
    await assertSucceeds(gravar('apoio', Array.from({ length: 80 }, () => ({ etapaId: 'E07', inicio: 'x' }))));
  });
  it('confirmar etapa junto com o histórico, em nome próprio, é aceito; forjar o autor não', async () => {
    const campos = (p: string, por: string) => updateDoc(doc(como(p), 'processos', 'existente'), {
      etapaAtualId: 'E08', etapaOrigem: 'manual', etapaConfirmadaEm: new Date().toISOString(), etapaConfirmadaPor: por, historicoEtapas: historico,
    });
    await assertSucceeds(campos('contratos', uid('contratos')));
    await assertFails(campos('contratos', uid('master')));
  });
});

