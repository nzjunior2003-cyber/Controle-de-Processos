import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FileText, PieChart, Package, CheckSquare, Users, Menu, FileCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const location = useLocation();
  const { usuarioAtual } = useApp();

  const perfil = usuarioAtual?.perfil;
  const isMaster = perfil === 'master';
  
  const navigation = [
    { name: 'Início', href: '/sistema', icon: Home, show: true },
    { name: 'Apoio e Suprimento', href: '/sistema/apoio', icon: Package, show: isMaster || perfil === 'apoio' },
    { name: 'Contratos e ARP\'s', href: '/sistema/contratos-arps', icon: FileText, show: isMaster || perfil === 'contratos' },
    { name: 'Gestão de Contratos', href: '/sistema/gestao-contratos', icon: CheckSquare, show: isMaster || perfil === 'gestao' },
    { name: 'Fiscal do Contrato', href: '/sistema/fiscal-contrato', icon: FileCheck, show: isMaster || perfil === 'fiscal' },
    { name: 'Dashboard Corporativo', href: '/sistema/dashboard', icon: PieChart, show: true },
    { name: 'Usuários', href: '/sistema/usuarios', icon: Users, show: isMaster },
  ].filter(item => item.show);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar relative container for desktop */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 bg-slate-900 border-r border-slate-800 text-slate-300 transform transition-all duration-300 ease-in-out h-full md:relative md:flex flex-col overflow-hidden",
        sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-0 md:translate-x-0 md:w-16"
      )}>
        
        <div className="p-4 flex flex-col space-y-6 flex-1 overflow-y-auto mt-2">
          <div>
            <div className={cn("flex items-center mb-4 px-2", sidebarOpen ? "justify-between" : "justify-center")}>
              {sidebarOpen && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider transition-all duration-300">
                  Módulos do Sistema
                </p>
              )}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none transition-colors"
                title={sidebarOpen ? "Recolher menu" : "Expandir menu"}
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            <nav className={cn("space-y-1 mt-2", sidebarOpen ? "block" : "hidden")}>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => {
                      if (window.innerWidth < 768) setSidebarOpen(false);
                    }}
                    className={cn(
                      isActive
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-300',
                        'flex-shrink-0 h-5 w-5 mr-3 transition-colors'
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate opacity-100 w-auto">
                      {item.name}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
