import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import PublicHome from './pages/PublicHome';
import SistemaHome from './pages/SistemaHome';
import Aquisicoes from './pages/Aquisicoes';
import NovoProcesso from './pages/NovoProcesso';
import Dashboard from './pages/Dashboard';
import DetalheProcesso from './pages/DetalheProcesso';
import ContratosArps from './pages/contratos-arps';
import GestaoContratos from './pages/gestao-contratos';
import ContratoForm from './pages/gestao-contratos/ContratoForm';
import Usuarios from './pages/Usuarios';
import ProtectedRoute from './components/ProtectedRoute';
import FiscalContrato from './pages/fiscal-contrato';
import Auditoria from './pages/auditoria';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicHome />} />

            <Route path="/sistema" element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<SistemaHome />} />
                <Route path="apoio" element={<Aquisicoes />} />
                <Route path="contratos-arps" element={<ContratosArps />} />
                <Route path="gestao-contratos" element={<GestaoContratos />} />
                <Route path="gestao-contratos/novo" element={<ContratoForm />} />
                <Route path="gestao-contratos/:id/editar" element={<ContratoForm />} />
                <Route path="fiscal-contrato" element={<FiscalContrato />} />
                <Route path="aquisicoes" element={<Aquisicoes />} />
                <Route path="processos/novo" element={<NovoProcesso />} />
                <Route path="processos/:id/editar" element={<NovoProcesso />} />
                <Route path="processos/:id" element={<DetalheProcesso />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="auditoria" element={<Auditoria />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}
