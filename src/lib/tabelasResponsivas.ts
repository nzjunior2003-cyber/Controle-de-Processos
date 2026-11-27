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
      let primeiraComTexto = true;
      Array.from(linha.cells).forEach((celula) => {
        const rotulo = celula.colSpan > 1 ? '' : (rotulos[coluna] ?? '');
        definir(celula, 'data-rotulo', rotulo);
        coluna += Math.max(1, celula.colSpan);

        const texto = (celula.textContent ?? '').replace(/\s+/g, ' ').trim();
        const temAcao = !!celula.querySelector('button, a, input, select, textarea');
        const vazia = !texto && !temAcao && !celula.querySelector('svg, img');
        const soAcoes = !texto && temAcao;
        // Larga (linha inteira): texto longo, vários blocos ou controles; curta: cabe em meia linha.
        const larga = celula.colSpan > 1 || texto.length > 24 || (temAcao && !!texto) || celula.children.length > 2;
        definir(celula, 'data-vazia', vazia ? '' : null);
        definir(celula, 'data-acoes', soAcoes ? '' : null);
        definir(celula, 'data-largura', larga && !vazia && !soAcoes ? 'total' : null);
        // A primeira célula com conteúdo é o "título" do cartão (identificação do item).
        const titulo = primeiraComTexto && !!texto && celula.colSpan === 1;
        if (titulo) primeiraComTexto = false;
        definir(celula, 'data-primeira', titulo ? '' : null);
      });
    });
  });
}

/** Só mexe no DOM quando o valor muda (evita laço com o MutationObserver). */
function definir(el: Element, nome: string, valor: string | null): void {
  if (valor === null) {
    if (el.hasAttribute(nome)) el.removeAttribute(nome);
  } else if (el.getAttribute(nome) !== valor) {
    el.setAttribute(nome, valor);
  }
}

export function prepararTodas(raiz: ParentNode): void {
  raiz.querySelectorAll('table').forEach((t) => prepararTabela(t as HTMLTableElement));
}
