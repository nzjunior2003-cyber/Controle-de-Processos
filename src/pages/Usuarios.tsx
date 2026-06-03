import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, UserPlus, Shield, Info, Edit2, X, Trash2 } from 'lucide-react';
import { PERFIL_LABELS, Perfil, Usuario } from '../types';

export default function Usuarios() {
  const { usuarios, setores, updateUsuario, deleteUsuario, usuarioAtual, addUsuario } = useApp();
  const [busca, setBusca] = useState('');
  
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [isNovoUsuarioOpen, setIsNovoUsuarioOpen] = useState(false);
  
  const [novoUsuarioForm, setNovoUsuarioForm] = useState({
    nome: '',
    email: '',
    senha: '',
    perfil: 'fiscal' as Perfil,
    setor_id: setores[0]?.id || '1',
    ativo: true,
  });

  const [usuarioExcluindo, setUsuarioExcluindo] = useState<string | null>(null);

  const confirmDelete = () => {
    if (usuarioExcluindo) {
      deleteUsuario(usuarioExcluindo);
      setUsuarioExcluindo(null);
    }
  };

  if (usuarioAtual?.perfil !== 'master') {
    return (
      <div className="p-8 text-center text-gray-500">
        Você não tem permissão para acessar este módulo.
      </div>
    );
  }

  const filtrados = usuarios.filter(u => 
    u.nome.toLowerCase().includes(busca.toLowerCase()) || 
    u.email.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (usuarioEditando) {
      updateUsuario(usuarioEditando.id, {
        perfil: usuarioEditando.perfil,
        ativo: usuarioEditando.ativo
      });
      setUsuarioEditando(null);
    }
  };

  const handleCriarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    const { nome, email, senha, perfil, setor_id, ativo } = novoUsuarioForm;
    if (!nome || !email || !senha) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }
    
    addUsuario({
      nome,
      email,
      senha,
      perfil,
      setor_id,
      cargo: 'Não Especificado',
      ativo
    });

    setIsNovoUsuarioOpen(false);
    setNovoUsuarioForm({
      nome: '',
      email: '',
      senha: '',
      perfil: 'fiscal' as Perfil,
      setor_id: setores[0]?.id || '1',
      ativo: true,
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administração de Usuários</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie os acessos, permissões e perfis dos servidores.</p>
        </div>
        <button
          onClick={() => setIsNovoUsuarioOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800"
        >
          <UserPlus className="-ml-1 mr-2 h-5 w-5" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="block w-full rounded-md border-gray-300 pl-10 focus:border-red-500 focus:ring-red-500 sm:text-sm py-2 border"
              placeholder="Buscar por nome ou email..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Módulo/Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum usuário encontrado.</td>
                </tr>
              ) : (
                filtrados.map((u) => {
                  const setor = setores.find(s => s.id === u.setor_id);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{u.nome}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          {u.perfil === 'master' ? <Shield className="w-4 h-4 text-purple-600 mr-2" /> : <Info className="w-4 h-4 text-gray-400 mr-2" />}
                          <span className={u.perfil === 'master' ? 'font-semibold text-purple-700' : ''}>
                            {PERFIL_LABELS[u.perfil as Perfil] || u.perfil}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {setor?.sigla} - {setor?.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setUsuarioEditando({...u})}
                          className="text-red-600 hover:text-red-900 mr-4"
                          title="Editar Usuário"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setUsuarioExcluindo(u.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {usuarioEditando && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setUsuarioEditando(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Acessos do Usuário</h3>
            
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900">{usuarioEditando.nome}</p>
              <p className="text-sm text-gray-500">{usuarioEditando.email}</p>
            </div>

            <form onSubmit={handleSalvarEdicao} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Módulo / Perfil de Acesso
                </label>
                <select
                  value={usuarioEditando.perfil}
                  onChange={(e) => setUsuarioEditando({...usuarioEditando, perfil: e.target.value as Perfil})}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md border"
                >
                  {Object.entries(PERFIL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Define qual módulo este usuário poderá acessar e editar. Administradores Master têm acesso total.
                </p>
              </div>

              <div className="flex items-center mt-4">
                <input
                  id="ativo"
                  type="checkbox"
                  checked={usuarioEditando.ativo}
                  onChange={(e) => setUsuarioEditando({...usuarioEditando, ativo: e.target.checked})}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="ativo" className="ml-2 block text-sm text-gray-900">
                  Usuário Ativo no Sistema
                </label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setUsuarioEditando(null)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Novo Usuario Modal */}
      {isNovoUsuarioOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
            <button 
              onClick={() => setIsNovoUsuarioOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Usuário</h3>

            <form onSubmit={handleCriarUsuario} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={novoUsuarioForm.nome}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, nome: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={novoUsuarioForm.email}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, email: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial (Mín: 6 caracteres)</label>
                <input
                  type="password"
                  required
                  value={novoUsuarioForm.senha}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, senha: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                <select
                  value={novoUsuarioForm.setor_id}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, setor_id: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                >
                  {setores.map(setor => (
                    <option key={setor.id} value={setor.id}>{setor.sigla} - {setor.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Módulo / Perfil de Acesso</label>
                <select
                  value={novoUsuarioForm.perfil}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, perfil: e.target.value as Perfil})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                >
                  {Object.entries(PERFIL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center mt-4">
                <input
                  id="novoAtivo"
                  type="checkbox"
                  checked={novoUsuarioForm.ativo}
                  onChange={(e) => setNovoUsuarioForm({...novoUsuarioForm, ativo: e.target.checked})}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="novoAtivo" className="ml-2 block text-sm text-gray-900">
                  Usuário Ativo (Aprovado)
                </label>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNovoUsuarioOpen(false)}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      {usuarioExcluindo && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirmar Exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setUsuarioExcluindo(null)}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
