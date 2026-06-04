import Dexie, { type Table } from 'dexie';

export interface MetricEvent {
  id?: number;
  ts: number;
  user_id: string | null;
  role: string | null;
  location: string | null;
  device_id: string;
  page: string;
  client_kind: string;
  http_method: string;
  table_name: string | null;
  columns_key: string | null;
  filter_key: string | null;
  bytes: number;
  duration_ms: number;
  status: number;
  is_meta: boolean;
}

class AppOfflineDatabase extends Dexie {
  metricEvents!: Table<MetricEvent>;

  constructor() {
    super('app-offline');
    this.version(1).stores({
      metricEvents: '++id, ts, device_id, table_name, is_meta'
    });
  }
}

export const db = new AppOfflineDatabase();

// A simple RFC4122 v4 compliant UUID generator to avoid dependency overhead
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Persisted UUID v4 for the physical terminal
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem('app_device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('app_device_id', deviceId);
  }
  return deviceId;
}
