export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface Device {
  id: number;
  device_id: string;
  name: string;
  type: string;
  ip_address: string;
  mac_address?: string;
  status: 'online' | 'offline' | 'suspicious' | 'temporarily_blocked' | 'blocked';
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  risk_score: number;
  source: 'real' | 'simulated';
  sensor_type?: string;
  latest_sensor_data?: Record<string, any>;
  first_seen: string;
  last_seen: string;
}

export interface DeviceEvent {
  id: number;
  timestamp: string;
  traffic_volume: number;
  packet_count: number;
  request_frequency: number;
  protocol: string;
  port: number;
  is_suspicious: boolean;
  risk_score: number;
  reasons?: string[];
}

export interface Alert {
  id: number;
  alert_id: string;
  timestamp: string;
  device_id?: string;
  device_name?: string;
  source_ip: string;
  alert_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  risk_score: number;
  status: 'New' | 'Acknowledged' | 'Resolved';
  action_taken: string;
}

export interface DomainItem {
  id: number;
  domain_name: string;
  overall_risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  request_count: number;
  risk_explanation?: string;
  first_seen: string;
  last_seen: string;
  connected_devices?: string[];
}

export interface BlockedEntity {
  id: number;
  entity_type: 'device' | 'ip';
  entity_id: string;
  ip_address?: string;
  reason: string;
  is_temporary: boolean;
  block_start: string;
  expiry_time?: string;
  is_active: boolean;
  time_remaining_seconds?: number;
}

export interface TrafficPoint {
  timestamp: string;
  bytes_in: number;
  bytes_out: number;
  total_bytes: number;
  packets: number;
  is_suspicious: boolean;
  source_ip?: string;
  protocol?: string;
  device_name?: string;
  device_id?: string;
}

export interface TrafficSummary {
  total_bytes_in: number;
  total_bytes_out: number;
  suspicious_flows: number;
  total_samples: number;
}

export interface AnalyticsData {
  kpis: {
    total_devices: number;
    active_devices: number;
    threats_detected: number;
    blocked_entities: number;
    total_traffic_bytes?: number;
    avg_fleet_risk?: number;
  };
  severity_distribution: Record<string, number>;
  threat_types?: Array<{
    name: string;
    count: number;
  }>;
  protocols?: Array<{
    protocol: string;
    count: number;
    bytes: number;
  }>;
  daily_trends: Array<{
    date: string;
    timestamp?: string;
    total_threats: number;
    critical_threats: number;
    traffic_kb?: number;
  }>;
  suspicious_devices: Array<{
    device_id: string;
    name: string;
    type: string;
    ip_address?: string;
    risk_score: number;
    risk_level: string;
    status: string;
    last_seen?: string;
  }>;
  top_risk_domains: Array<{
    domain_name: string;
    category: string;
    risk_score: number;
    risk_level: string;
    request_count: number;
    last_seen?: string;
  }>;
  device_types: Array<{
    type: string;
    count: number;
  }>;
  meta?: {
    current_time: string;
    time_window: string;
    start_time: string;
    end_time: string;
  };
}

export interface SystemSettings {
  general: {
    platform_name: string;
    timezone: string;
    version: string;
  };
  detection: {
    traffic_threshold_bytes: number;
    detection_sensitivity: string;
    rf_confidence_threshold: number;
  };
  automatic_response: {
    enabled: boolean;
    high_risk_threshold: number;
    critical_risk_threshold: number;
    default_temp_block_minutes: number;
  };
  simulation: {
    speed: string;
    device_count: number;
    is_running: boolean;
  };
}
