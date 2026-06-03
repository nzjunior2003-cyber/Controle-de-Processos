import React from 'react';
import { Link } from 'react-router-dom';
import { Package, FileText, CheckSquare, Search, Users, FileCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function SistemaHome() {
  const { usuarioAtual } = useApp();
  const perfil = usuarioAtual?.perfil;
  const isMaster = perfil === 'master';

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Módulos do Sistema</h1>
        <p className="mt-1 text-sm text-gray-500">
          Acesse os módulos disponíveis para o seu perfil corporativo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {(isMaster || perfil === 'apoio') && (
          <Link to="/sistema/apoio" className="bg-white group rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-red-300 hover:ring-1 hover:ring-red-100 transition-all flex flex-col items-center text-center">
            <div className="bg-orange-50 text-orange-600 p-3 rounded-full group-hover:bg-orange-600 group-hover:text-white transition-colors mb-2 sm:mb-3">
              <Package className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-red-700">Apoio e Suprimento</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Gerenciamento de aquisições de materiais e estoques.</p>
          </Link>
        )}

        {(isMaster || perfil === 'contratos') && (
          <Link to="/sistema/contratos-arps" className="bg-white group rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-red-300 hover:ring-1 hover:ring-red-100 transition-all flex flex-col items-center text-center">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors mb-2 sm:mb-3">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-red-700">Contratos e ARP's</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Atas de Registro de Preço e elaboração de contratos.</p>
          </Link>
        )}

        {(isMaster || perfil === 'gestao') && (
          <Link to="/sistema/gestao-contratos" className="bg-white group rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-red-300 hover:ring-1 hover:ring-red-100 transition-all flex flex-col items-center text-center">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-2 sm:mb-3">
              <CheckSquare className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-red-700">Gestão de Contratos</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Acompanhamento e fiscalização dos contratos em vigor.</p>
          </Link>
        )}

        {(isMaster || perfil === 'fiscal') && (
          <Link to="/sistema/fiscal-contrato" className="bg-white group rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-red-300 hover:ring-1 hover:ring-red-100 transition-all flex flex-col items-center text-center">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors mb-2 sm:mb-3">
              <FileCheck className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-red-700">Fiscal do Contrato</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Acompanhe contratos de sua responsabilidade, adicione eventos e ocorrências.</p>
          </Link>
        )}

        {isMaster && (
          <Link to="/sistema/usuarios" className="bg-white group rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 hover:shadow-md hover:border-red-300 hover:ring-1 hover:ring-red-100 transition-all flex flex-col items-center text-center">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors mb-2 sm:mb-3">
              <Users className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-red-700">Administração</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Gestão de acessos e usuários do sistema.</p>
          </Link>
        )}
      </div>

      <div className="mt-6 md:mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4 flex items-center">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-gray-400" />
          Acesso Rápido - Processos Globais
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 sm:text-sm py-2 sm:py-3 px-3 sm:px-4 border bg-gray-50 focus:border-red-500 focus:ring-red-500"
            placeholder="Digite o número do processo, objeto..."
          />
          <button className="bg-gray-800 text-white px-6 py-2 rounded-md hover:bg-gray-900 font-medium transition-colors w-full sm:w-auto">
            Buscar
          </button>
        </div>
      </div>
    </div>
  );
}
