import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CartaoFluxoCompras from './CartaoFluxoCompras';

afterEach(cleanup);

const base = { id: 'p1' } as const;

function montar(processo: Record<string, unknown>, opcoes: { podeEditar?: boolean; onSalvar?: ReturnType<typeof vi.fn> } = {}) {
  const onSalvar = opcoes.onSalvar ?? vi.fn().mockResolvedValue(undefined);
  render(
    <CartaoFluxoCompras
      processo={{ ...base, ...processo }}
      tramitacoes={[]}
      podeEditar={opcoes.podeEditar ?? true}
      usuarioId="u1"
      nomeConfirmador="Maria"
      onSalvar={onSalvar}
    />,
  );
  return onSalvar;
}

describe('CartaoFluxoCompras', () => {
  it('processo sem rito: próximo passo é definir o rito, com seletor', () => {
    montar({});
    expect(screen.getByText('Definir o rito processual')).toBeTruthy();
    expect(screen.getByText('Definir o rito processual:')).toBeTruthy();
  });

  it('escolher o rito grava ritoProcessual e o nome antigo equivalente', async () => {
    const onSalvar = montar({});
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pregao' } });
    await waitFor(() => expect(onSalvar).toHaveBeenCalledWith({ ritoProcessual: 'pregao', rito_processual: 'Pregão Eletrônico' }));
  });

  it('etapa sugerida: mostra o selo e "Confirmar etapa atual" grava como automática', async () => {
    const onSalvar = montar({ ritoProcessual: 'pregao' });
    expect(screen.getByText('Sugerida pelo sistema')).toBeTruthy();
    fireEvent.click(screen.getByText('Confirmar etapa atual'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ etapaAtualId: 'E07', etapaOrigem: 'auto', etapaConfirmadaPor: 'u1' });
  });

  it('lista os itens que faltam na E07', () => {
    montar({ ritoProcessual: 'gerenciador_ata', checklist_rito: ['Juntar demanda ao PAE original'] });
    expect(screen.getByText('Mapa de Demanda')).toBeTruthy();
  });

  it('etapa confirmada: mostra quem confirmou e permite avançar (manual)', async () => {
    const onSalvar = montar({
      ritoProcessual: 'pregao', etapaAtualId: 'E14', etapaOrigem: 'manual', etapaConfirmadaPor: 'u2',
      etapaConfirmadaEm: '2026-11-20T12:00:00Z', cbmGerenciadorOuParticipeArp: false,
    });
    expect(screen.getByText(/Confirmada por Maria em/)).toBeTruthy();
    fireEvent.click(screen.getByText('Avançar para a próxima etapa'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ etapaAtualId: 'E15', etapaOrigem: 'manual' });
  });

  it('pergunta pendente aparece e a resposta grava só o campo da decisão', async () => {
    const onSalvar = montar({ ritoProcessual: 'pregao', etapaAtualId: 'E08', etapaOrigem: 'manual' });
    expect(screen.getByText('É necessário dotação orçamentária?')).toBeTruthy();
    fireEvent.click(screen.getByText('Sim'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalledWith({ necessitaDotacao: true }));
  });

  it('corrigir a etapa grava a escolhida como manual', async () => {
    const onSalvar = montar({ ritoProcessual: 'pregao' });
    fireEvent.click(screen.getByText('Corrigir etapa'));
    fireEvent.change(screen.getByLabelText('Etapa correta'), { target: { value: 'E12' } });
    fireEvent.click(screen.getByText('Salvar etapa'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ etapaAtualId: 'E12', etapaOrigem: 'manual' });
  });

  it('quem não pode editar vê o cartão, mas sem nenhum botão de ação', () => {
    montar({ ritoProcessual: 'pregao', etapaAtualId: 'E08' }, { podeEditar: false });
    expect(screen.getByText('É necessário dotação orçamentária?')).toBeTruthy();
    expect(screen.queryByText('Sim')).toBeNull();
    expect(screen.queryByText('Corrigir etapa')).toBeNull();
    expect(screen.queryByText('Confirmar etapa atual')).toBeNull();
  });

  it('rito fora do fluxo mostra o aviso', () => {
    montar({ rito_processual: 'Prorrogação de contrato' });
    expect(screen.getByText('Este tipo de processo não segue o fluxo de compras.')).toBeTruthy();
  });

  it('avisa quando a sugestão automática é outra etapa', () => {
    montar({
      ritoProcessual: 'pregao', etapaAtualId: 'E11', etapaOrigem: 'manual', localizacao_atual: 'CBM > CONJUR',
      necessitaDotacao: false, cbmGerenciadorOuParticipeArp: false,
      checklist_rito: ['Estudo Técnico Preliminar', 'Análise de Risco', 'Termo de Referência', 'SIMAS', 'Orçamento Estimado/Pesquisa de preços'],
    });
    expect(screen.getByText(/Atualizar para E14/)).toBeTruthy();
  });

  it('mostra etapas restantes, porcentagem, previsão, prazo e situação por marco', () => {
    montar({
      ritoProcessual: 'pregao', data_entrada: '2026-01-01T00:00:00Z', etapaAtualId: 'E07', etapaOrigem: 'manual',
      etapaConfirmadaEm: '2020-01-01T00:00:00Z', necessitaDotacao: false, cbmGerenciadorOuParticipeArp: false,
      parecerJuridicoAprovadoSemRecomendacoes: true, haveraFaseExterna: false,
    });
    expect(screen.getByText('Contrato')).toBeTruthy();
    expect(screen.getByText(/faltam 9 de 15 etapas · 40%/)).toBeTruthy();
    expect(screen.getByText('Pagamento')).toBeTruthy();
    expect(screen.getAllByText(/Atrasado há/).length).toBeGreaterThan(0);
    expect(screen.getByText(/prazo até a contratação: 120 dias/)).toBeTruthy();
  });

  it('decisão em aberto mostra a contagem como estimativa (faixa)', () => {
    montar({ ritoProcessual: 'pregao', data_entrada: '2026-01-01T00:00:00Z', etapaAtualId: 'E07', etapaOrigem: 'manual' });
    expect(screen.getAllByText(/\(estimativa\)/).length).toBeGreaterThan(0);
  });

  it('sem rito não mostra a seção de prazos', () => {
    montar({});
    expect(screen.queryByText('Contrato')).toBeNull();
  });

  it('mostra a linha do tempo das etapas percorridas, com dias e a etapa em andamento', () => {
    montar({
      ritoProcessual: 'pregao', etapaAtualId: 'E08', etapaOrigem: 'manual', etapaConfirmadaPor: 'u1', etapaConfirmadaEm: '2026-11-16T12:00:00Z',
      historicoEtapas: [
        { etapaId: 'E07', inicio: '2026-11-01T12:00:00Z', fim: '2026-11-16T12:00:00Z' },
        { etapaId: 'E08', inicio: '2026-11-16T12:00:00Z' },
      ],
    });
    expect(screen.getByText('Por onde o processo passou')).toBeTruthy();
    expect(screen.getByText(/15 dia\(s\)/)).toBeTruthy();
    expect(screen.getByText(/\(em andamento\)/)).toBeTruthy();
  });

  it('avançar grava a data de chegada informada e fecha a etapa anterior', async () => {
    const onSalvar = montar({
      ritoProcessual: 'pregao', cbmGerenciadorOuParticipeArp: false, etapaAtualId: 'E14', etapaOrigem: 'manual',
      etapaConfirmadaPor: 'u2', etapaConfirmadaEm: '2026-01-10T12:00:00Z',
    });
    fireEvent.change(screen.getByLabelText('Data de chegada na etapa'), { target: { value: '2026-02-01' } });
    fireEvent.click(screen.getByText('Avançar para a próxima etapa'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    const campos = onSalvar.mock.calls[0][0];
    expect(campos.etapaAtualId).toBe('E15');
    expect(campos.historicoEtapas).toHaveLength(2);
    expect(campos.historicoEtapas[0]).toMatchObject({ etapaId: 'E14' });
    expect(campos.historicoEtapas[0].fim).toContain('2026-02-01');
    expect(campos.historicoEtapas[1].inicio).toContain('2026-02-01');
  });

  it('data de chegada futura é recusada com aviso e nada é gravado', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const onSalvar = montar({ ritoProcessual: 'pregao' });
    fireEvent.change(screen.getByLabelText('Data de chegada na etapa'), { target: { value: '2999-01-01' } });
    fireEvent.click(screen.getByText('Confirmar etapa atual'));
    await waitFor(() => expect(alerta).toHaveBeenCalled());
    expect(onSalvar).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it('corrigir a etapa substitui a passagem em andamento', async () => {
    const onSalvar = montar({
      ritoProcessual: 'pregao', etapaAtualId: 'E07', etapaOrigem: 'auto', etapaConfirmadaPor: 'u2', etapaConfirmadaEm: '2026-01-10T12:00:00Z',
    });
    fireEvent.click(screen.getByText('Corrigir etapa'));
    fireEvent.change(screen.getByLabelText('Etapa correta'), { target: { value: 'E12' } });
    fireEvent.click(screen.getByText('Salvar etapa'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0].historicoEtapas.map((p: { etapaId: string }) => p.etapaId)).toEqual(['E12']);
  });

  it('quem não pode editar vê a linha do tempo, mas não o campo de data', () => {
    montar({
      ritoProcessual: 'pregao', etapaAtualId: 'E07', etapaConfirmadaPor: 'u2', etapaConfirmadaEm: '2026-01-10T12:00:00Z',
    }, { podeEditar: false });
    expect(screen.getByText('Por onde o processo passou')).toBeTruthy();
    expect(screen.queryByLabelText('Data de chegada na etapa')).toBeNull();
  });
});
