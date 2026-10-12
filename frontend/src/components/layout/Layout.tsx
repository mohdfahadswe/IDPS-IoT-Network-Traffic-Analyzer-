import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NotificationPopup } from '../common/NotificationPopup';
import { useSidebar } from '../../contexts/SidebarContext';

export const Layout: React.FC = () => {
  const { isOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sliding Sidebar */}
      <Sidebar />

      {/* Main Content Area that smoothly shifts when sidebar slides */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isOpen ? 'lg:pl-64' : 'lg:pl-20'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <NotificationPopup />
    </div>
  );
};

