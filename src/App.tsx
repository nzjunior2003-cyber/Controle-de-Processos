import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/layout/Layout';
import PublicHome from './pages/PublicHome';
import SistemaHome from './pages/SistemaHome';
import Aquisicoes from './pages/Aquisicoes';
import NovoProcesso from './pages/NovoProcesso';
import Dashboard from './pages/Dashboard';
import DetalheProcesso from './pages/DetalheProcesso';
import ContratosArps from './pages/ContratosArps';
import GestaoContratos from './pages/GestaoContratos';
import Usuarios from './pages/Usuarios';
import IntegracaoPCA from './pages/IntegracaoPCA';
import ProtectedRoute from './components/ProtectedRoute';
import FiscalContrato from './pages/FiscalContrato';

export default function App() {
  return (
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
               <Route path="fiscal-contrato" element={<FiscalContrato />} />
               <Route path="aquisicoes" element={<Aquisicoes />} />
               <Route path="processos/novo" element={<NovoProcesso />} />
               <Route path="processos/:id" element={<DetalheProcesso />} />
               <Route path="dashboard" element={<Dashboard />} />
               <Route path="usuarios" element={<Usuarios />} />
             </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
