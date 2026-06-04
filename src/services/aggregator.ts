import { supabase } from '../lib/supabase';
import { db } from './auditDb';

// Aggregates raw logs from Dexie and uploads them to Supabase
export async function runAggregationAndUpload(): Promise<void> {
  try {
    const rawEvents = await db.metricEvents.toArray();
    if (rawEvents.length === 0) {
      console.log('No raw metric events to aggregate and upload.');
      return;
    }

    // Determine the highest ID we fetched to safely delete only these records later
    const maxId = Math.max(...rawEvents.map((e) => e.id!).filter(id => id !== undefined));

    const aggregates: Record<string, {
      hour: string;
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
      call_count: number;
      total_bytes: number;
      total_duration_ms: number;
      status_code: number;
      is_meta: boolean;
    }> = {};

    for (const event of rawEvents) {
      // Round down to the start of the hour
      const date = new Date(event.ts);
      date.setMinutes(0, 0, 0);
      date.setSeconds(0, 0);
      date.setMilliseconds(0);
      const hourStr = date.toISOString();

      // Create unique key for the hourly dimensions combination
      const key = [
        hourStr,
        event.user_id || '',
        event.role || '',
        event.location || '',
        event.device_id,
        event.page,
        event.client_kind,
        event.http_method,
        event.table_name || '',
        event.columns_key || '',
        event.filter_key || '',
        event.status,
        event.is_meta ? 'true' : 'false',
      ].join('|');

      if (!aggregates[key]) {
        aggregates[key] = {
          hour: hourStr,
          user_id: event.user_id,
          role: event.role,
          location: event.location,
          device_id: event.device_id,
          page: event.page,
          client_kind: event.client_kind,
          http_method: event.http_method,
          table_name: event.table_name,
          columns_key: event.columns_key,
          filter_key: event.filter_key,
          call_count: 0,
          total_bytes: 0,
          total_duration_ms: 0,
          status_code: event.status,
          is_meta: event.is_meta,
        };
      }

      aggregates[key].call_count += 1;
      aggregates[key].total_bytes += event.bytes;
      aggregates[key].total_duration_ms += event.duration_ms;
    }

    const rows = Object.values(aggregates);
    console.log(`Aggregated ${rawEvents.length} raw events into ${rows.length} hourly buckets.`);

    // Batch upload to Supabase in chunks of 200
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('audit_metrics_hourly').insert(chunk);
      if (error) {
        throw new Error(`Failed to upload chunk: ${error.message}`);
      }
    }

    // Delete processed events from Dexie by ID (avoids race conditions)
    await db.metricEvents.where('id').belowOrEqual(maxId).delete();
    console.log(`Successfully completed egress metrics aggregation and upload.`);
  } catch (err) {
    console.error('Error running metrics aggregator:', err);
  }
}

// Configures and starts the background upload scheduler
export function startMetricsScheduler(): () => void {
  console.log('Initializing Egress Audit Metrics Scheduler...');

  // 1. Fire immediately on application boot
  runAggregationAndUpload().catch((err) => console.error('Initial aggregator run failed:', err));

  // 2. Fire every 6 hours while the application remains open
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const intervalId = setInterval(() => {
    runAggregationAndUpload().catch((err) => console.error('Scheduled aggregator run failed:', err));
  }, SIX_HOURS_MS);

  // 3. Electron Quit Handling via Exposed Desktop IPC
  const hasDesktopIpc = typeof window !== 'undefined' && (window as any).desktop;
  if (hasDesktopIpc) {
    const desktop = (window as any).desktop;
    if (desktop.onFlushMetrics && desktop.sendMetricsFlushed) {
      desktop.onFlushMetrics(async () => {
        console.log('Quit signal received. Flushing offline metric logs...');
        try {
          await runAggregationAndUpload();
        } catch (err) {
          console.error('Failed to flush metrics on quit:', err);
        } finally {
          desktop.sendMetricsFlushed();
        }
      });
    }
  }

  // Web fallback window beforeunload
  const handleBeforeUnload = () => {
    // Fire-and-forget sync/async flush
    runAggregationAndUpload().catch((err) => console.error('Beforeunload metrics flush failed:', err));
  };
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return a cleanup/destructor function
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
