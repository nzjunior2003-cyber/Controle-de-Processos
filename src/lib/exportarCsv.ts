/**
 * Exportação de dados em CSV (art. 6.8 da PIDS/DTIC) — formato aberto e
 * interoperável, respeitando sempre o conjunto de dados já filtrado na tela
 * (não a base inteira), como a política recomenda.
 */
export function exportarCsv(nomeArquivo: string, colunas: string[], linhas: (string | number)[][]): void {
  const escapar = (valor: string | number): string => {
    const texto = String(valor ?? '');
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const conteudo = [colunas, ...linhas]
    .map((linha) => linha.map(escapar).join(';'))
    .join('\r\n');

  // BOM UTF-8 pra abrir com acentuação correta no Excel.
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
