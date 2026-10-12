import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Activity,
  AlertTriangle,
  Globe,
  ShieldBan,
  BarChart3,
  FileSpreadsheet,
  Settings,
  LogOut,
  Radio,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useSettings } from '../../contexts/SettingsContext';

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuth();
  const { isOpen, setIsOpen, toggleSidebar } = useSidebar();
  const { platformName } = useSettings();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Devices', path: '/devices', icon: Cpu },
    { label: 'Network Activity', path: '/traffic', icon: Activity },
    { label: 'Alerts', path: '/alerts', icon: AlertTriangle },
    { label: 'Domains', path: '/domains', icon: Globe },
    { label: 'Blocked Entities', path: '/blocking', icon: ShieldBan },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* Main Sliding / Collapsible Sidebar Dock */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 select-none
          border-r border-slate-800 shadow-2xl lg:shadow-md
          transition-all duration-300 ease-in-out
          ${
            isOpen
              ? 'w-64 translate-x-0'
              : '-translate-x-full lg:translate-x-0 lg:w-20'
          }
        `}
      >
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Platform Branding & Toggle Header */}
          <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
            {isOpen ? (
              <>
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                    <Radio className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div className="truncate min-w-0 pr-1">
                    <h1 className="font-bold text-white text-sm tracking-tight leading-none truncate" title={platformName || 'NetPulse IoT'}>
                      {platformName || 'NetPulse IoT'}
                    </h1>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium tracking-wide uppercase">Security Platform</p>
                  </div>
                </div>

                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                  title="Collapse Sidebar (Three lines)"
                  aria-label="Collapse Sidebar"
                >
                  <Menu className="w-5 h-5 text-slate-300 hover:text-indigo-400 transition-colors" />
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-center">
                <button
                  onClick={toggleSidebar}
                  className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shadow-xs group"
                  title="Expand Sidebar (Three lines)"
                  aria-label="Expand Sidebar"
                >
                  <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={!isOpen ? item.label : undefined}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setIsOpen(false);
                    }
                  }}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      !isOpen ? 'justify-center px-0' : 'px-3.5'
                    } ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110 duration-200" />
                  {isOpen && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* User Profile / Logout Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 shrink-0">
            {isOpen ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 truncate pr-1">
                  <div
                    className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 shrink-0 shadow-xs"
                    title={`${user?.full_name || 'Admin User'} (${user?.email || 'admin@example.com'})`}
                  >
                    {user?.full_name?.charAt(0) || 'A'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">{user?.full_name || 'Admin User'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@example.com'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
