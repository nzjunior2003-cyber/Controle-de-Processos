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
});
