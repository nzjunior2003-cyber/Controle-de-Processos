import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../../context/AppContext';
import BuscaMilitarInput from '../../components/contratos/BuscaMilitarInput';
import { carregarMilitares, type Militar } from '../../lib/militares';
import { enviarEmail } from '../../lib/emailService';
import { getAccessToken } from '../../lib/googleAuth';
import { ID_PLANILHA_CONTRATOS } from '../../lib/csv';
import { sincronizarContratoNaPlanilha } from '../../lib/sheetsService';
import { sincronizarContratoInstitucional } from '../../lib/sheetsInstitucionalService';
import { contratoParaDadosPlanilha } from '../../lib/planilhaContratos';
import type { Contrato } from '../../types';

const CLASSE_INPUT =
  'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border';

const formatarData = (valor?: string) => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '-' : format(data, 'dd/MM/yyyy');
};

interface Fiscal {
  nome: string;
  email: string;
  contato: string;
  cargo: string;
  mf: string;
  ubm: string;
}

/**
 * Troca de fiscal titular/suplente de um contrato, sem passar pelo cadastro
 * completo. O período do fiscal anterior é fechado no histórico (feito por
 * `updateContrato`), a planilha é atualizada e os novos fiscais recebem o
 * e-mail de designação — o mesmo que acontece ao editar o contrato.
 */
export default function AlterarFiscaisModal({ contrato, onFechar }: { contrato: Contrato; onFechar: () => void }) {
  const { updateContrato } = useApp();
  const [militares, setMilitares] = useState<Militar[]>([]);
  const [titular, setTitular] = useState<Fiscal>({
    nome: contrato.fiscalTitular ?? '',
    email: contrato.fiscalEmail ?? '',
    contato: contrato.fiscalTitularContato ?? '',
    cargo: contrato.fiscalTitularCargo ?? '',
    mf: contrato.fiscalTitularMf ?? '',
    ubm: contrato.fiscalTitularUbm ?? '',
  });
  const [suplente, setSuplente] = useState<Fiscal>({
    nome: contrato.fiscalSuplente ?? '',
    email: contrato.fiscalSuplenteEmail ?? '',
    contato: contrato.fiscalSuplenteContato ?? '',
    cargo: contrato.fiscalSuplenteCargo ?? '',
    mf: contrato.fiscalSuplenteMf ?? '',
    ubm: contrato.fiscalSuplenteUbm ?? '',
  });
  const [portaria, setPortaria] = useState(contrato.portaria ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    carregarMilitares()
      .then((lista) => {
        if (!cancelado) setMilitares(lista);
      })
      .catch((e) => console.error('Erro ao carregar a planilha de militares:', e));
    return () => {
      cancelado = true;
    };
  }, []);

  const mudou =
    titular.nome !== (contrato.fiscalTitular ?? '') ||
    titular.email !== (contrato.fiscalEmail ?? '') ||
    suplente.nome !== (contrato.fiscalSuplente ?? '') ||
    suplente.email !== (contrato.fiscalSuplenteEmail ?? '') ||
    portaria !== (contrato.portaria ?? '');

  const salvar = async () => {
    if (!mudou) return;
    setSalvando(true);
    setErro(null);
    try {
      const novos = {
        fiscalTitular: titular.nome,
        fiscalEmail: titular.email,
        fiscalTitularContato: titular.contato,
        fiscalTitularCargo: titular.cargo,
        fiscalTitularMf: titular.mf,
        fiscalTitularUbm: titular.ubm,
        fiscalSuplente: suplente.nome,
        fiscalSuplenteEmail: suplente.email,
        fiscalSuplenteContato: suplente.contato,
        fiscalSuplenteCargo: suplente.cargo,
        fiscalSuplenteMf: suplente.mf,
        fiscalSuplenteUbm: suplente.ubm,
        portaria,
      };
      await updateContrato(contrato.id, novos);
      const atualizado = { ...contrato, ...novos };

      // Planilhas: só tenta a do Google se já há login nesta sessão (sem abrir popup); a institucional é sempre tentada.
      const avisos: string[] = [];
      try {
        const token = await getAccessToken();
        if (token) {
          await sincronizarContratoNaPlanilha(token, ID_PLANILHA_CONTRATOS, contratoParaDadosPlanilha(atualizado), contrato.planilha_linha);
        } else {
          avisos.push('a planilha de contratos não foi atualizada (sem login do Google nesta sessão) — será corrigida ao editar o contrato ou sincronizar');
        }
      } catch (e) {
        avisos.push('a planilha de contratos não foi atualizada: ' + (e instanceof Error ? e.message : String(e)));
      }
      try {
        await sincronizarContratoInstitucional(contratoParaDadosPlanilha(atualizado));
      } catch (e) {
        avisos.push('a planilha institucional não foi atualizada: ' + (e instanceof Error ? e.message : String(e)));
      }

      const vigencia = contrato.fimVigencia ? formatarData(contrato.fimVigencia) : 'não informada';
      try {
        if (novos.fiscalEmail && novos.fiscalEmail !== (contrato.fiscalEmail ?? '')) {
          await enviarEmail({
            to: novos.fiscalEmail,
            subject: `Você foi designado Fiscal do Contrato ${contrato.numero}`,
            html: `<h2>Designação de Fiscal — Contrato ${contrato.numero}</h2><p>Prezado(a) ${novos.fiscalTitular || 'Fiscal'},</p><p>Você foi designado(a) <b>Fiscal Titular</b> do contrato <b>${contrato.numero}</b> (${contrato.empresa}), com vigência até ${vigencia}.</p><p>Acesse o sistema, módulo Fiscal do Contrato, para mais detalhes.</p>`,
          });
        }
        if (novos.fiscalSuplenteEmail && novos.fiscalSuplenteEmail !== (contrato.fiscalSuplenteEmail ?? '')) {
          await enviarEmail({
            to: novos.fiscalSuplenteEmail,
            subject: `Você foi designado Fiscal Suplente do Contrato ${contrato.numero}`,
            html: `<h2>Designação de Fiscal Suplente — Contrato ${contrato.numero}</h2><p>Prezado(a) ${novos.fiscalSuplente || 'Fiscal Suplente'},</p><p>Você foi designado(a) <b>Fiscal Suplente</b> do contrato <b>${contrato.numero}</b> (${contrato.empresa}), com vigência até ${vigencia}.</p><p>Acesse o sistema, módulo Fiscal do Contrato, para mais detalhes.</p>`,
          });
        }
      } catch (e) {
        avisos.push('o e-mail de aviso ao novo fiscal não foi enviado: ' + (e instanceof Error ? e.message : String(e)));
      }

      if (avisos.length > 0) alert('Fiscais alterados no sistema, mas ' + avisos.join('; ') + '.');
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível alterar os fiscais.');
    } finally {
      setSalvando(false);
    }
  };

  const bloco = (rotulo: string, valor: Fiscal, setValor: Dispatch<SetStateAction<Fiscal>>) => (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-900">{rotulo}</h4>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <BuscaMilitarInput
          militares={militares}
          value={valor.nome}
          onChange={(nome) => setValor((v) => ({ ...v, nome }))}
          onSelecionar={(m) => setValor((v) => ({ ...v, cargo: m.cargo, mf: m.mf, ubm: m.ubm || v.ubm }))}
          className={CLASSE_INPUT}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail</label>
          <input type="email" value={valor.email} onChange={(e) => setValor((v) => ({ ...v, email: e.target.value }))} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contato</label>
          <input type="text" value={valor.contato} onChange={(e) => setValor((v) => ({ ...v, contato: e.target.value }))} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Cargo</label>
          <input type="text" value={valor.cargo} onChange={(e) => setValor((v) => ({ ...v, cargo: e.target.value }))} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">MF</label>
          <input type="text" value={valor.mf} onChange={(e) => setValor((v) => ({ ...v, mf: e.target.value }))} className={CLASSE_INPUT} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700">UBM</label>
          <input type="text" value={valor.ubm} onChange={(e) => setValor((v) => ({ ...v, ubm: e.target.value }))} className={CLASSE_INPUT} />
        </div>
      </div>
    </div>
  );

  const historico = [...(contrato.historicoFiscal ?? [])].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500 bg-opacity-75" onClick={onFechar}>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Alterar fiscais</h3>
            <p className="text-sm text-gray-500">Contrato {contrato.numero} — {contrato.empresa}</p>
          </div>
          <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bloco('Fiscal titular', titular, setTitular)}
          {bloco('Fiscal suplente', suplente, setSuplente)}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700" htmlFor="portaria-fiscais">Portaria de designação</label>
          <input id="portaria-fiscais" type="text" value={portaria} onChange={(e) => setPortaria(e.target.value)} className={CLASSE_INPUT} placeholder="Ex.: Portaria nº 123/2026 – BG nº 45" />
        </div>

        {historico.length > 0 && (
          <div className="mt-6">
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Fiscais anteriores</h4>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md text-sm">
              {historico.map((h) => (
                <li key={h.id} className="px-3 py-2">
                  <span className="text-gray-900">Titular: {h.fiscalTitular || '-'} · Suplente: {h.fiscalSuplente || '-'}</span>
                  <span className="block text-xs text-gray-500">{formatarData(h.desde)} a {formatarData(h.ate)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onFechar} className="bg-white py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" disabled={!mudou || salvando} onClick={salvar} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400">
            {salvando ? 'Salvando...' : 'Salvar alteração'}
          </button>
        </div>
      </div>
    </div>
  );
}
