import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const estadoApp = {
  isAuthenticated: false,
  carregandoAuth: false,
};

// Evita carregar o AppContext real (que inicializa o Firebase) no teste.
vi.mock('../context/AppContext', () => ({
  useApp: () => estadoApp,
}));

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/sistema']}>
      <Routes>
        <Route path="/" element={<div>Página pública</div>} />
        <Route path="/sistema" element={<ProtectedRoute />}>
          <Route index element={<div>Área restrita</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    estadoApp.isAuthenticated = false;
    estadoApp.carregandoAuth = false;
  });

  it('redireciona para a home pública quando não autenticado', () => {
    renderizar();
    expect(screen.queryByText('Área restrita')).toBeNull();
    expect(screen.getByText('Página pública')).toBeTruthy();
  });

  it('libera a rota filha quando autenticado', () => {
    estadoApp.isAuthenticated = true;
    renderizar();
    expect(screen.getByText('Área restrita')).toBeTruthy();
  });

  it('mostra o carregamento enquanto a sessão é resolvida, sem redirecionar', () => {
    estadoApp.carregandoAuth = true;
    renderizar();
    expect(screen.getByText('Carregando...')).toBeTruthy();
    expect(screen.queryByText('Página pública')).toBeNull();
  });
});
