import { db, getOrCreateDeviceId, type MetricEvent } from './auditDb';

export async function captureFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const startTs = Date.now();
  const startTime = performance.now();

  // Perform the actual network fetch call
  const responsePromise = window.fetch(input, init);

  // Fire-and-forget raw event logging asynchronously
  responsePromise.then(
    async (response) => {
      const durationMs = Math.round(performance.now() - startTime);

      // Clone the response to read the array buffer safely without consuming the body
      let bytes = 0;
      try {
        const cloned = response.clone();
        const buffer = await cloned.arrayBuffer();
        bytes = buffer.byteLength;
      } catch (err) {
        // Safe fallback in case arrayBuffer fails
      }

      await logMetricEvent(input, init, startTs, durationMs, bytes, response.status);
    },
    async () => {
      const durationMs = Math.round(performance.now() - startTime);
      // Status 0 represents a network error / request failure
      await logMetricEvent(input, init, startTs, durationMs, 0, 0);
    }
  );

  return responsePromise;
}

async function logMetricEvent(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ts: number,
  durationMs: number,
  bytes: number,
  status: number
) {
  try {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Only capture requests targetting our Supabase database instance
    if (!urlStr.includes('supabase.co')) {
      return;
    }

    const url = new URL(urlStr);
    const http_method = (init?.method || 'GET').toUpperCase();

    // Parse the target table name, view name, or RPC function
    let table_name: string | null = null;
    const pathParts = url.pathname.split('/');
    const v1Index = pathParts.indexOf('v1');
    if (v1Index !== -1 && pathParts[v1Index + 1]) {
      if (pathParts[v1Index + 1] === 'rpc') {
        table_name = `rpc:${pathParts[v1Index + 2] || ''}`;
      } else {
        table_name = pathParts[v1Index + 1];
      }
    } else if (url.pathname.includes('/auth/v1')) {
      table_name = 'auth';
    } else if (url.pathname.includes('/storage/v1')) {
      table_name = 'storage';
    } else {
      table_name = pathParts[pathParts.length - 1] || 'unknown';
    }

    // Parse and sort the select columns parameter alphabetically
    const selectParam = url.searchParams.get('select');
    let columns_key: string | null = null;
    if (selectParam) {
      columns_key = selectParam
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .sort()
        .join(',');
    }

    // Parse and sort other query filter keys (omitting values for privacy)
    const filterKeys: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (key !== 'select' && key !== 'apikey') {
        filterKeys.push(key);
      }
    });
    const filter_key = filterKeys.length > 0 ? filterKeys.sort().join(',') : null;

    // Detect client kind (anon public client vs admin/service_role client)
    let client_kind = 'anon';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    let reqApiKey: string | null = url.searchParams.get('apikey');
    if (!reqApiKey && init?.headers) {
      const headers = new Headers(init.headers);
      reqApiKey = headers.get('apikey');
    }
    if (reqApiKey && reqApiKey !== anonKey) {
      client_kind = 'service_role';
    }

    // Parse page layout / active route path
    let page = window.location.hash || window.location.pathname || '/';
    if (page.startsWith('#')) {
      page = page.substring(1);
    }
    const qIdx = page.indexOf('?');
    if (qIdx !== -1) {
      page = page.substring(0, qIdx);
    }
    if (!page.startsWith('/')) {
      page = '/' + page;
    }

    // Determine if this call originates from the egress audit module itself
    const is_meta = page === '/developer' || page.startsWith('/developer/') || table_name === 'audit_metrics_hourly';

    // Retrieve user and session context
    const role = sessionStorage.getItem('user_role') || 'admin';
    const user_id = sessionStorage.getItem('user_id') || role;
    const location = sessionStorage.getItem('user_location') || localStorage.getItem('user_location') || 'Shop';

    const device_id = getOrCreateDeviceId();

    const event: MetricEvent = {
      ts,
      user_id,
      role,
      location,
      device_id,
      page,
      client_kind,
      http_method,
      table_name,
      columns_key,
      filter_key,
      bytes,
      duration_ms: durationMs,
      status,
      is_meta,
    };

    // Save to the local Dexie.js app-offline database
    await db.metricEvents.add(event);
  } catch (err) {
    console.error('Error logging metric event:', err);
  }
}
