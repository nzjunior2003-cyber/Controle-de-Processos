import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 font-sans">
      <Header setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 flex flex-col w-full relative">
          {/*
            Filho extra com w-full explícito: como `main` é flex, um filho
            direto com `mx-auto` (usado em toda tela para centralizar) para
            de esticar para 100% da largura e passa a encolher pelo
            conteúdo — cada tela ficava com uma largura diferente. Este
            wrapper garante 100% da largura antes do mx-auto de cada tela
            entrar em cena, num contexto de bloco normal (não mais flex).
          */}
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
