import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrazosFluxo from './PrazosFluxo';

const salvarConfigPrazos = vi.fn().mockResolvedValue(undefined);
let perfil = 'dal';

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ usuarioAtual: { id: 'u1', perfil }, configPrazos: undefined, salvarConfigPrazos, usuarios: [] }),
}));

afterEach(() => { cleanup(); salvarConfigPrazos.mockClear(); });

const montar = () => render(<MemoryRouter><PrazosFluxo /></MemoryRouter>);

describe('PrazosFluxo', () => {
  it('DAL vê a tela e só grava o que mudou em relação ao padrão', async () => {
    perfil = 'dal';
    montar();
    fireEvent.change(screen.getByLabelText('Dias da etapa E07'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Prazo total do rito Pregão Eletrônico'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Salvar prazos'));
    await waitFor(() => expect(salvarConfigPrazos).toHaveBeenCalledTimes(1));
    expect(salvarConfigPrazos).toHaveBeenCalledWith({ diasPorEtapa: { E07: 30 }, prazoAteContratoPorRito: { pregao: 100 } });
  });

  it('Master também edita', () => {
    perfil = 'master';
    montar();
    expect(screen.getByText('Prazos do fluxo de compras')).toBeTruthy();
  });

  it('outros perfis veem apenas o aviso de permissão', () => {
    for (const p of ['apoio', 'contratos', 'fiscal', 'dga']) {
      cleanup();
      perfil = p;
      montar();
      expect(screen.getByText('Você não tem permissão para acessar esta página.')).toBeTruthy();
      expect(screen.queryByText('Salvar prazos')).toBeNull();
    }
  });
});
