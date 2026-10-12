import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { SimulationProvider } from './contexts/SimulationContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Layout } from './components/layout/Layout';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { DeviceDetail } from './pages/DeviceDetail';
import { NetworkActivity } from './pages/NetworkActivity';
import { Alerts } from './pages/Alerts';
import { Domains } from './pages/Domains';
import { BlockedEntities } from './pages/BlockedEntities';
import { Analytics } from './pages/Analytics';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-xs font-semibold text-slate-500">
        Authenticating session...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <WebSocketProvider>
          <SimulationProvider>
            <NotificationProvider>
              <SidebarProvider>
                <BrowserRouter>
                  <Routes>
                    {/* Public Auth Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected Enterprise Routes */}
                    <Route
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/devices" element={<Devices />} />
                      <Route path="/devices/:id" element={<DeviceDetail />} />
                      <Route path="/traffic" element={<NetworkActivity />} />
                      <Route path="/network-activity" element={<NetworkActivity />} />
                      <Route path="/alerts" element={<Alerts />} />
                      <Route path="/domains" element={<Domains />} />
                      <Route path="/blocking" element={<BlockedEntities />} />
                      <Route path="/blocked-entities" element={<BlockedEntities />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>

                    {/* Default Catch-all */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </BrowserRouter>
              </SidebarProvider>
            </NotificationProvider>
          </SimulationProvider>
        </WebSocketProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
