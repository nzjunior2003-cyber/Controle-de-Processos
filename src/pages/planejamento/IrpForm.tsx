import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OPCOES_UNIDADE_DEMANDANTE } from '../../lib/planilhaProcessos';
import { STATUS_IRP_LABELS, type EsferaOrgaoIrp, type StatusIrp } from '../../types';

const paraDataInput = (isoOuVazio?: string) => (isoOuVazio ? isoOuVazio.split('T')[0] : '');

const ESFERAS: EsferaOrgaoIrp[] = ['Federal', 'Distrital', 'Estadual'];

export default function IrpForm() {
  const { id } = useParams<{ id: string }>();
  const { irps, addIrp, updateIrp, deleteIrp, usuarioAtual } = useApp();
  const navigate = useNavigate();

  const emEdicao = !!id;
  const irp = id ? irps.find((i) => i.id === id) : undefined;

  const [esferaOrgao, setEsferaOrgao] = useState<EsferaOrgaoIrp>(irp?.esferaOrgao ?? 'Federal');
  const [orgaoGerenciador, setOrgaoGerenciador] = useState(irp?.orgaoGerenciador ?? '');
  const [numeroIrp, setNumeroIrp] = useState(irp?.numeroIrp ?? '');
  const [processoOrigem, setProcessoOrigem] = useState(irp?.processoOrigem ?? '');
  const [objeto, setObjeto] = useState(irp?.objeto ?? '');
  const hoje = new Date().toISOString().split('T')[0];
  const [dataPublicacao, setDataPublicacao] = useState(paraDataInput(irp?.dataPublicacao) || hoje);
  const [prazoManifestacao, setPrazoManifestacao] = useState(paraDataInput(irp?.prazoManifestacao));
  const [setoresDemandantes, setSetoresDemandantes] = useState<string[]>(irp?.setoresDemandantes ?? []);
  const [status, setStatus] = useState<StatusIrp>(irp?.status ?? 'aberta');
  const [linkEdital, setLinkEdital] = useState(irp?.linkEdital ?? '');
  const [observacaoResposta, setObservacaoResposta] = useState(irp?.observacaoResposta ?? '');
  const [responsavelRespostaNome, setResponsavelRespostaNome] = useState(irp?.responsavelRespostaNome ?? '');
  const [responsavelRespostaEmail, setResponsavelRespostaEmail] = useState(irp?.responsavelRespostaEmail ?? '');

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleToggleSetor = (setor: string) => {
    setSetoresDemandantes((prev) =>
      prev.includes(setor) ? prev.filter((s) => s !== setor) : [...prev, setor],
    );
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroIrp || !objeto || !orgaoGerenciador || !prazoManifestacao) return;

    setSalvando(true);
    try {
      const dadosComuns = {
        esferaOrgao,
        orgaoGerenciador,
        numeroIrp,
        processoOrigem,
        objeto,
        dataPublicacao: new Date(dataPublicacao).toISOString(),
        prazoManifestacao: new Date(prazoManifestacao).toISOString(),
        setoresDemandantes,
        status,
        linkEdital,
        observacaoResposta,
        responsavelRespostaNome,
        responsavelRespostaEmail,
      };

      if (emEdicao && id) {
        await updateIrp(id, dadosComuns);
      } else {
        await addIrp({
          ...dadosComuns,
          responsavelCadastroId: usuarioAtual?.id || '',
          responsavelCadastroNome: usuarioAtual?.nome || '',
        });
      }

      navigate('/sistema/planejamento');
    } catch (erro) {
      alert('Não foi possível salvar a IRP: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    if (!window.confirm('Excluir esta IRP? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await deleteIrp(id);
      navigate('/sistema/planejamento');
    } catch (erro) {
      alert('Não foi possível excluir a IRP: ' + (erro instanceof Error ? erro.message : String(erro)));
    } finally {
      setExcluindo(false);
    }
  };

  if (emEdicao && !irp) {
    return <div className="p-6">IRP não encontrada.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {emEdicao ? `Editar IRP ${irp?.numeroIrp}` : 'Nova IRP'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {emEdicao
              ? 'Atualize os dados da Intenção de Registro de Preços.'
              : 'Cadastre uma IRP publicada por outro órgão, à disposição dos setores demandantes.'}
          </p>
        </div>
        {emEdicao && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            className="inline-flex items-center px-3 py-1.5 border border-red-200 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="-ml-1 mr-1.5 h-4 w-4" />
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="esferaOrgao" className="block text-sm font-medium text-gray-700">
                Esfera do Órgão <span className="text-red-500">*</span>
              </label>
              <select
                id="esferaOrgao"
                required
                value={esferaOrgao}
                onChange={(e) => setEsferaOrgao(e.target.value as EsferaOrgaoIrp)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                {ESFERAS.map((esfera) => (
                  <option key={esfera} value={esfera}>{esfera}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="orgaoGerenciador" className="block text-sm font-medium text-gray-700">
                Órgão Gerenciador <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="orgaoGerenciador"
                required
                value={orgaoGerenciador}
                onChange={(e) => setOrgaoGerenciador(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="numeroIrp" className="block text-sm font-medium text-gray-700">
                Número da IRP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="numeroIrp"
                required
                value={numeroIrp}
                onChange={(e) => setNumeroIrp(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="processoOrigem" className="block text-sm font-medium text-gray-700">
                Processo de Origem
              </label>
              <input
                type="text"
                id="processoOrigem"
                value={processoOrigem}
                onChange={(e) => setProcessoOrigem(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="dataPublicacao" className="block text-sm font-medium text-gray-700">
                Data de Publicação
              </label>
              <input
                type="date"
                id="dataPublicacao"
                value={dataPublicacao}
                onChange={(e) => setDataPublicacao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="prazoManifestacao" className="block text-sm font-medium text-gray-700">
                Prazo Final para Manifestação <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="prazoManifestacao"
                required
                value={prazoManifestacao}
                onChange={(e) => setPrazoManifestacao(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusIrp)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                {(Object.keys(STATUS_IRP_LABELS) as StatusIrp[]).map((s) => (
                  <option key={s} value={s}>{STATUS_IRP_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="linkEdital" className="block text-sm font-medium text-gray-700">
                Link/Anexo do Edital
              </label>
              <input
                type="text"
                id="linkEdital"
                value={linkEdital}
                onChange={(e) => setLinkEdital(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="objeto" className="block text-sm font-medium text-gray-700">
                Objeto <span className="text-red-500">*</span>
              </label>
              <textarea
                id="objeto"
                rows={2}
                required
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Setores Demandantes <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {OPCOES_UNIDADE_DEMANDANTE.map((setor) => (
                  <button
                    type="button"
                    key={setor}
                    onClick={() => handleToggleSetor(setor)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      setoresDemandantes.includes(setor)
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {setor}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="responsavelRespostaNome" className="block text-sm font-medium text-gray-700">
                Responsável pela Resposta (Nome)
              </label>
              <input
                type="text"
                id="responsavelRespostaNome"
                value={responsavelRespostaNome}
                onChange={(e) => setResponsavelRespostaNome(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>

            <div>
              <label htmlFor="responsavelRespostaEmail" className="block text-sm font-medium text-gray-700">
                Responsável pela Resposta (E-mail)
              </label>
              <input
                type="email"
                id="responsavelRespostaEmail"
                value={responsavelRespostaEmail}
                onChange={(e) => setResponsavelRespostaEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="Usado no e-mail de alerta de prazo"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="observacaoResposta" className="block text-sm font-medium text-gray-700">
                Observações da Resposta
              </label>
              <textarea
                id="observacaoResposta"
                rows={3}
                value={observacaoResposta}
                onChange={(e) => setObservacaoResposta(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              {salvando ? 'Salvando...' : emEdicao ? 'Salvar Alterações' : 'Salvar IRP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
