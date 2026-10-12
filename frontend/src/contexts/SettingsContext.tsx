import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/api';
import { SystemSettings } from '../types';

interface SettingsContextType {
  platformName: string;
  setPlatformName: (name: string) => void;
  settings: SystemSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updatePlatformName: (name: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [platformName, setPlatformNameState] = useState<string>(() => {
    return localStorage.getItem('netpulse_platform_name') || 'NetPulse IoT';
  });
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const updatePlatformName = (name: string) => {
    const cleanName = name?.trim() || 'NetPulse IoT';
    setPlatformNameState(cleanName);
    localStorage.setItem('netpulse_platform_name', cleanName);
    document.title = cleanName;
  };

  const refreshSettings = async () => {
    try {
      const res = await settingsService.getSettings();
      const s: any = res.data;
      setSettings(s);
      if (s?.general?.platform_name) {
        updatePlatformName(s.general.platform_name);
      }
    } catch (err) {
      console.error('Failed to load system settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        platformName,
        setPlatformName: updatePlatformName,
        settings,
        loading,
        refreshSettings,
        updatePlatformName,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
