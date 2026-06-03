import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Save } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { PcaAutocomplete } from '../components/PcaAutocomplete';
import { CHECKLISTS_RITOS } from '../types';

export default function NovoProcesso() {
  const { addProcesso, pcas, usuarioAtual, setores } = useApp();
  const navigate = useNavigate();

  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [objeto, setObjeto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidadeDemandante, setUnidadeDemandante] = useState('');
  const [pcaId, setPcaId] = useState('');
  const [pcaSearchText, setPcaSearchText] = useState('');

  const [ritoProcessual, setRitoProcessual] = useState('');
  const [checklistLocal, setChecklistLocal] = useState<string[]>([]);

  const handleRitoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const valor = e.target.value;
    setRitoProcessual(valor);
    setChecklistLocal([]); // Reset checklist on changing rito
  };

  const handleToggleChecklist = (item: string) => {
    setChecklistLocal(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };
  
  const [faseAtualId, setFaseAtualId] = useState('1');
  const [andamento, setAndamento] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const [dataEntrada, setDataEntrada] = useState(today);
  const [ultimaTramitacao, setUltimaTramitacao] = useState(today);

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroProcesso || !objeto || !unidadeDemandante) return;
    
    addProcesso({
      numero_processo: numeroProcesso,
      objeto,
      descricao,
      unidade_demandante: unidadeDemandante,
      demandante_id: usuarioAtual?.id || 'u1',
      pca_id: pcaId || undefined,
      rito_processual: ritoProcessual,
      checklist_rito: checklistLocal,
      fase_atual_id: faseAtualId,
      andamento,
      data_entrada: new Date(dataEntrada).toISOString(),
      ultima_tramitacao: new Date(ultimaTramitacao).toISOString(),
    });
    
    navigate('/sistema/aquisicoes');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Processo</h1>
          <p className="mt-1 text-sm text-gray-500">Cadastre um novo processo administrativo de aquisição ou contração.</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <form onSubmit={handleSalvar} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="numeroProcesso" className="block text-sm font-medium text-gray-700">
                Número do Processo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="numeroProcesso"
                required
                value={numeroProcesso}
                onChange={(e) => setNumeroProcesso(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border"
                placeholder="Ex: 2026/012345"
              />
            </div>

            <div>
              <label htmlFor="unidadeDemandante" className="block text-sm font-medium text-gray-700">
                Unidade Demandante <span className="text-red-500">*</span>
              </label>
              <select
                id="unidadeDemandante"
                required
                value={unidadeDemandante}
                onChange={(e) => setUnidadeDemandante(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              >
                <option value="">Selecione a Unidade...</option>
                <option value="AASINT/PEV">AASINT/PEV</option>
                <option value="AJG">AJG</option>
                <option value="ASCOM">ASCOM</option>
                <option value="CEDEC">CEDEC</option>
                <option value="CEINT">CEINT</option>
                <option value="CENTROPAT">CENTROPAT</option>
                <option value="COP">COP</option>
                <option value="COP/GMAF">COP/GMAF</option>
                <option value="COP/GSE">COP/GSE</option>
                <option value="CSMV/MOP">CSMV/MOP</option>
                <option value="DAL">DAL</option>
                <option value="DGCEP">DGCEP</option>
                <option value="DS">DS</option>
                <option value="DTIC">DTIC</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="pca" className="block text-sm font-medium text-gray-700 mb-1">
                Vincular PCA (Plano de Contratações Anual)
              </label>
              <PcaAutocomplete
                pcas={pcas}
                value={pcaSearchText}
                onChange={setPcaSearchText}
                onSelect={(pca) => setPcaId(pca.id)}
                placeholder="Digite a ordem, demandante ou descrição..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="ritoProcessual" className="block text-sm font-medium text-gray-700">Rito Processual</label>
              <select id="ritoProcessual" value={ritoProcessual} onChange={handleRitoChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                <option value="">Selecione um Rito...</option>
                {Object.keys(CHECKLISTS_RITOS).map(rito => (
                  <option key={rito} value={rito}>{rito}</option>
                ))}
              </select>
              
              {ritoProcessual && CHECKLISTS_RITOS[ritoProcessual] && (
                <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Checklist Inicial:</h4>
                  <div className="space-y-2">
                    {CHECKLISTS_RITOS[ritoProcessual].map((item, idx) => (
                      <div key={idx} className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id={`check-novo-${idx}`}
                            type="checkbox"
                            checked={checklistLocal.includes(item)}
                            onChange={() => handleToggleChecklist(item)}
                            className="focus:ring-red-500 h-4 w-4 text-red-600 border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor={`check-novo-${idx}`} className={`font-medium cursor-pointer ${checklistLocal.includes(item) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                            {item}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="faseAtualId" className="block text-sm font-medium text-gray-700">Setor Atual <span className="text-red-500">*</span></label>
              <select id="faseAtualId" value={faseAtualId} onChange={e => setFaseAtualId(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border bg-white">
                {setores.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} ({s.sigla})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="andamento" className="block text-sm font-medium text-gray-700">Andamento</label>
              <input type="text" id="andamento" value={andamento} onChange={e => setAndamento(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border" placeholder="Aguardando assinatura, Em análise..." />
            </div>

            <div>
              <label htmlFor="dataEntrada" className="block text-sm font-medium text-gray-700">Data de Cadastro</label>
              <input type="date" id="dataEntrada" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border" />
              <p className="mt-1 text-xs text-gray-500">
                Tempo total: <span className="font-semibold text-gray-900">{dataEntrada ? Math.max(0, differenceInDays(new Date(), new Date(`${dataEntrada}T00:00:00`))) : 0} dias</span>
              </p>
            </div>

            <div>
              <label htmlFor="ultimaTramitacao" className="block text-sm font-medium text-gray-700">Última Tramitação</label>
              <input type="date" id="ultimaTramitacao" value={ultimaTramitacao} onChange={e => setUltimaTramitacao(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 px-3 border" />
              <p className="mt-1 text-xs text-gray-500">
                Dias no setor atual: <span className="font-semibold text-gray-900">{ultimaTramitacao ? Math.max(0, differenceInDays(new Date(), new Date(`${ultimaTramitacao}T00:00:00`))) : 0} dias</span>
              </p>
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
                placeholder="Descrição resumida do objeto da aquisição"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">
                Observações
              </label>
              <textarea
                id="descricao"
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
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
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              Salvar Processo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
