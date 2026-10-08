import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Processo } from '../../types';

const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const proc = (extra: Partial<Processo>): Processo =>
  ({
    id: 'x',
    numero_processo: '2026/0',
    objeto: 'Objeto',
    unidade_demandante: 'DAL',
    status: 'em_andamento',
    fase_atual_id: '1',
    possui_alerta: false,
    data_abertura: dias(60),
    data_entrada: dias(60),
    ultima_tramitacao: dias(3),
    localizacao_atual: 'CBM > DAL-OBRAS > Quartel',
    criado_em: '',
    atualizado_em: '',
    ...extra,
  }) as Processo;

const processos: Processo[] = [
  proc({ id: 'a', numero_processo: '2026/111', objeto: 'Uniformes de gala', ultima_tramitacao: dias(45), valor_estimado: 10000 }),
  proc({ id: 'b', numero_processo: '2026/222', objeto: 'Reforma do quartel', status: 'contratado_aditivado' }),
  proc({ id: 'c', numero_processo: '2026/333', objeto: 'Internet', andamento: 'ARQUIVADO' }),
];

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ processos }) }));
vi.mock('../../hooks/useEtapasPorRito', () => ({ useEtapasPorRito: () => ({}) }));
// Recharts depende de medidas de layout que o jsdom não tem.
vi.mock('recharts', () => {
  const Vazio = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Bar: Vazio,
    BarChart: Vazio,
    CartesianGrid: Vazio,
    Cell: Vazio,
    LabelList: Vazio,
    Pie: Vazio,
    PieChart: Vazio,
    ResponsiveContainer: Vazio,
    Tooltip: Vazio,
    XAxis: Vazio,
    YAxis: Vazio,
  };
});

import PainelProcessos from './PainelProcessos';

const renderizar = () =>
  render(
    <MemoryRouter>
      <PainelProcessos />
    </MemoryRouter>,
  );

describe('PainelProcessos', () => {
  it('mostra os indicadores e a lista com todos os processos', () => {
    renderizar();
    expect(screen.getByText('Painel de Processos')).toBeTruthy();
    expect(screen.getByText('3 no total')).toBeTruthy();
    expect(screen.getByText('2026/111')).toBeTruthy();
    expect(screen.getByText('2026/222')).toBeTruthy();
    expect(screen.getByText('2026/333')).toBeTruthy();
    expect(screen.getByText('3 processo(s) • página 1 de 1')).toBeTruthy();
  });

  it('o processo parado há mais de 30 dias aparece como atrasado e gera ponto de atenção', () => {
    renderizar();
    const linha = screen.getByText('2026/111').closest('tr') as HTMLElement;
    expect(within(linha).getByText('Atrasado (+30d)')).toBeTruthy();
    expect(screen.getByText(/Processo parado há mais tempo: 2026\/111/)).toBeTruthy();
  });

  it('a busca filtra a lista', () => {
    renderizar();
    fireEvent.change(screen.getByLabelText('Buscar processos'), { target: { value: 'reforma' } });
    expect(screen.getByText('2026/222')).toBeTruthy();
    expect(screen.queryByText('2026/111')).toBeNull();
    expect(screen.getByText('1 processo(s) • página 1 de 1')).toBeTruthy();
  });

  it('o card Contratado/Aditivado filtra a lista e pode ser desligado', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: /Contratado\/Aditivado/ }));
    expect(screen.queryByText('2026/111')).toBeNull();
    expect(screen.getByText('2026/222')).toBeTruthy();
    fireEvent.click(screen.getByText('Remover filtro'));
    expect(screen.getByText('2026/111')).toBeTruthy();
  });

  it('clicar numa linha abre o detalhe com link para o processo', () => {
    renderizar();
    fireEvent.click(screen.getByText('2026/111'));
    const detalhe = screen.getByLabelText('Detalhes do processo');
    expect(within(detalhe).getByText('Uniformes de gala')).toBeTruthy();
    const link = within(detalhe).getByRole('link', { name: /Abrir o processo no sistema/ });
    expect(link.getAttribute('href')).toBe('/sistema/processos/a');
    fireEvent.click(within(detalhe).getByLabelText('Fechar'));
    expect(screen.queryByLabelText('Detalhes do processo')).toBeNull();
  });
});
