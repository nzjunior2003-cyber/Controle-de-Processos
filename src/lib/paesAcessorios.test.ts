import { describe, expect, it } from 'vitest';
import {
  adicionarPaeAcessorio,
  chavePae,
  ehSolicitacaoOutroOrgao,
  montarItensRastreio,
  normalizarPae,
  parseAbaPaesAcessorios,
  removerPaeAcessorio,
} from './paesAcessorios';

const agora = new Date('2026-11-06T12:00:00Z');

describe('normalizarPae / chavePae', () => {
  it('aceita E-, hífen e espaços', () => {
    expect(normalizarPae('e-2026-2617141')).toBe('E-2026/2617141');
    expect(normalizarPae(' 2026 / 55 ')).toBe('E-2026/55');
    expect(normalizarPae('abc')).toBe('');
    expect(chavePae('E-2026/2617141')).toBe(chavePae('2026-2617141'));
  });
});

describe('adicionarPaeAcessorio', () => {
  it('acrescenta com número normalizado e finalidade livre', () => {
    const r = adicionarPaeAcessorio([], { numero: '2026/10', finalidade: ' Parecer da PGE ', observacao: ' ' }, agora);
    expect(r.erro).toBeUndefined();
    expect(r.lista).toHaveLength(1);
    expect(r.lista[0]).toMatchObject({ numero: 'E-2026/10', finalidade: 'Parecer da PGE' });
    expect(r.lista[0].observacao).toBeUndefined();
  });
  it('recusa número inválido, finalidade vazia e repetido', () => {
    expect(adicionarPaeAcessorio([], { numero: 'x', finalidade: 'a' }, agora).erro).toMatch(/formato/);
    expect(adicionarPaeAcessorio([], { numero: '2026/1', finalidade: ' ' }, agora).erro).toMatch(/finalidade/);
    const { lista } = adicionarPaeAcessorio([], { numero: '2026/1', finalidade: 'Fatura' }, agora);
    expect(adicionarPaeAcessorio(lista, { numero: 'E-2026-1', finalidade: 'Pagamento' }, agora).erro).toMatch(/já está/);
    expect(adicionarPaeAcessorio([], { numero: '2026/1', finalidade: 'Fatura' }, agora, ['E-2026/1']).erro).toMatch(/já está/);
  });
  it('remove pelo id', () => {
    const { lista } = adicionarPaeAcessorio([], { numero: '2026/1', finalidade: 'Fatura' }, agora);
    expect(removerPaeAcessorio(lista, lista[0].id)).toEqual([]);
  });
});

describe('montarItensRastreio', () => {
  it('junta processos e contratos, sem repetir o PAE, e marca o que vai no relatório', () => {
    const itens = montarItensRastreio(
      [{ numero_processo: 'E-2026/1', paes_acessorios: [{ id: 'a', numero: 'E-2026/10', finalidade: 'Solicitação de análise a outro órgão', criado_em: '' }] }],
      [{ numero: '12/2026', paes_acessorios: [
        { id: 'b', numero: 'E-2026/20', finalidade: 'Fatura', criado_em: '' },
        { id: 'c', numero: 'E-2026/10', finalidade: 'Pagamento', criado_em: '' },
      ] }],
    );
    expect(itens).toEqual([
      { pae: 'E-2026/10', escopo: 'processo', referencia: 'E-2026/1', finalidade: 'Solicitação de análise a outro órgão', relatorio: true },
      { pae: 'E-2026/20', escopo: 'contrato', referencia: '12/2026', finalidade: 'Fatura', relatorio: false },
    ]);
    expect(ehSolicitacaoOutroOrgao('solicitação de analise a outro orgao')).toBe(true);
  });
});

describe('parseAbaPaesAcessorios', () => {
  const cab = ['pae', 'escopo', 'referencia', 'finalidade', 'relatorio', 'setor_atual', 'ultima_tramitacao', 'situacao', 'consultado_em'];
  it('lê a situação por PAE', () => {
    const m = parseAbaPaesAcessorios([cab, ['E-2026/10', 'processo', 'E-2026/1', 'x', 'SIM', 'PGE', '05/11/2026', 'SUCESSO', '06/11/2026 08:00:00']]);
    expect(m.get(chavePae('2026/10'))).toEqual({ setorAtual: 'PGE', ultimaTramitacao: '05/11/2026', situacao: 'SUCESSO', consultadoEm: '06/11/2026 08:00:00' });
  });
  it('ignora aba com outro cabeçalho', () => {
    expect(parseAbaPaesAcessorios([['ordem', 'pae'], ['1', '2026/1']]).size).toBe(0);
    expect(parseAbaPaesAcessorios([]).size).toBe(0);
  });
});
