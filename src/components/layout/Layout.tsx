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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
