import { describe, expect, it } from 'vitest';
import {
  APOS_AJUSTES_E16,
  CHECKLIST_E07,
  CHECKLIST_E07_DISPENSA_ATE_METADE,
  ETAPAS,
  MAPA_RITO_ANTIGO,
  PERGUNTAS,
  REGRAS_LOCALIZACAO,
  RITOS_FORA_DO_FLUXO,
  TRANSICOES,
  type RitoCompras,
} from '../config/fluxoCompras';
import {
  avaliarE07,
  caminhoDoProcesso,
  calcularFluxo,
  etapasPossiveis,
  proximoDe,
  ritoEfetivo,
  sugerirEtapaAtual,
  type ProcessoFluxo,
} from './fluxoCompras';
import { RITOS_CANONICOS } from './ritosProcessuais';

const ids = (etapas: { id: string }[]) => etapas.map((e) => e.id);
const todosOsItens = (rito: RitoCompras, p: ProcessoFluxo = {}) =>
  avaliarE07({ ritoProcessual: rito, ...p }).exigidos.map((i) => i.apelidos[0]);

/** Respostas de todas as decisões — para testar o caminho completo. */
const respondido = (o: Partial<ProcessoFluxo> = {}): ProcessoFluxo => ({
  necessitaDotacao: true,
  cbmGerenciadorOuParticipeArp: false,
  parecerJuridicoAprovadoSemRecomendacoes: true,
  haveraFaseExterna: true,
  ...o,
});

describe('consistência do catálogo', () => {
  it('tem as 35 etapas, em ordem, sem repetir id', () => {
    expect(ETAPAS).toHaveLength(35);
    expect(ETAPAS.map((e) => e.id)).toEqual(Array.from({ length: 35 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`));
  });

  it('toda transição aponta para etapas que existem', () => {
    const existe = (id: string) => ETAPAS.some((e) => e.id === id);
    for (const [origem, regra] of Object.entries(TRANSICOES)) {
      expect(existe(origem)).toBe(true);
      if (typeof regra === 'string') expect(existe(regra)).toBe(true);
      else if (regra) {
        expect(existe(regra.sim)).toBe(true);
        expect(existe(regra.nao)).toBe(true);
        expect(PERGUNTAS[regra.campo]).toBeTruthy();
      }
    }
    expect(existe(APOS_AJUSTES_E16)).toBe(true);
  });

  it('as regras de localização só citam etapas existentes', () => {
    REGRAS_LOCALIZACAO.forEach((r) => r.etapas.forEach((id) => expect(ETAPAS.some((e) => e.id === id)).toBe(true)));
  });

  it('os nomes de rito antigo mapeados existem na lista de ritos do sistema', () => {
    const canonicos = Object.keys(RITOS_CANONICOS);
    Object.keys(MAPA_RITO_ANTIGO).forEach((nome) => expect(canonicos).toContain(nome));
    RITOS_FORA_DO_FLUXO.forEach((nome) => expect(canonicos).toContain(nome));
  });

  it('PRD usa o nome "Pedido de Realização de Despesa"', () => {
    expect(ETAPAS.find((e) => e.id === 'E20')?.nome).toContain('Pedido de Realização de Despesa');
  });
});

describe('transições e caminho', () => {
  it('E01→…→E08 em sequência', () => {
    const { etapas } = caminhoDoProcesso({});
    expect(ids(etapas).slice(0, 8)).toEqual(['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']);
  });

  it('dotação: sim passa por E09 e E10; não vai direto para E11', () => {
    expect(ids(caminhoDoProcesso(respondido({ necessitaDotacao: true })).etapas)).toEqual(expect.arrayContaining(['E09', 'E10']));
    const sem = ids(caminhoDoProcesso(respondido({ necessitaDotacao: false })).etapas);
    expect(sem).not.toContain('E09');
    expect(sem).not.toContain('E10');
    expect(proximoDe('E08', { necessitaDotacao: false })).toEqual({ tipo: 'etapa', id: 'E11' });
    expect(proximoDe('E08', { necessitaDotacao: true })).toEqual({ tipo: 'etapa', id: 'E09' });
  });

  it('dotação sem resposta: o caminho para em E08 e pergunta', () => {
    const { etapas, pendente } = caminhoDoProcesso({});
    expect(etapas.at(-1)?.id).toBe('E08');
    expect(pendente?.texto).toBe('É necessário dotação orçamentária?');
  });

  it('CBM gerenciador/partícipe de ARP: E13 vai direto para E19 (pula jurídico e E17)', () => {
    const p = respondido({ cbmGerenciadorOuParticipeArp: true });
    expect(proximoDe('E13', p)).toEqual({ tipo: 'etapa', id: 'E19' });
    const caminho = ids(caminhoDoProcesso(p).etapas);
    ['E14', 'E15', 'E16', 'E17', 'E18'].forEach((e) => expect(caminho).not.toContain(e));
    expect(caminho).toContain('E19');
  });

  it('não é ARP: E13→E14→E15', () => {
    const p = respondido({ cbmGerenciadorOuParticipeArp: false });
    expect(proximoDe('E13', p)).toEqual({ tipo: 'etapa', id: 'E14' });
    expect(proximoDe('E14', p)).toEqual({ tipo: 'etapa', id: 'E15' });
  });

  it('parecer aprovado sem recomendações: E15→E17; senão E15→E16→E17', () => {
    expect(proximoDe('E15', { parecerJuridicoAprovadoSemRecomendacoes: true })).toEqual({ tipo: 'etapa', id: 'E17' });
    expect(proximoDe('E15', { parecerJuridicoAprovadoSemRecomendacoes: false })).toEqual({ tipo: 'etapa', id: 'E16' });
    expect(proximoDe('E16', {})).toEqual({ tipo: 'etapa', id: APOS_AJUSTES_E16 });
    expect(APOS_AJUSTES_E16).toBe('E17');
  });

  it('fase externa: sim E17→E18→E19; não E17→E19', () => {
    expect(proximoDe('E17', { haveraFaseExterna: true })).toEqual({ tipo: 'etapa', id: 'E18' });
    expect(proximoDe('E18', {})).toEqual({ tipo: 'etapa', id: 'E19' });
    expect(proximoDe('E17', { haveraFaseExterna: false })).toEqual({ tipo: 'etapa', id: 'E19' });
  });

  it('decisão sem resposta devolve a pergunta, nunca adivinha', () => {
    expect(proximoDe('E13', {})).toMatchObject({ tipo: 'pergunta', pergunta: { campo: 'cbmGerenciadorOuParticipeArp' } });
    expect(proximoDe('E15', {})).toMatchObject({ tipo: 'pergunta', pergunta: { campo: 'parecerJuridicoAprovadoSemRecomendacoes' } });
    expect(proximoDe('E17', {})).toMatchObject({ tipo: 'pergunta', pergunta: { campo: 'haveraFaseExterna' } });
  });

  it('de E19 até E35 é sequência; E35 é o fim', () => {
    for (let i = 19; i < 35; i += 1) {
      expect(proximoDe(`E${i}`, {})).toEqual({ tipo: 'etapa', id: `E${i + 1}` });
    }
    expect(proximoDe('E35', {})).toEqual({ tipo: 'fim' });
  });

  it('caminho completo respondido termina em E35', () => {
    const { etapas, pendente } = caminhoDoProcesso(respondido());
    expect(pendente).toBeNull();
    expect(etapas.at(-1)?.id).toBe('E35');
  });

  it('etapas possíveis incluem os dois lados de decisões em aberto', () => {
    const possiveis = etapasPossiveis({});
    expect(possiveis.has('E09')).toBe(true);
    expect(possiveis.has('E11')).toBe(true);
    expect(possiveis.has('E18')).toBe(true);
    expect(etapasPossiveis({ necessitaDotacao: false }).has('E09')).toBe(false);
  });
});

describe('rito', () => {
  it('usa ritoProcessual quando existe', () => {
    expect(ritoEfetivo({ ritoProcessual: 'concorrencia' })).toEqual({ rito: 'concorrencia', foraDoFluxo: false });
  });

  it('deduz do rito antigo (texto) quando o campo novo está vazio', () => {
    expect(ritoEfetivo({ rito_processual: 'Pregão Eletrônico' }).rito).toBe('pregao');
    expect(ritoEfetivo({ rito_processual: 'Pregão Eletrônico (SRP)' }).rito).toBe('pregao_srp');
    expect(ritoEfetivo({ rito_processual: 'Adesão ARP' }).rito).toBe('adesao_ata');
    expect(ritoEfetivo({ rito_processual: 'Gerenciador da ARP' }).rito).toBe('gerenciador_ata');
    expect(ritoEfetivo({ rito_processual: 'Partícipe de ARP' }).rito).toBe('participe_ata');
    expect(ritoEfetivo({ rito_processual: 'Inexigibilidade p/ Cursos' }).rito).toBe('inexigibilidade');
    expect(ritoEfetivo({ rito_processual: 'Dispensa por valor' }).rito).toBe('dispensa_eletronica');
  });

  it('prorrogação, acréscimo etc. ficam fora do fluxo de compras', () => {
    expect(ritoEfetivo({ rito_processual: 'Prorrogação' })).toEqual({ rito: null, foraDoFluxo: true });
    const fluxo = calcularFluxo({ rito_processual: 'Acréscimo ou supressão' });
    expect(fluxo.foraDoFluxo).toBe(true);
    expect(fluxo.proxima).toBeNull();
  });

  it('rito desconhecido ou vazio = sem rito', () => {
    expect(ritoEfetivo({})).toEqual({ rito: null, foraDoFluxo: false });
    expect(ritoEfetivo({ rito_processual: 'Rito novo inventado' })).toEqual({ rito: null, foraDoFluxo: false });
  });
});

describe('checklist da E07 por rito', () => {
  const rotulos = (rito: RitoCompras, p: ProcessoFluxo = {}) =>
    avaliarE07({ ritoProcessual: rito, ...p }).exigidos.map((i) => i.rotulo);

  it('pregão SRP', () => {
    expect(rotulos('pregao_srp')).toEqual([
      'ETP', 'AR', 'TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)',
      'Solicitar autorização da SEPLAD', 'Fazer IRP', 'Ajustar TR e OE',
    ]);
  });
  it('pregão', () => expect(rotulos('pregao')).toEqual(['ETP', 'AR', 'TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)']));
  it('concorrência', () => expect(rotulos('concorrencia')).toEqual(['ETP', 'AR', 'Projeto Básico', 'Pesquisa de preços', 'Orçamento Estimado (OE)']));
  it('inexigibilidade', () => expect(rotulos('inexigibilidade')).toEqual(['ETP', 'AR', 'TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)']));
  it('gerenciador de ata', () => expect(rotulos('gerenciador_ata')).toEqual(['Juntar demanda ao PAE original', 'Mapa de Demanda']));
  it('partícipe de ata', () => expect(rotulos('participe_ata')).toEqual(['Juntar documentação do SRP (edital e anexos)', 'Mapa de Demanda']));
  it('adesão a ata', () => expect(rotulos('adesao_ata')).toEqual([
    'ETP', 'AR', 'TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Juntar documentação do SRP (edital e anexos)',
    'Juntar solicitação de aceite e aceite da empresa', 'Juntar solicitação de autorização e autorização do órgão', 'Orçamento Estimado (OE)',
  ]));

  it('dispensa eletrônica: > 50% do limite = lista completa', () => {
    expect(rotulos('dispensa_eletronica', { dispensaAteMetadeLimite: false })).toEqual(['ETP', 'AR', 'TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)']);
    expect(avaliarE07({ ritoProcessual: 'dispensa_eletronica', dispensaAteMetadeLimite: false }).provisorio).toBe(false);
  });
  it('dispensa eletrônica: ≤ 50% do limite = só TR, SIMAS, pesquisa e OE', () => {
    expect(rotulos('dispensa_eletronica', { dispensaAteMetadeLimite: true })).toEqual(['TR', 'Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)']);
    expect(CHECKLIST_E07_DISPENSA_ATE_METADE).toHaveLength(4);
  });
  it('dispensa eletrônica sem resposta: lista completa, marcada como provisória, e pergunta pendente', () => {
    expect(avaliarE07({ ritoProcessual: 'dispensa_eletronica' }).provisorio).toBe(true);
    const fluxo = calcularFluxo({ ritoProcessual: 'dispensa_eletronica' });
    expect(fluxo.decisoesPendentes.map((d) => d.campo)).toContain('dispensaAteMetadeLimite');
  });

  it('a E07 só conclui com todos os itens marcados (nomes do checklist atual do sistema)', () => {
    const base: ProcessoFluxo = { ritoProcessual: 'pregao', checklist_rito: ['Estudo Técnico Preliminar', 'Análise de Risco', 'Termo de Referência'] };
    const parcial = avaliarE07(base);
    expect(parcial.completo).toBe(false);
    expect(parcial.faltando.map((i) => i.rotulo)).toEqual(['Pesquisa e codificação no SIMAS', 'Pesquisa de preços', 'Orçamento Estimado (OE)']);

    const completo = avaliarE07({
      ...base,
      checklist_rito: [...base.checklist_rito!, 'Pesquisa e Codificação no SIMAS', 'Orçamento Estimado/Pesquisa de preços'],
    });
    expect(completo.completo).toBe(true);
  });

  it('ignora acento, caixa e pontuação ao comparar os itens', () => {
    const r = avaliarE07({ ritoProcessual: 'concorrencia', checklist_rito: ['ESTUDO TECNICO PRELIMINAR (ETP)', 'analise de riscos', 'Projeto Básico', 'PESQUISA DE PREÇOS', 'Orçamento Estimado (OE)'] });
    expect(r.completo).toBe(true);
  });

  it('sem rito não há itens exigidos', () => {
    const r = avaliarE07({});
    expect(r.exigidos).toEqual([]);
    expect(r.completo).toBe(false);
  });

  it('todo rito tem checklist e todo item tem rótulo e apelidos', () => {
    (Object.keys(CHECKLIST_E07) as RitoCompras[]).forEach((rito) => {
      expect(CHECKLIST_E07[rito].length).toBeGreaterThan(0);
      CHECKLIST_E07[rito].forEach((i) => expect(i.apelidos.length).toBeGreaterThan(0));
      expect(todosOsItens(rito).length).toBeGreaterThan(0);
    });
  });
});

describe('sugestão da etapa atual', () => {
  const pregaoCompleto: ProcessoFluxo = {
    ritoProcessual: 'pregao',
    checklist_rito: ['Estudo Técnico Preliminar', 'Análise de Risco', 'Termo de Referência', 'Pesquisa e Codificação no SIMAS', 'Orçamento Estimado/Pesquisa de preços'],
  };

  it('sem rito e sem outra pista: sem sugestão', () => {
    expect(sugerirEtapaAtual({})).toBeNull();
  });

  it('rito definido e nada marcado: E07', () => {
    expect(sugerirEtapaAtual({ ritoProcessual: 'pregao' })?.etapaId).toBe('E07');
  });

  it('E07 completa: pelo menos E08', () => {
    expect(sugerirEtapaAtual(pregaoCompleto)?.etapaId).toBe('E08');
  });

  it('a localização move a sugestão adiante (CONJUR → E14), com confiança média', () => {
    const s = sugerirEtapaAtual({ ...pregaoCompleto, ...respondido(), localizacao_atual: 'CBM > CONJUR' });
    expect(s?.etapaId).toBe('E14');
    expect(s?.confianca).toBe('media');
  });

  it('o andamento só desempata entre etapas que a localização indicou', () => {
    const s = sugerirEtapaAtual({ ...pregaoCompleto, ...respondido(), localizacao_atual: 'CONJUR', andamento: 'Aguardando Comandante Geral' });
    expect(s?.etapaId).toBe('E15');
    expect(s?.confianca).toBe('alta');
  });

  it('texto do andamento sozinho NÃO muda a etapa (sem localização)', () => {
    const s = sugerirEtapaAtual({ ...pregaoCompleto, andamento: 'Aguardando pagamento da nota de empenho' });
    expect(s?.etapaId).toBe('E08');
    expect(s?.confianca).toBe('baixa');
  });

  it('usa a tramitação em aberto mais recente em vez da localização antiga', () => {
    const s = sugerirEtapaAtual(
      { ...pregaoCompleto, ...respondido(), localizacao_atual: 'DAL > SIPC' },
      [
        { localizacao: 'DAL > SIPC', data_inicio: '2026-01-01', data_fim: '2026-02-01' },
        { localizacao: 'CBM > CONJUR', data_inicio: '2026-02-01', data_fim: null },
      ],
    );
    expect(s?.etapaId).toBe('E14');
  });

  it('não sugere etapa que o processo não percorre (sem dotação nunca cai em E09/E10)', () => {
    const s = sugerirEtapaAtual({ ...pregaoCompleto, necessitaDotacao: false, localizacao_atual: 'DAL > SAS' });
    expect(['E09', 'E10']).not.toContain(s?.etapaId);
  });

  it('PRD preenchido e status concluído', () => {
    expect(sugerirEtapaAtual({ ...pregaoCompleto, prd: '123/2026' })?.etapaId).toBe('E21');
    expect(sugerirEtapaAtual({ status: 'arquivado' })?.etapaId).toBe('E35');
    expect(sugerirEtapaAtual({ ...pregaoCompleto, status: 'contratado_aditivado' })?.etapaId).toBe('E20');
  });

  it('rito fora do fluxo não recebe sugestão', () => {
    expect(sugerirEtapaAtual({ rito_processual: 'Prorrogação de contrato' })).toBeNull();
  });
});

describe('fluxo calculado (o que as telas vão usar)', () => {
  it('processo sem rito: próximo passo é "Definir o rito processual"', () => {
    const f = calcularFluxo({});
    expect(f.rito).toBeNull();
    expect(f.proxima?.id).toBe('E06');
    expect(f.proxima?.nome).toBe('Definir o rito processual');
    expect(f.motivoProxima).toBe('Definir o rito processual');
  });

  it('processo antigo sem NENHUM campo novo não quebra', () => {
    const antigo: ProcessoFluxo = { rito_processual: 'Pregão Eletrônico (SRP)', checklist_rito: ['Pesquisa de Preços'], andamento: 'Em análise', localizacao_atual: 'CBM > DAL' };
    expect(() => calcularFluxo(antigo)).not.toThrow();
    const f = calcularFluxo(antigo);
    expect(f.rito).toBe('pregao_srp');
    expect(f.etapaAtual?.id).toBe('E07');
    expect(f.proxima?.id).toBe('E08');
    expect(f.confirmada).toBe(false);
    expect(f.etapaOrigem).toBeNull();
  });

  it('E07 incompleta: lista os itens que faltam', () => {
    const f = calcularFluxo({ ritoProcessual: 'gerenciador_ata', checklist_rito: ['Juntar demanda ao PAE original'] });
    expect(f.e07.completo).toBe(false);
    expect(f.e07.faltando.map((i) => i.rotulo)).toEqual(['Mapa de Demanda']);
  });

  it('etapa confirmada vale mais que a sugestão; avisa quando a sugestão é outra', () => {
    const f = calcularFluxo({
      ritoProcessual: 'pregao', ...respondido(), localizacao_atual: 'CONJUR',
      checklist_rito: ['Estudo Técnico Preliminar', 'Análise de Risco', 'Termo de Referência', 'SIMAS', 'Orçamento Estimado/Pesquisa de preços'],
      etapaAtualId: 'E11', etapaOrigem: 'manual', etapaConfirmadaPor: 'u1', etapaConfirmadaEm: '2026-11-19',
    });
    expect(f.etapaAtual?.id).toBe('E11');
    expect(f.confirmada).toBe(true);
    expect(f.etapaOrigem).toBe('manual');
    expect(f.sugestao?.etapaId).toBe('E14');
    expect(f.sugestaoDiferente).toBe(true);
    expect(f.proxima?.id).toBe('E12');
  });

  it('etapaAtualId inválido é ignorado (cai na sugestão)', () => {
    const f = calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E99' });
    expect(f.confirmada).toBe(false);
    expect(f.etapaAtual?.id).toBe('E07');
  });

  it('decisão pendente na etapa atual bloqueia a próxima e é perguntada', () => {
    const f = calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E08', etapaOrigem: 'auto' });
    expect(f.proxima).toBeNull();
    expect(f.decisoesPendentes).toEqual([
      expect.objectContaining({ campo: 'necessitaDotacao', texto: 'É necessário dotação orçamentária?', bloqueiaProximo: true }),
    ]);
  });

  it('respondida a decisão, a próxima aparece', () => {
    expect(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E08', necessitaDotacao: true }).proxima?.id).toBe('E09');
    expect(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E08', necessitaDotacao: false }).proxima?.id).toBe('E11');
  });

  it('pergunta de decisão antiga, já passada, aparece sem bloquear', () => {
    const f = calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E14', etapaOrigem: 'manual', cbmGerenciadorOuParticipeArp: false });
    const dotacao = f.decisoesPendentes.find((d) => d.campo === 'necessitaDotacao');
    expect(dotacao?.bloqueiaProximo).toBe(false);
    expect(f.proxima?.id).toBe('E15');
  });

  it('setor aparece só como informação de quem age', () => {
    const f = calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E14', cbmGerenciadorOuParticipeArp: false });
    expect(f.setorAgora).toBe('CONJUR');
    expect(f.setorProxima).toBe('CONJUR');
  });

  it('etapas "caso necessário" são marcadas como opcionais', () => {
    expect(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E30' }).proximaOpcional).toBe(true);
    expect(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E33' }).proximaOpcional).toBe(true);
    expect(calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E32' }).proximaOpcional).toBe(false);
  });

  it('E35 = concluído, sem próxima', () => {
    const f = calcularFluxo({ ritoProcessual: 'pregao', etapaAtualId: 'E35' });
    expect(f.concluido).toBe(true);
    expect(f.proxima).toBeNull();
  });

  it('dias desde a última tramitação', () => {
    const f = calcularFluxo({ ultima_tramitacao: '2026-11-10T00:00:00Z' }, [], new Date('2026-11-19T00:00:00Z'));
    expect(f.diasDesdeUltimaTramitacao).toBe(9);
    expect(calcularFluxo({}).diasDesdeUltimaTramitacao).toBeNull();
    expect(calcularFluxo({ ultima_tramitacao: 'x' }).diasDesdeUltimaTramitacao).toBeNull();
  });

  it('percorre o fluxo inteiro do pregão até o arquivamento', () => {
    const p: ProcessoFluxo = respondido({ ritoProcessual: 'pregao' });
    const visitadas: string[] = [];
    let atual = 'E01';
    for (let i = 0; i < 60; i += 1) {
      visitadas.push(atual);
      const f = calcularFluxo({ ...p, etapaAtualId: atual, etapaOrigem: 'manual' });
      if (!f.proxima) break;
      atual = f.proxima.id;
    }
    expect(visitadas.at(-1)).toBe('E35');
    expect(visitadas).toContain('E18');
    expect(visitadas).not.toContain('E16');
  });
});
