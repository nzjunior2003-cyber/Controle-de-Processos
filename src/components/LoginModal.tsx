import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, User, Briefcase } from 'lucide-react';
import { useApp } from '../context/AppContext';

type ModalView = 'login' | 'solicitar' | 'esqueci';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, addUsuario, usuarios } = useApp();
  const navigate = useNavigate();
  
  const [view, setView] = useState<ModalView>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  
  // Solicitar Accesso State
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email, senha);
    if (success) {
      onClose();
      navigate('/sistema');
    }
  };

  const handleSolicitar = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSenha.length !== 6) {
      alert("A senha deve ter exatamente 6 dígitos.");
      return;
    }
    if (newSenha !== confirmSenha) {
      alert("As senhas não coincidem.");
      return;
    }
    
    addUsuario({
      nome,
      email,
      cargo,
      senha: newSenha,
      perfil: 'fiscal', // Default applied, master can change
      setor_id: '1', // Default demandante
      ativo: false
    });
    
    alert("Solicitação enviada com sucesso! Aguarde a aprovação pelo administrador.");
    setView('login');
  };

  const [isSending, setIsSending] = useState(false);

  const handleEsqueci = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = usuarios.find(u => u.email === email);
    if (user) {
      setIsSending(true);
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email,
            subject: 'Sua senha do Sistema',
            text: `Olá ${user.nome},\n\nSua senha de acesso ao sistema é: ${user.senha || '123456 (senha padrão)'}\n\nAtenciosamente,\nEquipe do Sistema`,
          }),
        });
        
        const data = await response.json();
        
        if (data.success) {
          alert(data.mock ? "Simulação de envio (mock). Adicione variáveis SMTP no Settings > API Keys (.env) da plataforma para envio real." : `Email enviado com sucesso para ${email}!`);
          setView('login');
        } else {
          alert('Erro ao enviar email: ' + (data.error || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Email error:', error);
        alert('Erro ao conectar ao servidor de email.');
      } finally {
        setIsSending(false);
      }
    } else {
      alert("Email não encontrado.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {view === 'login' && 'Acesso ao Sistema'}
            {view === 'solicitar' && 'Solicitar Acesso'}
            {view === 'esqueci' && 'Recuperar Senha'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {view === 'login' && (
          <form onSubmit={handleLogin} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="usuario@email.com"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-start mt-2">
                <button type="button" onClick={() => setView('esqueci')} className="text-sm font-medium text-red-600 hover:text-red-500">
                  Esqueci a senha
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Entrar
            </button>
            <div className="text-center mt-4 border-t pt-4">
              <p className="text-sm text-gray-600">Não possui conta?</p>
              <button type="button" onClick={() => setView('solicitar')} className="mt-2 w-full flex justify-center py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                Solicitar Acesso
              </button>
            </div>
          </form>
        )}

        {view === 'solicitar' && (
          <form onSubmit={handleSolicitar} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="Seu nome completo"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Patente</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="Ex: 1º TEN QOABM"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="usuario@email.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha (6 dígitos)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={newSenha}
                    onChange={(e) => setNewSenha(e.target.value)}
                    className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    value={confirmSenha}
                    onChange={(e) => setConfirmSenha(e.target.value)}
                    className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors mt-2"
            >
              Enviar Solicitação
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => setView('login')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'esqueci' && (
          <form onSubmit={handleEsqueci} className="p-6 space-y-6">
            <p className="text-sm text-gray-600">
              Digite seu email cadastrado para receber sua senha.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                  placeholder="usuario@email.com"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isSending}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50"
            >
              {isSending ? 'Enviando...' : 'Enviar Senha'}
            </button>
            <div className="text-center mt-2">
              <button type="button" onClick={() => setView('login')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
