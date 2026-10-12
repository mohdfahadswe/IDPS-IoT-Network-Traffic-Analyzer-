import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { simulationService } from '../services/api';
import { useWebSocket } from './WebSocketContext';

export interface SimulatedDeviceItem {
  device_id: string;
  name: string;
  type: string;
}

interface SimulationContextType {
  isSimulating: boolean;
  isBursting: boolean;
  speed: 'slow' | 'normal' | 'fast';
  loading: boolean;
  burstLoading: boolean;
  deviceCount: number;
  simulatedDevices: SimulatedDeviceItem[];
  toggleSimulation: () => Promise<boolean>;
  startSimulation: (speed?: 'slow' | 'normal' | 'fast') => Promise<boolean>;
  stopSimulation: () => Promise<boolean>;
  changeSpeed: (newSpeed: 'slow' | 'normal' | 'fast') => Promise<void>;
  triggerScenario: (scenario: string, deviceId?: string) => Promise<any>;
  toggleDemoBurst: (deviceId?: string) => Promise<boolean>;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isBursting, setIsBursting] = useState<boolean>(false);
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [deviceCount, setDeviceCount] = useState<number>(6);
  const [simulatedDevices, setSimulatedDevices] = useState<SimulatedDeviceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [burstLoading, setBurstLoading] = useState<boolean>(false);
  const { subscribe } = useWebSocket();

  // Fetch initial status from backend on mount
  const fetchStatus = useCallback(async () => {
    try {
      const [simRes, burstRes] = await Promise.allSettled([
        simulationService.getStatus(),
        simulationService.getBurstStatus()
      ]);
      if (simRes.status === 'fulfilled' && simRes.value.data) {
        setIsSimulating(!!simRes.value.data.is_running);
        if (simRes.value.data.speed) setSpeed(simRes.value.data.speed);
        if (simRes.value.data.device_count) setDeviceCount(simRes.value.data.device_count);
        if (simRes.value.data.devices) setSimulatedDevices(simRes.value.data.devices);
      }
      if (burstRes.status === 'fulfilled' && burstRes.value.data) {
        setIsBursting(!!burstRes.value.data.is_bursting);
      }
    } catch (err) {
      console.error('Failed to fetch initial simulation status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Sync real-time status across all tabs/components via WebSocket
  useEffect(() => {
    const unsubSim = subscribe('SIMULATION_STATUS', (data: any) => {
      if (data) {
        if (typeof data.is_running === 'boolean') {
          setIsSimulating(data.is_running);
        }
        if (data.speed) {
          setSpeed(data.speed);
        }
      }
    });

    const unsubBurst = subscribe('SIMULATION_BURST_STATUS', (data: any) => {
      if (data && typeof data.is_bursting === 'boolean') {
        setIsBursting(data.is_bursting);
      }
    });

    return () => {
      unsubSim();
      unsubBurst();
    };
  }, [subscribe]);

  const startSimulation = async (customSpeed?: 'slow' | 'normal' | 'fast'): Promise<boolean> => {
    setLoading(true);
    try {
      const targetSpeed = customSpeed || speed;
      const res = await simulationService.start({ speed: targetSpeed });
      setIsSimulating(true);
      if (targetSpeed) setSpeed(targetSpeed);
      return res.data?.status === 'success';
    } catch (err) {
      console.error('Failed to start simulation:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const stopSimulation = async (): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await simulationService.stop();
      setIsSimulating(false);
      return res.data?.status === 'success';
    } catch (err) {
      console.error('Failed to stop simulation:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleSimulation = async (): Promise<boolean> => {
    if (isSimulating) {
      return await stopSimulation();
    } else {
      return await startSimulation();
    }
  };

  const changeSpeed = async (newSpeed: 'slow' | 'normal' | 'fast') => {
    setSpeed(newSpeed);
    if (isSimulating) {
      await startSimulation(newSpeed);
    }
  };

  const triggerScenario = async (scenario: string, deviceId?: string) => {
    try {
      const res = await simulationService.triggerScenario(scenario, deviceId);
      return res.data?.result;
    } catch (err) {
      console.error(`Failed to trigger scenario ${scenario}:`, err);
      throw err;
    }
  };

  const toggleDemoBurst = async (deviceId: string = 'esp32-001'): Promise<boolean> => {
    setBurstLoading(true);
    try {
      const res = await simulationService.toggleBurst(deviceId);
      const active = !!res.data?.is_bursting;
      setIsBursting(active);
      return active;
    } catch (err) {
      console.error('Failed to toggle demo burst:', err);
      return false;
    } finally {
      setBurstLoading(false);
    }
  };

  return (
    <SimulationContext.Provider
      value={{
        isSimulating,
        isBursting,
        speed,
        loading,
        burstLoading,
        deviceCount,
        simulatedDevices,
        toggleSimulation,
        startSimulation,
        stopSimulation,
        changeSpeed,
        triggerScenario,
        toggleDemoBurst,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
