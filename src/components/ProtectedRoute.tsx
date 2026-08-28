import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function ProtectedRoute() {
  const { isAuthenticated, carregandoAuth } = useApp();

  // Enquanto o Firebase resolve a sessão, não redireciona (evita "piscar"
  // a tela pública e derrubar o usuário logado em um F5).
  if (carregandoAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
