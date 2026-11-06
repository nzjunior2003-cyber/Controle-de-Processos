import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ID_PLANILHA_PROCESSOS, mapSheetRowToProcesso, type LinhaPlanilha } from '../../lib/csv';
import { diagnosticarProcessos, type Diagnostico } from '../../lib/diagnosticoProcessos';

const LIMITE_LISTA = 100;

const formatarData = (iso: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

/**
 * Master: compara os processos do sistema com a planilha de controle e mostra
 * duplicidades e registros sem linha na planilha. Só leitura — não altera nem
 * apaga nada.
 */
export default function DiagnosticoProcessos() {
  const navigate = useNavigate();
  const { usuarioAtual, processos } = useApp();
  const [resultado, setResultado] = useState<Diagnostico | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState('');

  if (usuarioAtual?.perfil !== 'master') {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar esta página.</div>;
  }

  const rodar = async () => {
    setRodando(true);
    setErro('');
    try {
      const url = `https://docs.google.com/spreadsheets/d/${ID_PLANILHA_PROCESSOS}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Processos 2026')}`;
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error('Não foi possível ler a planilha (ela precisa estar com acesso por link).');
      const csv = await resposta.text();
      const Papa = (await import('papaparse')).default;
      const linhas = await new Promise<LinhaPlanilha[]>((resolve) => {
        Papa.parse<LinhaPlanilha>(csv, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data) });
      });
      const validas = linhas.map((l) => mapSheetRowToProcesso(l)).filter((p): p is NonNullable<typeof p> => p !== null);
      setResultado(diagnosticarProcessos(processos, validas));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setRodando(false);
    }
  };

  const cartao = (rotulo: string, valor: number | string, destaque = false) => (
    <div className={`rounded-lg border p-4 ${destaque ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs font-medium text-gray-500 uppercase">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-800" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnóstico de processos</h1>
          <p className="text-sm text-gray-500">
            Compara os {processos.length} processos do sistema com a planilha. Só leitura: nada é alterado ou apagado.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={rodar}
        disabled={rodando}
        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400"
      >
        <Stethoscope className="h-4 w-4 mr-2" /> {rodando ? 'Comparando...' : 'Rodar diagnóstico'}
      </button>
      {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}

      {resultado && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cartao('No sistema', resultado.totalApp)}
            {cartao('Linhas na planilha', resultado.linhasPlanilha)}
            {cartao('Com linha na planilha', resultado.casados)}
            {cartao('Sem linha na planilha', resultado.orfaos.length, resultado.orfaos.length > 0)}
            {cartao('A mais por duplicidade', resultado.excedenteDuplicado, resultado.excedenteDuplicado > 0)}
          </div>

          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-base font-medium text-gray-900">Registros criados por dia</h2>
            <p className="text-xs text-gray-500 mb-2">Muitos registros no mesmo dia indicam uma sincronização repetida.</p>
            <div className="flex flex-wrap gap-2">
              {[...resultado.porDia]
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 12)
                .map((d) => (
                  <span key={d.dia} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                    {d.dia}: <strong>{d.quantidade}</strong>
                  </span>
                ))}
            </div>
          </section>

          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-base font-medium text-gray-900">
              PAEs com mais de um registro ({resultado.duplicados.length})
            </h2>
            {resultado.duplicados.length === 0 && <p className="mt-2 text-sm text-gray-500">Nenhuma duplicidade.</p>}
            <div className="mt-2 space-y-3">
              {resultado.duplicados.slice(0, LIMITE_LISTA).map((g) => (
                <div key={g.chave} className="border border-gray-200 rounded-md">
                  <p className="px-3 py-1.5 text-sm font-medium bg-gray-50 text-gray-800">
                    {g.chave} — {g.docs.length} registros
                  </p>
                  <ul className="divide-y divide-gray-100">
                    {g.docs.map((d) => (
                      <li key={d.id} className="px-3 py-1.5 text-xs text-gray-600 flex flex-wrap gap-x-4">
                        <Link to={`/sistema/processos/${d.id}`} className="text-red-700 hover:underline">abrir</Link>
                        <span>criado {formatarData(d.criado_em)}</span>
                        <span>ordem {d.ordem ?? '—'}</span>
                        <span>{d.motivos.length ? d.motivos.join(', ') : 'sem dados próprios'}</span>
                        {d.id === g.manter && <strong className="text-emerald-700">sugerido para ficar</strong>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {resultado.duplicados.length > LIMITE_LISTA && (
                <p className="text-xs text-gray-500">Mostrando os {LIMITE_LISTA} primeiros de {resultado.duplicados.length}.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-base font-medium text-gray-900">Sem linha na planilha ({resultado.orfaos.length})</h2>
            <p className="text-xs text-gray-500 mb-2">Linha removida, movida para outra aba ou com o PAE trocado na planilha.</p>
            {resultado.orfaos.length === 0 && <p className="text-sm text-gray-500">Nenhum.</p>}
            <ul className="divide-y divide-gray-100">
              {resultado.orfaos.slice(0, LIMITE_LISTA).map((d) => (
                <li key={d.id} className="py-1.5 text-xs text-gray-600 flex flex-wrap gap-x-4">
                  <Link to={`/sistema/processos/${d.id}`} className="text-red-700 hover:underline">abrir</Link>
                  <strong className="text-gray-900">{d.numero_processo}</strong>
                  <span>criado {formatarData(d.criado_em)}</span>
                  <span className="truncate max-w-md">{d.objeto}</span>
                  <span>{d.motivos.length ? d.motivos.join(', ') : 'sem dados próprios'}</span>
                </li>
              ))}
            </ul>
            {resultado.orfaos.length > LIMITE_LISTA && (
              <p className="mt-2 text-xs text-gray-500">Mostrando os {LIMITE_LISTA} primeiros de {resultado.orfaos.length}.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
