import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, PlusCircle, Search } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useApp } from '../../context/AppContext';
import { STATUS_IRP_CORES, STATUS_IRP_LABELS, type StatusIrp } from '../../types';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

/**
 * Planejamento (IRP) — módulo restrito à 4ª Seção do Estado-Maior Geral
 * (perfil `bm4`): Intenções de Registro de Preços publicadas por outros
 * órgãos, disponíveis pros setores demandantes se manifestarem sobre
 * interesse em aderir.
 */
export default function Planejamento() {
  const { irps, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusIrp | ''>('');

  const isMasterOuBm4 = usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'bm4';

  const hoje = useMemo(() => new Date(), []);

  // Demandante só enxerga as IRPs direcionadas ao próprio setor (é o pedido
  // original: "IRPs direcionadas ao setor dele") — os demais perfis (master,
  // bm4) continuam vendo todas, como sempre.
  const irpsVisiveis = useMemo(() => {
    if (usuarioAtual?.perfil !== 'demandante') return irps;
    const unidade = usuarioAtual.unidadeDemandante;
    return irps.filter((irp) => unidade && irp.setoresDemandantes.includes(unidade));
  }, [irps, usuarioAtual]);

  const filtradas = useMemo(() => {
    const buscaNormalizada = busca.toLowerCase();
    return irpsVisiveis
      .filter((irp) => {
        if (filtroStatus && irp.status !== filtroStatus) return false;
        if (!buscaNormalizada) return true;
        return [irp.numeroIrp, irp.objeto, irp.orgaoGerenciador, ...irp.setoresDemandantes]
          .some((campo) => (campo || '').toLowerCase().includes(buscaNormalizada));
      })
      .sort((a, b) => new Date(a.prazoManifestacao).getTime() - new Date(b.prazoManifestacao).getTime());
  }, [irpsVisiveis, busca, filtroStatus]);

  const contadores = useMemo(() => {
    const abertas = irpsVisiveis.filter((i) => i.status === 'aberta' || i.status === 'em_analise').length;
    const prazoProximo = irpsVisiveis.filter((i) => {
      if (i.status !== 'aberta' && i.status !== 'em_analise') return false;
      const dias = differenceInDays(new Date(i.prazoManifestacao), hoje);
      return dias >= 0 && dias <= 5;
    }).length;
    const aderidas = irpsVisiveis.filter((i) => i.status === 'aderida').length;
    return { abertas, prazoProximo, aderidas, total: irpsVisiveis.length };
  }, [irpsVisiveis, hoje]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <ClipboardList className="w-6 h-6 mr-2 text-red-700 flex-shrink-0" />
            Planejamento — Intenções de Registro de Preços (IRP)
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            IRPs publicadas por órgãos federais, distritais e estaduais, à disposição dos setores
            demandantes para manifestação de interesse.
          </p>
        </div>
        {isMasterOuBm4 && (
          <button
            onClick={() => navigate('/sistema/planejamento/novo')}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800"
          >
            <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
            Nova IRP
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Total de IRPs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{contadores.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Abertas / Em análise</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{contadores.abertas}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Prazo em até 5 dias</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{contadores.prazoProximo}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase">Aderidas</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{contadores.aderidas}</p>
        </div>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
            placeholder="Buscar por número, objeto, órgão ou setor..."
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as StatusIrp | '')}
          className="block w-full sm:w-56 rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_IRP_LABELS) as StatusIrp[]).map((status) => (
            <option key={status} value={status}>{STATUS_IRP_LABELS[status]}</option>
          ))}
        </select>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nº IRP / Órgão</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Objeto</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setores Demandantes</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prazo p/ Manifestação</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtradas.map((irp) => {
              const diasRestantes = differenceInDays(new Date(irp.prazoManifestacao), hoje);
              const prazoUrgente = (irp.status === 'aberta' || irp.status === 'em_analise') && diasRestantes <= 5;
              return (
                <tr
                  key={irp.id}
                  onClick={() => navigate(`/sistema/planejamento/${irp.id}/editar`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{irp.numeroIrp}</div>
                    <div className="text-xs text-gray-500">{irp.esferaOrgao} — {irp.orgaoGerenciador}</div>
                  </td>
                  <td className="px-4 py-4 max-w-sm">
                    <div className="text-sm text-gray-900 line-clamp-2" title={irp.objeto}>{irp.objeto}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-700">{irp.setoresDemandantes.join(', ') || '-'}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`text-sm ${prazoUrgente ? 'font-semibold text-amber-700' : 'text-gray-900'}`}>
                      {formatarData(irp.prazoManifestacao)}
                    </div>
                    {prazoUrgente && (
                      <div className="text-xs text-amber-600">
                        {diasRestantes < 0 ? 'Prazo vencido' : `Faltam ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium outline outline-1 outline-offset-1 ${STATUS_IRP_CORES[irp.status]}`}>
                      {STATUS_IRP_LABELS[irp.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">Nenhuma IRP encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
