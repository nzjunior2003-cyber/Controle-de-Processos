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
});
