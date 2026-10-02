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
import RelatorioAuditoriaContrato from './pages/gestao-contratos/RelatorioAuditoria';
import Usuarios from './pages/Usuarios';
import ProtectedRoute from './components/ProtectedRoute';
import FiscalContrato from './pages/fiscal-contrato';
import GerenciarExecucaoFiscal from './pages/fiscal-contrato/GerenciarExecucao';
import Auditoria from './pages/auditoria';
import Planejamento from './pages/planejamento';
import IrpForm from './pages/planejamento/IrpForm';
import PlanoContratacaoAnual from './pages/pca';
import PcaForm from './pages/pca/PcaForm';
import RelatorioPca from './pages/pca/RelatorioPca';
import Financeiro from './pages/financeiro';
import PagamentoForm from './pages/financeiro/PagamentoForm';
import DotacaoForm from './pages/financeiro/DotacaoForm';
import EmpenhoForm from './pages/financeiro/EmpenhoForm';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicHome />} />

            <Route path="/sistema" element={<ProtectedRoute />}>
              {/* Sem o Layout (sidebar/topo) — pensada pra impressão limpa. */}
              <Route
                path="gestao-contratos/:id/relatorio"
                element={<RelatorioAuditoriaContrato />}
              />
              <Route path="pca/relatorio" element={<RelatorioPca />} />
              <Route element={<Layout />}>
                <Route index element={<SistemaHome />} />
                <Route path="apoio" element={<Aquisicoes />} />
                <Route path="contratos-arps" element={<ContratosArps />} />
                <Route path="gestao-contratos" element={<GestaoContratos />} />
                <Route path="gestao-contratos/novo" element={<ContratoForm />} />
                <Route path="gestao-contratos/:id/editar" element={<ContratoForm />} />
                <Route path="fiscal-contrato" element={<FiscalContrato />} />
                <Route path="fiscal-contrato/:id/gerenciar" element={<GerenciarExecucaoFiscal />} />
                <Route path="aquisicoes" element={<Aquisicoes />} />
                <Route path="processos/novo" element={<NovoProcesso />} />
                <Route path="processos/:id/editar" element={<NovoProcesso />} />
                <Route path="processos/:id" element={<DetalheProcesso />} />
                <Route path="planejamento" element={<Planejamento />} />
                <Route path="planejamento/novo" element={<IrpForm />} />
                <Route path="planejamento/:id/editar" element={<IrpForm />} />
                <Route path="pca" element={<PlanoContratacaoAnual />} />
                <Route path="pca/novo" element={<PcaForm />} />
                <Route path="pca/:id/editar" element={<PcaForm />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="financeiro/pagamentos/novo" element={<PagamentoForm />} />
                <Route path="financeiro/pagamentos/:id/editar" element={<PagamentoForm />} />
                <Route path="financeiro/empenhos/novo" element={<EmpenhoForm />} />
                <Route path="financeiro/empenhos/:id/editar" element={<EmpenhoForm />} />
                <Route path="financeiro/dotacoes/novo" element={<DotacaoForm />} />
                <Route path="financeiro/dotacoes/:id/editar" element={<DotacaoForm />} />
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
