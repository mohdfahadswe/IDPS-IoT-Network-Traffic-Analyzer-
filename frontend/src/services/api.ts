import axios from 'axios';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for attaching Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('netpulse_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for catching 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('netpulse_token');
        localStorage.removeItem('netpulse_user');
      }
    }
    return Promise.reject(error);
  }
);

// Service Endpoints
export const authService = {
  login: (credentials: any) => apiClient.post('/auth/login', credentials),
  register: (data: any) => apiClient.post('/auth/register', data),
  forgotPassword: (data: any) => apiClient.post('/auth/forgot-password', data),
  getMe: () => apiClient.get('/auth/me'),
};

export const deviceService = {
  getDevices: (params?: any) => apiClient.get('/devices', { params }),
  getDeviceDetail: (id: string) => apiClient.get(`/devices/${id}`),
  executeAction: (id: string, data: any) => apiClient.post(`/devices/${id}/action`, data),
};

export const trafficService = {
  getHistory: (range = '30m', deviceId?: string) =>
    apiClient.get(`/traffic/history`, { params: { range, device_id: deviceId || undefined } }),
  getRecentPackets: (limit = 20) => apiClient.get(`/traffic/recent-packets?limit=${limit}`),
};

export const alertService = {
  getAlerts: (params?: any) => apiClient.get('/alerts', { params }),
  getAlertDetail: (id: string) => apiClient.get(`/alerts/${id}`),
  updateStatus: (id: string, status: string) => apiClient.patch(`/alerts/${id}`, { status }),
};

export const domainService = {
  getDomains: (params?: any) => apiClient.get('/domains', { params }),
  getDomainDetail: (name: string) => apiClient.get(`/domains/${name}`),
};

export const blockingService = {
  getBlockedEntities: (includeExpired = false) => apiClient.get(`/blocking?include_expired=${includeExpired}`),
  blockEntity: (data: any) => apiClient.post('/blocking/block', data),
  unblockEntity: (id: string) => apiClient.post(`/blocking/unblock/${id}`),
  getAuditLog: (limit = 50) => apiClient.get(`/blocking/audit-log?limit=${limit}`),
};

export const analyticsService = {
  getAnalytics: (days = 7) => apiClient.get(`/analytics?days=${days}`),
  getModelInfo: () => apiClient.get('/analytics/model-info'),
};

export const reportService = {
  getSummary: (days = 30) => apiClient.get(`/reports/summary?days=${days}`),
  getExportUrl: (type = 'alerts', days = 30) => `/api/reports/export-csv?report_type=${type}&days=${days}`,
};

export const simulationService = {
  getStatus: () => apiClient.get('/simulation/status'),
  start: (params?: any) => apiClient.post('/simulation/start', params),
  stop: () => apiClient.post('/simulation/stop'),
  triggerScenario: (scenario: string, deviceId?: string) =>
    apiClient.post('/simulation/trigger-scenario', { scenario, device_id: deviceId }),
  getBurstStatus: () => apiClient.get('/simulation/burst/status'),
  startBurst: (deviceId = 'esp32-001') => apiClient.post(`/simulation/burst/start?device_id=${deviceId}`),
  stopBurst: () => apiClient.post('/simulation/burst/stop'),
  toggleBurst: (deviceId = 'esp32-001') => apiClient.post(`/simulation/burst/toggle?device_id=${deviceId}`),
};

export const settingsService = {
  getSettings: () => apiClient.get('/settings'),
  updateSettings: (data: any) => apiClient.post('/settings', data),
  resetDefaults: () => apiClient.post('/settings/reset-defaults'),
};
