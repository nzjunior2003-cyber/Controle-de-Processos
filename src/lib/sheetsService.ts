/**
 * Escrita/leitura na planilha de controle de processos via API do Google
 * Sheets, usando o access token OAuth do usuário (mesmo fluxo já usado
 * para o Google Drive, em googleAuth.ts) — precisa que a conta
 * autenticada tenha permissão de edição na planilha.
 */
import {
  acharLinhaParaProcesso,
  aplicarColunasNaLinha,
  COLUNA,
  montarValoresColunasProcesso,
  proximoNumeroSequencial,
  type DadosProcessoParaPlanilha,
} from './planilhaProcessos';

async function chamarSheetsApi(
  accessToken: string,
  spreadsheetId: string,
  metodo: 'GET' | 'PUT',
  range: string,
  corpo?: object,
): Promise<Record<string, unknown>> {
  const query = metodo === 'PUT' ? '?valueInputOption=USER_ENTERED' : '';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}${query}`;

  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(
      dados?.error?.message || 'Não foi possível acessar a planilha (verifique a permissão de edição).',
    );
  }
  return dados ?? {};
}

/** Lê os valores de um intervalo (ex.: "A:B") da primeira aba da planilha. */
async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const dados = await chamarSheetsApi(accessToken, spreadsheetId, 'GET', range);
  return (dados.values as string[][] | undefined) ?? [];
}

/** Sobrescreve uma linha inteira (1-based) com os valores informados. */
async function updateSheetRow(
  accessToken: string,
  spreadsheetId: string,
  linha: number,
  valores: string[],
): Promise<void> {
  await chamarSheetsApi(accessToken, spreadsheetId, 'PUT', `A${linha}:Z${linha}`, {
    values: [valores],
  });
}

/**
 * Cria ou atualiza a linha de um processo na planilha de controle:
 *
 * - Processo novo: acha a primeira linha em branco na coluna do N° PAE
 *   e preenche o número sequencial da coluna "Ordem" se ela estiver vazia.
 * - Processo já existente: acha a linha pelo N° PAE (usando `linhaConhecida`
 *   como atalho quando já sabida, sem precisar buscar de novo) e
 *   sobrescreve só as colunas que o app gerencia — o resto da linha
 *   (Setor Atual, Última Tramitação, valores homologados etc.) é
 *   preservado como estava.
 *
 * Devolve o número da linha usada, para guardar em `planilha_linha` e
 * agilizar a próxima atualização.
 */
export async function sincronizarProcessoNaPlanilha(
  accessToken: string,
  spreadsheetId: string,
  dados: DadosProcessoParaPlanilha,
  linhaConhecida?: number,
): Promise<number> {
  const numeroComPrefixo = /^E-/i.test(dados.numero_processo)
    ? dados.numero_processo
    : `E-${dados.numero_processo}`;

  let linha: number;
  let ehNova: boolean;

  if (linhaConhecida) {
    const [linhaAtual] = await getSheetValues(accessToken, spreadsheetId, `B${linhaConhecida}:B${linhaConhecida}`);
    if ((linhaAtual?.[0] ?? '').trim() === numeroComPrefixo) {
      linha = linhaConhecida;
      ehNova = false;
    } else {
      // A linha guardada não bate mais (planilha reorganizada) — busca de novo.
      const colunaPae = (await getSheetValues(accessToken, spreadsheetId, 'B:B')).map((l) => l[0] ?? '');
      ({ linha, ehNova } = acharLinhaParaProcesso(colunaPae, numeroComPrefixo));
    }
  } else {
    const colunaPae = (await getSheetValues(accessToken, spreadsheetId, 'B:B')).map((l) => l[0] ?? '');
    ({ linha, ehNova } = acharLinhaParaProcesso(colunaPae, numeroComPrefixo));
  }

  const linhaExistente = ehNova
    ? undefined
    : (await getSheetValues(accessToken, spreadsheetId, `A${linha}:Z${linha}`))[0];

  const valoresColunas = montarValoresColunasProcesso(dados);

  if (ehNova && !(linhaExistente?.[COLUNA.ORDEM] ?? '').trim()) {
    const [linhaAnterior] = await getSheetValues(accessToken, spreadsheetId, `A${linha - 1}:A${linha - 1}`);
    valoresColunas[COLUNA.ORDEM] = proximoNumeroSequencial(linhaAnterior?.[0]);
  }

  const linhaFinal = aplicarColunasNaLinha(linhaExistente, valoresColunas);
  await updateSheetRow(accessToken, spreadsheetId, linha, linhaFinal);

  return linha;
}
