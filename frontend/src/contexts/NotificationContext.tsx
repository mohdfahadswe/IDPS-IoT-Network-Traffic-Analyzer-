import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Alert } from '../types';
import { alertService } from '../services/api';
import { useWebSocket } from './WebSocketContext';

interface NotificationContextType {
  alerts: Alert[];
  unreadCount: number;
  activePopup: Alert | null;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  toggleDropdown: () => void;
  dismissPopup: () => void;
  markAllAsRead: () => void;
  markAsRead: (alertId: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set());
  const [activePopup, setActivePopup] = useState<Alert | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const { subscribe } = useWebSocket();
  const popupTimerRef = useRef<any>(null);

  // Load initial alerts from backend
  const loadAlerts = useCallback(async () => {
    try {
      const res = await alertService.getAlerts({ limit: 15 });
      const fetchedAlerts: Alert[] = res.data?.alerts || [];
      setAlerts(fetchedAlerts);
    } catch (err) {
      console.error('Failed to load initial notifications:', err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Real-time WebSocket Alert Listener
  useEffect(() => {
    const unsubscribe = subscribe('NEW_ALERT', (newAlert: Alert) => {
      setAlerts((prev) => [newAlert, ...prev.filter((a) => a.alert_id !== newAlert.alert_id).slice(0, 24)]);
      
      // Show WhatsApp/OS style popup
      setActivePopup(newAlert);

      // Auto-dismiss popup after 8 seconds if not interacted
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => {
        setActivePopup(null);
      }, 8000);
    });

    return () => {
      unsubscribe();
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, [subscribe]);

  const dismissPopup = useCallback(() => {
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    setActivePopup(null);
  }, []);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => {
      const next = !prev;
      // When opening the notification dropdown, immediately dismiss the floating popup
      if (next) {
        dismissPopup();
      }
      return next;
    });
  }, [dismissPopup]);

  const markAllAsRead = useCallback(() => {
    setReadAlertIds(new Set(alerts.map((a) => a.alert_id)));
  }, [alerts]);

  const markAsRead = useCallback((alertId: string) => {
    setReadAlertIds((prev) => new Set([...prev, alertId]));
  }, []);

  const unreadCount = alerts.filter((a) => !readAlertIds.has(a.alert_id)).length;

  return (
    <NotificationContext.Provider
      value={{
        alerts,
        unreadCount,
        activePopup,
        isDropdownOpen,
        setIsDropdownOpen: (open: boolean) => {
          if (open) dismissPopup();
          setIsDropdownOpen(open);
        },
        toggleDropdown,
        dismissPopup,
        markAllAsRead,
        markAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
