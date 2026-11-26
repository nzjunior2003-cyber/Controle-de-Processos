/**
 * No celular as tabelas largas viram uma lista de cartões (cada linha um
 * cartão, cada célula "RÓTULO: valor") em vez de rolar para os lados. Aqui só
 * se prepara o terreno: marca cada tabela com `data-responsiva` e copia o texto
 * do cabeçalho para `data-rotulo` de cada célula; o visual está em index.css
 * (só abaixo de 1024 px e só na tela — impressão não muda).
 * Tabelas sem `<thead>` ou marcadas com `data-sem-cartoes` ficam como estão.
 */
export function prepararTabela(tabela: HTMLTableElement): void {
  if (tabela.hasAttribute('data-sem-cartoes')) return;
  const cabecalho = tabela.tHead?.rows[0];
  if (!cabecalho) return;

  const rotulos: string[] = [];
  Array.from(cabecalho.cells).forEach((celula) => {
    const texto = (celula.textContent ?? '').replace(/\s+/g, ' ').trim();
    for (let i = 0; i < Math.max(1, celula.colSpan); i += 1) rotulos.push(texto);
  });

  tabela.setAttribute('data-responsiva', '');
  Array.from(tabela.tBodies).forEach((corpo) => {
    Array.from(corpo.rows).forEach((linha) => {
      let coluna = 0;
      Array.from(linha.cells).forEach((celula) => {
        const rotulo = celula.colSpan > 1 ? '' : (rotulos[coluna] ?? '');
        if (celula.getAttribute('data-rotulo') !== rotulo) celula.setAttribute('data-rotulo', rotulo);
        coluna += Math.max(1, celula.colSpan);
      });
    });
  });
}

export function prepararTodas(raiz: ParentNode): void {
  raiz.querySelectorAll('table').forEach((t) => prepararTabela(t as HTMLTableElement));
}
