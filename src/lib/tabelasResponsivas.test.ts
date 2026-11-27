import { describe, expect, it } from 'vitest';
import { prepararTabela } from './tabelasResponsivas';

function montar(html: string): HTMLTableElement {
  document.body.innerHTML = html;
  return document.querySelector('table') as HTMLTableElement;
}

describe('tabelas responsivas', () => {
  it('marca a tabela e copia o cabeçalho para o rótulo de cada célula', () => {
    const t = montar('<table><thead><tr><th>PAE</th><th>Objeto</th></tr></thead><tbody><tr><td>1</td><td>x</td></tr></tbody></table>');
    prepararTabela(t);
    expect(t.hasAttribute('data-responsiva')).toBe(true);
    const tds = t.querySelectorAll('td');
    expect(tds[0].getAttribute('data-rotulo')).toBe('PAE');
    expect(tds[1].getAttribute('data-rotulo')).toBe('Objeto');
  });

  it('célula que ocupa várias colunas (linha expandida, "nenhum resultado") fica sem rótulo e não desalinha as demais', () => {
    const t = montar('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td colspan="2">Nenhum</td></tr><tr><td>1</td><td>2</td></tr></tbody></table>');
    prepararTabela(t);
    const tds = t.querySelectorAll('td');
    expect(tds[0].getAttribute('data-rotulo')).toBe('');
    expect(tds[1].getAttribute('data-rotulo')).toBe('A');
    expect(tds[2].getAttribute('data-rotulo')).toBe('B');
  });

  it('cabeçalho com colspan reparte o rótulo pelas colunas', () => {
    const t = montar('<table><thead><tr><th colspan="2">Dupla</th><th>Z</th></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>');
    prepararTabela(t);
    expect([...t.querySelectorAll('td')].map((c) => c.getAttribute('data-rotulo'))).toEqual(['Dupla', 'Dupla', 'Z']);
  });

  it('tabela sem <thead> ou marcada com data-sem-cartoes não é alterada', () => {
    const a = montar('<table><tbody><tr><td>1</td></tr></tbody></table>');
    prepararTabela(a);
    expect(a.hasAttribute('data-responsiva')).toBe(false);
    const b = montar('<table data-sem-cartoes><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>');
    prepararTabela(b);
    expect(b.hasAttribute('data-responsiva')).toBe(false);
  });

  it('reaplicar depois de a tabela mudar atualiza os rótulos das linhas novas', () => {
    const t = montar('<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>');
    prepararTabela(t);
    t.tBodies[0].insertAdjacentHTML('beforeend', '<tr><td>2</td></tr>');
    prepararTabela(t);
    expect(t.querySelectorAll('td')[1].getAttribute('data-rotulo')).toBe('A');
  });

  describe('classificação das células para o cartão', () => {
    const montarLinha = (cabecalho: string[], celulas: string[]) => {
      const t = montar(`<table><thead><tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody><tr>${celulas.map((c) => `<td>${c}</td>`).join('')}</tr></tbody></table>`);
      prepararTabela(t);
      return Array.from(t.querySelectorAll('td'));
    };

    it('a primeira célula com texto é o título; texto longo ocupa a linha toda; curto fica em meia linha', () => {
      const [a, b, c] = montarLinha(['PAE', 'Objeto', 'Valor'], ['2026/1', 'Aquisição de material de limpeza para as unidades', 'R$ 10,00']);
      expect(a.hasAttribute('data-primeira')).toBe(true);
      expect(b.getAttribute('data-largura')).toBe('total');
      expect(c.hasAttribute('data-largura')).toBe(false);
      expect(c.hasAttribute('data-primeira')).toBe(false);
    });

    it('célula só com ícones/botões sem texto vira "ações"; célula vazia é marcada para esconder', () => {
      const [, acoes, vazia] = montarLinha(['A', 'Ações', 'B'], ['x', '<button><svg></svg></button><a href="#"><svg></svg></a>', '']);
      expect(acoes.hasAttribute('data-acoes')).toBe(true);
      expect(acoes.hasAttribute('data-largura')).toBe(false);
      expect(vazia.hasAttribute('data-vazia')).toBe(true);
    });

    it('reaplicar não duplica nem perde marcas (estável para o MutationObserver)', () => {
      const t = montar('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>Um texto bem comprido para a linha</td></tr></tbody></table>');
      prepararTabela(t);
      const antes = t.innerHTML;
      prepararTabela(t);
      expect(t.innerHTML).toBe(antes);
    });
  });
});
