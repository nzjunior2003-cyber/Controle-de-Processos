import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PCA, Processo } from '../../types';

const pca = (extra: Partial<PCA>): PCA => ({
  id: 'x',
  codigo_pca: '1',
  objeto_pca: 'Item',
  exercicio: 2026,
  unidade_responsavel: 'DAL',
  valor_previsto: 1000,
  item_pca: '',
  grupo_pca: 'G1',
  fonte_recurso: 'TESOURO',
  ...extra,
});

const pcas: PCA[] = [
  pca({ id: 'a', codigo_pca: '1', objeto_pca: 'Uniformes de gala', unidade_responsavel: 'DAL', numero_pae: 'E-2026/1111111', valor_previsto: 5000 }),
  pca({ id: 'b', codigo_pca: '2', objeto_pca: 'Caminhão tanque', unidade_responsavel: 'DTIC', numero_pae: '', prioridade: 'ALTA', valor_previsto: 90000 }),
  pca({ id: 'c', codigo_pca: '3', objeto_pca: 'Notebooks', unidade_responsavel: 'DTIC', numero_pae: 'E-2026/2222222', valor_previsto: 20000 }),
];
const processos = [
  { id: 'p1', numero_processo: '2026/1111111', status: 'em_andamento' },
  { id: 'p2', numero_processo: '2026/2222222', status: 'contratado_aditivado' },
] as Processo[];

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ pcas, processos }) }));
vi.mock('recharts', () => {
  const Vazio = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Bar: Vazio, BarChart: Vazio, CartesianGrid: Vazio, Cell: Vazio, LabelList: Vazio, Pie: Vazio, PieChart: Vazio, ResponsiveContainer: Vazio, Tooltip: Vazio, XAxis: Vazio, YAxis: Vazio };
});

import PainelPca from './PainelPca';

const renderizar = () => render(<MemoryRouter><PainelPca /></MemoryRouter>);

describe('PainelPca', () => {
  it('mostra os indicadores e todos os itens', () => {
    renderizar();
    expect(screen.getByText('Painel do PCA')).toBeTruthy();
    expect(screen.getByText('Uniformes de gala')).toBeTruthy();
    expect(screen.getByText('Caminhão tanque')).toBeTruthy();
    expect(screen.getByText('Notebooks')).toBeTruthy();
    expect(screen.getByText('3 item(ns) • página 1 de 1')).toBeTruthy();
  });

  it('o status vem do processo ligado pelo PAE (contratado / em andamento / aguardando)', () => {
    renderizar();
    expect(within(screen.getByText('Notebooks').closest('tr') as HTMLElement).getByText('Contratado')).toBeTruthy();
    expect(within(screen.getByText('Uniformes de gala').closest('tr') as HTMLElement).getByText('Em andamento')).toBeTruthy();
    expect(within(screen.getByText('Caminhão tanque').closest('tr') as HTMLElement).getByText('Aguardando instrução')).toBeTruthy();
  });

  it('o card "Sem PAE" filtra a lista e gera ponto de atenção de alta prioridade', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: /Insights/ }));
    expect(screen.getByText(/1 item de prioridade ALTA está sem PAE/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sem PAE/ }));
    expect(screen.getByText('Caminhão tanque')).toBeTruthy();
    expect(screen.queryByText('Notebooks')).toBeNull();
    expect(screen.getByText(/1 filtro\(s\) ativo\(s\) — 1 de 3 itens\./)).toBeTruthy();
    fireEvent.click(screen.getByText('Limpar filtros'));
    expect(screen.getByText('Notebooks')).toBeTruthy();
  });

  it('a busca filtra e a linha abre o detalhe com link para o processo', () => {
    renderizar();
    fireEvent.change(screen.getByLabelText('Buscar itens do PCA'), { target: { value: 'uniformes' } });
    expect(screen.queryByText('Notebooks')).toBeNull();
    fireEvent.click(screen.getByText('Uniformes de gala'));
    const detalhe = screen.getByLabelText('Detalhes do item do PCA');
    const link = within(detalhe).getByRole('link', { name: /abrir processo/ });
    expect(link.getAttribute('href')).toBe('/sistema/processos/p1');
  });
});
