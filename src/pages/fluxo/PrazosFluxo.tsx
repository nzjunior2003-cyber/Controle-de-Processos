import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DIAS_PADRAO_ETAPA, ETAPAS, ETAPA_FIM_PRAZO_RITO, MARCOS, ROTULO_RITO, type RitoCompras } from '../../config/fluxoCompras';
import { prazoTotalDoRito } from '../../lib/prazosFluxo';

const ETAPAS_RITO = ETAPAS.filter((_, i) => i <= ETAPAS.findIndex((e) => e.id === ETAPA_FIM_PRAZO_RITO)).map((e) => e.id);

/**
 * DAL e Master: definem os prazos do fluxo de compras (dias de cada etapa e prazo
 * total de cada rito até a contratação). O que não for alterado aqui continua
 * com os valores provisórios do sistema. Dias corridos.
 */
export default function PrazosFluxo() {
  const navigate = useNavigate();
  const { usuarioAtual, configPrazos, salvarConfigPrazos, usuarios } = useApp();
  const podeEditar = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'dal';

  const [dias, setDias] = useState<Record<string, string>>(() =>
    Object.fromEntries(ETAPAS.map((e) => [e.id, String(configPrazos?.diasPorEtapa?.[e.id] ?? DIAS_PADRAO_ETAPA[e.id])])),
  );
  const [ritos, setRitos] = useState<Record<string, string>>(() =>
    Object.fromEntries((Object.keys(ROTULO_RITO) as RitoCompras[]).map((r) => [r, configPrazos?.prazoAteContratoPorRito?.[r] != null ? String(configPrazos.prazoAteContratoPorRito[r]) : ''])),
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Se os prazos salvos chegarem (ou mudarem) depois da tela abrir, recarrega os campos.
  useEffect(() => {
    setDias(Object.fromEntries(ETAPAS.map((e) => [e.id, String(configPrazos?.diasPorEtapa?.[e.id] ?? DIAS_PADRAO_ETAPA[e.id])])));
    setRitos(Object.fromEntries((Object.keys(ROTULO_RITO) as RitoCompras[]).map((r) => [r, configPrazos?.prazoAteContratoPorRito?.[r] != null ? String(configPrazos.prazoAteContratoPorRito[r]) : ''])));
  }, [configPrazos]);

  const padraoRito = useMemo(
    () => Object.fromEntries((Object.keys(ROTULO_RITO) as RitoCompras[]).map((r) => [r, prazoTotalDoRito({ ritoProcessual: r })])),
    [],
  );

  if (!usuarioAtual || !podeEditar) {
    return <div className="p-8 text-center text-gray-500">Você não tem permissão para acessar esta página.</div>;
  }

  const salvar = async () => {
    setSalvando(true);
    setMensagem('');
    try {
      // Só grava o que difere do padrão — apagar o valor volta ao padrão.
      const diasPorEtapa = Object.fromEntries(
        ETAPAS.filter((e) => dias[e.id] !== '' && Number(dias[e.id]) !== DIAS_PADRAO_ETAPA[e.id]).map((e) => [e.id, Number(dias[e.id])]),
      );
      const prazoAteContratoPorRito = Object.fromEntries(
        Object.entries(ritos).filter(([, v]) => v !== '' && Number(v) > 0).map(([k, v]) => [k, Number(v)]),
      );
      await salvarConfigPrazos({ diasPorEtapa, prazoAteContratoPorRito });
      setMensagem('Prazos salvos.');
    } catch (erro) {
      setMensagem('Não foi possível salvar: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const editor = (valor: string, aoMudar: (v: string) => void, rotulo: string) => (
    <input
      type="number" min={0} max={365} value={valor} aria-label={rotulo}
      onChange={(e) => aoMudar(e.target.value)}
      className="w-24 rounded-md border-gray-300 text-sm text-right"
    />
  );

  const quem = (configPrazos as { atualizado_por?: string; atualizado_em?: string } | undefined);
  const nomeQuem = usuarios.find((u) => u.id === quem?.atualizado_por)?.nome;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prazos do fluxo de compras</h1>
          <p className="mt-1 text-sm text-gray-500">
            Valores <strong>provisórios</strong> até o DAL/Master definirem os oficiais. Dias corridos.
            {quem?.atualizado_em && ` Última alteração: ${format(new Date(quem.atualizado_em), 'dd/MM/yyyy')}${nomeQuem ? ` por ${nomeQuem}` : ''}.`}
          </p>
        </div>
      </div>

      <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Prazo total até a contratação, por rito</h2>
        <p className="text-sm text-gray-500">
          Dias da abertura do processo até a etapa “Realizar contratação”. Deixe em branco para usar o prazo atual do sistema
          (aparece cinza). Esse total é repartido entre as etapas E01–E19 de cada processo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(ROTULO_RITO) as RitoCompras[]).map((r) => (
            <label key={r} className="flex items-center justify-between gap-3 text-sm text-gray-800">
              <span>{ROTULO_RITO[r]}</span>
              {editor(ritos[r], (v) => setRitos((a) => ({ ...a, [r]: v })), `Prazo total do rito ${ROTULO_RITO[r]}`)}
              <span className="w-24 text-xs text-gray-400">padrão: {padraoRito[r] ?? 'sem meta'}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900">Dias de cada etapa</h2>
        <p className="mt-1 text-sm text-gray-500">
          E01–E19: dias de <strong>referência</strong> (servem de proporção para repartir o prazo total do rito).
          E20–E35: dias <strong>fixos</strong>. Marcos acompanhados: {MARCOS.map((m) => `${m.nome} (${m.etapaId})`).join(', ')}.
        </p>
        <table className="mt-4 min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-2">Etapa</th><th className="py-2 pr-2">Quem age</th><th className="py-2 pr-2">Tipo</th><th className="py-2 text-right">Dias</th><th className="py-2 pl-3 text-gray-400">padrão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ETAPAS.map((e) => (
              <tr key={e.id}>
                <td className="py-1.5 pr-2"><strong>{e.id}</strong> — {e.nome}{e.opcional && <span className="ml-1 text-xs text-gray-400">(se necessário: não conta no prazo)</span>}</td>
                <td className="py-1.5 pr-2 text-gray-500">{e.setor}</td>
                <td className="py-1.5 pr-2 text-xs text-gray-500">{ETAPAS_RITO.includes(e.id) ? 'referência' : 'fixo'}</td>
                <td className="py-1.5 text-right">{editor(dias[e.id], (v) => setDias((a) => ({ ...a, [e.id]: v })), `Dias da etapa ${e.id}`)}</td>
                <td className="py-1.5 pl-3 text-xs text-gray-400">{DIAS_PADRAO_ETAPA[e.id]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={salvando} onClick={salvar} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:opacity-50">
          {salvando ? 'Salvando...' : 'Salvar prazos'}
        </button>
        {mensagem && <span className="text-sm text-gray-700">{mensagem}</span>}
      </div>
    </div>
  );
}
