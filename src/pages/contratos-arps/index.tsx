import { useMemo, useState } from 'react';
import { Filter, PlusCircle, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useMilitares } from '../../hooks/useMilitares';
import { buscarContratos } from '../../lib/contratos';
import type {
  PortariaFiscal,
  ProcedimentoLicitatorio,
  ProcessoSancionatorio,
} from '../../types';
import {
  MENU_ABAS,
  filtroModalidade,
  isAbaProcedimento,
  modalidadePadrao,
  rotuloNovoRegistro,
  type AbaContratos,
  type RegistroFormData,
} from './abas';
import TabelaContratos from './TabelaContratos';
import TabelaProcedimentos from './TabelaProcedimentos';
import TabelaSancionatorios from './TabelaSancionatorios';
import TabelaPortarias from './TabelaPortarias';
import RegistroModal from './RegistroModal';

export default function ContratosArps() {
  const {
    processos,
    pcas,
    usuarioAtual,
    contratos,
    procedimentos,
    sancionatorios,
    portarias,
    addProcedimento,
    updateProcedimento,
    addSancionatorio,
    updateSancionatorio,
    addPortaria,
    updatePortaria,
  } = useApp();
  const { militares } = useMilitares();

  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<AbaContratos>('contratos');
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState<RegistroFormData>({});

  const isMasterOrContratos =
    usuarioAtual?.perfil === 'master' || usuarioAtual?.perfil === 'contratos';

  const getPcaTitleByProcesso = (numeroProcesso: string) => {
    const processo = processos.find((p) => p.numero_processo === numeroProcesso);
    if (processo?.pca_id) {
      return pcas.find((p) => p.id === processo.pca_id)?.codigo_pca ?? null;
    }
    return null;
  };

  /**
   * Procedimentos derivados automaticamente dos processos cujo rito é uma
   * modalidade licitatória e que ainda não têm registro próprio.
   */
  const autoProcedimentos = useMemo<ProcedimentoLicitatorio[]>(
    () =>
      processos
        .filter((p) => {
          if (procedimentos.some((proc) => proc.pae === p.numero_processo)) return false;
          return (
            p.rito_processual === 'Adesão ARP' ||
            p.rito_processual === 'Gerenciador da ARP' ||
            p.rito_processual === 'Partícipe de ARP' ||
            !!p.rito_processual?.includes('Pregão') ||
            !!p.rito_processual?.includes('Dispensa') ||
            !!p.rito_processual?.includes('Inexigibilidade')
          );
        })
        .map((p) => {
          let modalidade = '';
          if (p.rito_processual === 'Adesão ARP') modalidade = 'Adesão';
          else if (p.rito_processual === 'Gerenciador da ARP') modalidade = 'Pregão Eletrônico (Gerenciador)';
          else if (p.rito_processual === 'Partícipe de ARP') modalidade = 'Partícipe';
          else if (p.rito_processual?.includes('Pregão')) modalidade = 'Pregão Eletrônico';
          else if (p.rito_processual?.includes('Dispensa')) modalidade = 'Dispensa';
          else if (p.rito_processual?.includes('Inexigibilidade')) modalidade = 'Inexigibilidade';

          return {
            id: `auto-${p.id}`,
            pae: p.numero_processo,
            numero: 'Aguardando',
            modalidade,
            objeto: p.objeto,
            fase: 'Pendente',
            dataPublicacao: '-',
            previsaoAbertura: '-',
            isAuto: true,
          };
        }),
    [processos, procedimentos],
  );

  const todosProcedimentos = useMemo(
    () => [...procedimentos, ...autoProcedimentos],
    [procedimentos, autoProcedimentos],
  );

  const filtrarProcedimentos = (tipoModalidade: string) => {
    const termo = busca.toLowerCase();
    return todosProcedimentos.filter(
      (p) =>
        (p.modalidade ?? '').toLowerCase().includes(tipoModalidade.toLowerCase()) &&
        ((p.modalidade ?? '').toLowerCase().includes(termo) ||
          (p.numero ?? '').includes(busca) ||
          (p.objeto ?? '').toLowerCase().includes(termo) ||
          (p.pae ?? '').includes(busca)),
    );
  };

  const contratosFiltrados = buscarContratos(contratos, busca);
  const pregoesFiltrados = filtrarProcedimentos('Pregão');
  const inexigibilidadesFiltradas = filtrarProcedimentos('Inexigibilidade');
  const dispensasFiltradas = filtrarProcedimentos('Dispensa');
  const adesoesFiltradas = filtrarProcedimentos('Adesão');
  const participesFiltradas = filtrarProcedimentos('Partícipe');

  const sancionatoriosFiltrados = sancionatorios.filter((s) => {
    const termo = busca.toLowerCase();
    return (
      (s.empresa ?? '').toLowerCase().includes(termo) ||
      (s.processo ?? '').includes(busca) ||
      (s.motivo ?? '').toLowerCase().includes(termo) ||
      (s.fase ?? '').toLowerCase().includes(termo)
    );
  });

  const portariasFiltradas = portarias.filter((p) => {
    const termo = busca.toLowerCase();
    return (
      (p.empresa ?? '').toLowerCase().includes(termo) ||
      (p.contrato ?? '').includes(busca) ||
      (p.fiscalTitular ?? '').toLowerCase().includes(termo) ||
      (p.portaria ?? '').includes(busca)
    );
  });

  const contadores: Record<AbaContratos, number> = {
    contratos: contratosFiltrados.length,
    pregoes: pregoesFiltrados.length,
    inexigibilidades: inexigibilidadesFiltradas.length,
    dispensas: dispensasFiltradas.length,
    adesoes: adesoesFiltradas.length,
    participe: participesFiltradas.length,
    sancionatorios: sancionatoriosFiltrados.length,
    portarias: portariasFiltradas.length,
  };

  const abrirNovoRegistro = () => {
    setFormData(
      abaAtiva === 'portarias'
        ? { portaria: `00${Math.floor(Math.random() * 10) + 1}/${new Date().getFullYear()}-DP` }
        : {},
    );
    setModalOpen(true);
  };

  const abrirEdicao = (
    item: ProcedimentoLicitatorio | ProcessoSancionatorio | PortariaFiscal,
  ) => {
    setFormData({ ...item });
    setModalOpen(true);
  };

  const handleSalvarRegistro = async () => {
    setSalvando(true);
    try {
      const { id, isAuto: _isAuto, ...dados } = formData;
      // Registros automáticos (derivados de processos) ainda não existem no
      // Firestore: salvar cria um registro próprio.
      const idExistente = typeof id === 'string' && !id.startsWith('auto-') ? id : null;

      if (abaAtiva === 'sancionatorios') {
        const sancionatorio = {
          processo: dados.processo ?? '',
          empresa: dados.empresa ?? '',
          motivo: dados.motivo ?? '',
          fase: dados.fase ?? '',
          dataAbertura: dados.dataAbertura ?? new Date().toISOString().split('T')[0],
        };
        if (idExistente) await updateSancionatorio(idExistente, sancionatorio);
        else await addSancionatorio(sancionatorio);
      } else if (abaAtiva === 'portarias') {
        const portaria = {
          ...dados,
          portaria: dados.portaria ?? '',
          contrato: dados.contrato ?? '',
          empresa: dados.empresa ?? '',
          fiscalTitular: dados.fiscalTitular ?? '',
          dataPublicacao: dados.dataPublicacao ?? new Date().toISOString().split('T')[0],
        } as Omit<PortariaFiscal, 'id'>;
        if (idExistente) await updatePortaria(idExistente, portaria);
        else await addPortaria(portaria);
      } else {
        const processoVinculado = processos.find((p) => p.numero_processo === dados.pae);
        const procedimento = {
          ...dados,
          pae: dados.pae ?? '',
          numero: dados.numero ?? dados.numeroContrato ?? 'Aguardando',
          modalidade: dados.modalidade || modalidadePadrao(abaAtiva),
          objeto: dados.objeto || processoVinculado?.objeto || 'Objeto não informado',
          fase: dados.fase ?? 'Pendente',
          dataPublicacao: dados.dataPublicacao ?? '-',
          previsaoAbertura: dados.previsaoAbertura ?? '-',
        } as Omit<ProcedimentoLicitatorio, 'id'>;
        if (idExistente) await updateProcedimento(idExistente, procedimento);
        else await addProcedimento(procedimento);
      }

      setModalOpen(false);
      setFormData({});
    } catch (erro) {
      console.error(erro);
      alert(
        'Não foi possível salvar o registro: ' +
          (erro instanceof Error ? erro.message : String(erro)),
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos e ARP&apos;s</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestão de pregões, dispensas, inexigibilidades e portarias.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {MENU_ABAS.map((item) => {
          const Icone = item.icone;
          const isAtivo = abaAtiva === item.id;

          return (
            <div
              key={item.id}
              onClick={() => setAbaAtiva(item.id)}
              className={`bg-white p-4 rounded-lg border shadow-sm border-l-4 ${item.borderLClass} cursor-pointer transition-colors relative ${
                isAtivo
                  ? `ring-1 ${item.ringClass} ${item.bgClass} ${item.borderClass}`
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider line-clamp-2 ${isAtivo ? item.textThemeClass : 'text-gray-500'}`}
                    title={item.nome}
                  >
                    {item.nome}
                  </span>
                  <Icone className={`h-5 w-5 flex-shrink-0 ${isAtivo ? item.textClass : 'text-gray-400'}`} />
                </div>
                <span className={`text-2xl font-bold ${isAtivo ? item.textNumClass : 'text-gray-900'}`}>
                  {contadores[item.id]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 space-y-4">
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
              placeholder="Pesquisar..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <Filter className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
              Filtros
            </button>
            {abaAtiva !== 'contratos' && isMasterOrContratos && (
              <button
                onClick={abrirNovoRegistro}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
              >
                <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
                {rotuloNovoRegistro(abaAtiva)}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {abaAtiva === 'contratos' && <TabelaContratos dados={contratosFiltrados} />}

          {isAbaProcedimento(abaAtiva) && (
            <TabelaProcedimentos
              dados={filtrarProcedimentos(filtroModalidade(abaAtiva))}
              getPcaTitleByProcesso={getPcaTitleByProcesso}
              podeEditar={isMasterOrContratos}
              onEditar={abrirEdicao}
            />
          )}

          {abaAtiva === 'sancionatorios' && (
            <TabelaSancionatorios
              dados={sancionatoriosFiltrados}
              podeEditar={isMasterOrContratos}
              onEditar={abrirEdicao}
            />
          )}

          {abaAtiva === 'portarias' && (
            <TabelaPortarias
              dados={portariasFiltradas}
              podeEditar={isMasterOrContratos}
              onEditar={abrirEdicao}
            />
          )}
        </div>
      </div>

      {modalOpen && (
        <RegistroModal
          abaAtiva={abaAtiva}
          formData={formData}
          setFormData={setFormData}
          processos={processos}
          pcas={pcas}
          portarias={portarias}
          militares={militares}
          salvando={salvando}
          onFechar={() => setModalOpen(false)}
          onSalvar={handleSalvarRegistro}
        />
      )}
    </div>
  );
}
