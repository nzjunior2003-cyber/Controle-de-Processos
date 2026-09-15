import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Lock, Mail, User, Briefcase, Hash, Search, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buscarMilitares, carregarMilitares, formatarNomeMilitar, type Militar } from '../lib/militares';
import FormField from './ui/FormField';

type ModalView = 'login' | 'buscarAcesso' | 'completarCadastro' | 'solicitar' | 'esqueci';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, solicitarAcesso, enviarResetSenha, firebaseConfigurado } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<ModalView>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  // Login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Solicitar acesso
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [mf, setMf] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');

  // Buscar meu acesso (validação de MF/nome contra a planilha de militares)
  const [termoBusca, setTermoBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<Militar[] | null>(null);
  const [militarConfirmado, setMilitarConfirmado] = useState<Militar | null>(null);

  const trocarView = (nova: ModalView) => {
    setErro(null);
    setView(nova);
  };

  const handleBuscarAcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setBuscando(true);
    try {
      const militares = await carregarMilitares();
      const encontrados = buscarMilitares(militares, termoBusca, 6);
      setResultadosBusca(encontrados);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar a planilha de militares agora.',
      );
    } finally {
      setBuscando(false);
    }
  };

  const handleConfirmarMilitar = (militar: Militar) => {
    setMilitarConfirmado(militar);
    setNome(militar.nome);
    setCargo(militar.cargo);
    setMf(militar.mf);
    trocarView('completarCadastro');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await login(email, senha);
      onClose();
      navigate('/sistema');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      setAguardando(false);
    }
  };

  const handleSolicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (newSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newSenha !== confirmSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setAguardando(true);
    try {
      await solicitarAcesso({ nome, email, senha: newSenha, cargo, mf: mf.trim() || undefined });
      alert('Solicitação enviada com sucesso! Aguarde a aprovação pelo administrador.');
      setNome('');
      setCargo('');
      setMf('');
      setNewSenha('');
      setConfirmSenha('');
      setMilitarConfirmado(null);
      setResultadosBusca(null);
      setTermoBusca('');
      trocarView('login');
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.',
      );
    } finally {
      setAguardando(false);
    }
  };

  const handleEsqueci = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    try {
      await enviarResetSenha(email);
      alert(
        `Se houver uma conta para ${email}, um link de redefinição de senha foi enviado. Verifique sua caixa de entrada e o spam.`,
      );
      trocarView('login');
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.',
      );
    } finally {
      setAguardando(false);
    }
  };

  const classeBotaoPrimario =
    'w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {view === 'login' && 'Acesso ao Sistema'}
            {view === 'buscarAcesso' && 'Buscar meu Acesso'}
            {view === 'completarCadastro' && 'Completar Cadastro'}
            {view === 'solicitar' && 'Solicitar Acesso'}
            {view === 'esqueci' && 'Recuperar Senha'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!firebaseConfigurado && (
          <div className="mx-6 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            O Firebase ainda não foi configurado neste ambiente. Defina as variáveis
            <span className="font-mono"> VITE_FIREBASE_*</span> no arquivo{' '}
            <span className="font-mono">.env</span> (veja o README) para habilitar o login.
          </div>
        )}

        {erro && (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {erro}
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="p-6 space-y-6">
            <FormField
              label="Email ou MF"
              icon={Mail}
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com ou sua matrícula"
            />

            <div>
              <FormField
                label="Senha"
                icon={Lock}
                type="password"
                showToggle
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
              />
              <div className="flex justify-start mt-2">
                <button
                  type="button"
                  onClick={() => trocarView('esqueci')}
                  className="text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Esqueci a senha
                </button>
              </div>
            </div>

            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Entrando...' : 'Entrar'}
            </button>
            <div className="text-center mt-4 border-t pt-4">
              <p className="text-sm text-gray-600">Não possui conta?</p>
              <button
                type="button"
                onClick={() => {
                  setResultadosBusca(null);
                  setTermoBusca('');
                  trocarView('buscarAcesso');
                }}
                className="mt-2 w-full flex justify-center py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Solicitar Acesso
              </button>
            </div>
          </form>
        )}

        {view === 'buscarAcesso' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Digite seu nome ou sua MF (matrícula) — se você já é Fiscal Titular ou Suplente de
              algum contrato, isso faz esses contratos aparecerem automaticamente pra você assim
              que o acesso for aprovado.
            </p>
            <form onSubmit={handleBuscarAcesso} className="flex gap-2">
              <div className="flex-1">
                <FormField
                  label="Nome ou MF"
                  icon={Search}
                  type="text"
                  required
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Seu nome completo ou sua matrícula"
                />
              </div>
              <button
                type="submit"
                disabled={buscando}
                className="mt-6 h-fit px-4 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                {buscando ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            {resultadosBusca && resultadosBusca.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Selecione o seu registro:</p>
                {resultadosBusca.map((militar, indice) => (
                  <button
                    key={indice}
                    type="button"
                    onClick={() => handleConfirmarMilitar(militar)}
                    className="w-full text-left px-4 py-3 rounded-md border border-gray-200 hover:border-red-300 hover:bg-red-50"
                  >
                    <p className="text-sm font-medium text-gray-900">{formatarNomeMilitar(militar)}</p>
                    <p className="text-xs text-gray-500">MF: {militar.mf || '—'} · UBM: {militar.ubm || '—'}</p>
                  </button>
                ))}
              </div>
            )}

            {resultadosBusca && resultadosBusca.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Não encontramos ninguém com esse nome/matrícula na planilha de efetivo. Você pode
                preencher seus dados manualmente — um master vai revisar antes de aprovar.
              </div>
            )}

            <div className="text-center pt-2 space-y-2">
              {resultadosBusca && resultadosBusca.length === 0 && (
                <button
                  type="button"
                  onClick={() => trocarView('solicitar')}
                  className="w-full flex justify-center py-2 px-4 border border-red-200 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                >
                  Preencher manualmente
                </button>
              )}
              <button
                type="button"
                onClick={() => trocarView('login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Voltar para o Login
              </button>
            </div>
          </div>
        )}

        {view === 'completarCadastro' && militarConfirmado && (
          <form onSubmit={handleSolicitar} className="p-6 space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Matrícula encontrada no efetivo do CBMPA</p>
                <p className="text-sm text-emerald-700">{formatarNomeMilitar(militarConfirmado)}</p>
                <p className="text-xs text-emerald-700">MF: {militarConfirmado.mf || '—'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMilitarConfirmado(null);
                trocarView('buscarAcesso');
              }}
              className="text-sm font-medium text-red-600 hover:text-red-500"
            >
              Não é você? Buscar novamente
            </button>
            <FormField
              label="Email"
              icon={Mail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Senha (mín. 6)"
                icon={Lock}
                type="password"
                required
                minLength={6}
                value={newSenha}
                onChange={(e) => setNewSenha(e.target.value)}
                placeholder="••••••"
              />
              <FormField
                label="Confirmar Senha"
                icon={Lock}
                type="password"
                required
                minLength={6}
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={aguardando}
              className={`${classeBotaoPrimario} mt-2`}
            >
              {aguardando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
          </form>
        )}

        {view === 'solicitar' && (
          <form onSubmit={handleSolicitar} className="p-6 space-y-4">
            <FormField
              label="Nome Completo"
              icon={User}
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome completo"
            />
            <FormField
              label="Cargo / Patente"
              icon={Briefcase}
              type="text"
              required
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: 1º TEN QOABM"
            />
            <FormField
              label="MF (matrícula)"
              icon={Hash}
              type="text"
              value={mf}
              onChange={(e) => setMf(e.target.value)}
              placeholder="Sua matrícula funcional"
            />
            <p className="-mt-2 text-xs text-gray-500">
              Se você já é Fiscal Titular ou Suplente de algum contrato, informar a MF faz esses
              contratos aparecerem automaticamente pra você assim que o acesso for aprovado.
            </p>
            <FormField
              label="Email"
              icon={Mail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Senha (mín. 6)"
                icon={Lock}
                type="password"
                required
                minLength={6}
                value={newSenha}
                onChange={(e) => setNewSenha(e.target.value)}
                placeholder="••••••"
              />
              <FormField
                label="Confirmar Senha"
                icon={Lock}
                type="password"
                required
                minLength={6}
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={aguardando}
              className={`${classeBotaoPrimario} mt-2`}
            >
              {aguardando ? 'Enviando...' : 'Enviar Solicitação'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => trocarView('login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'esqueci' && (
          <form onSubmit={handleEsqueci} className="p-6 space-y-6">
            <p className="text-sm text-gray-600">
              Digite seu e-mail cadastrado. Você receberá um link seguro para cadastrar
              uma nova senha.
            </p>
            <FormField
              label="Email"
              icon={Mail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@email.com"
            />

            <button type="submit" disabled={aguardando} className={classeBotaoPrimario}>
              {aguardando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
            <div className="text-center mt-2">
              <button
                type="button"
                onClick={() => trocarView('login')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
