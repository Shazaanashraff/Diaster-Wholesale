const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Parse .env file manually (pure Node.js)
const dotenvPath = path.join(__dirname, '../.env');
if (!fs.existsSync(dotenvPath)) {
  console.error('Error: .env file not found at ' + dotenvPath);
  process.exit(1);
}

const env = {};
const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
for (const line of lines) {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) continue;
  const parts = cleanLine.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing from .env');
  process.exit(1);
}

console.log('Using Supabase Instance:', supabaseUrl);

// Helper function to perform HTTPS request and return metrics (latency, bytes, payload)
function performRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = https.request(options, (res) => {
      let dataChunks = [];
      res.on('data', (chunk) => {
        dataChunks.push(chunk);
      });
      res.on('end', () => {
        const buffer = Buffer.concat(dataChunks);
        const duration = Math.round(performance.now() - start);
        resolve({
          statusCode: res.statusCode,
          bytes: buffer.byteLength,
          duration,
          data: buffer.toString('utf8'),
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  const urlObj = new URL(supabaseUrl);
  const hostname = urlObj.hostname;

  // Retrieve total queries count from CLI argument (default to 200)
  const totalQueriesTarget = parseInt(process.argv[2], 10) || 200;
  const countPerCase = Math.max(1, Math.floor(totalQueriesTarget / 4));

  console.log(`\n--- 🚀 Running Simulation Fetches (Total: ${countPerCase * 4} queries) ---`);

  const testCases = [
    {
      name: 'Optimized Product Query (select subset)',
      path: '/rest/v1/products?select=id,item_code,name,wholesale_price,retail_price&limit=10',
      method: 'GET',
      table: 'products',
      cols: 'id,item_code,name,wholesale_price,retail_price',
      filter: 'limit',
      body: null,
      count: countPerCase,
    },
    {
      name: 'Legacy-style Product Query (select wildcard *)',
      path: '/rest/v1/products?select=*&limit=10',
      method: 'GET',
      table: 'products',
      cols: '*',
      filter: 'limit',
      body: null,
      count: countPerCase,
    },
    {
      name: 'Dashboard Metrics RPC Call',
      path: '/rest/v1/rpc/get_dashboard_metrics',
      method: 'POST',
      table: 'rpc:get_dashboard_metrics',
      cols: null,
      filter: null,
      body: { limit_val: 10 },
      count: countPerCase,
    },
    {
      name: 'Stock Valuation RPC Call',
      path: '/rest/v1/rpc/get_stock_valuation_report',
      method: 'POST',
      table: 'rpc:get_stock_valuation_report',
      cols: null,
      filter: null,
      body: {},
      count: countPerCase,
    }
  ];

  const rawEvents = [];

  for (const tc of testCases) {
    console.log(`\nExecuting "${tc.name}" ${tc.count} times...`);
    let totalBytesForCase = 0;
    let totalDurationForCase = 0;

    for (let i = 0; i < tc.count; i++) {
      const headers = {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      };
      if (tc.body) {
        headers['Content-Type'] = 'application/json';
      }

      const options = {
        hostname,
        path: tc.path,
        method: tc.method,
        headers,
      };

      try {
        const result = await performRequest(options, tc.body);
        totalBytesForCase += result.bytes;
        totalDurationForCase += result.duration;

        rawEvents.push({
          ts: Date.now(),
          user_id: 'cli-developer',
          role: 'developer',
          location: 'CLI Environment',
          device_id: '00000000-0000-0000-0000-000000000000', // CLI standard UUID
          page: '/cli-simulation-script',
          client_kind: 'anon',
          http_method: tc.method,
          table_name: tc.table,
          columns_key: tc.cols,
          filter_key: tc.filter,
          bytes: result.bytes,
          duration_ms: result.duration,
          status: result.statusCode,
          is_meta: false,
        });
      } catch (err) {
        console.error(`Failed executing ${tc.name}:`, err.message);
      }
    }

    const avgBytes = Math.round(totalBytesForCase / tc.count);
    const avgDuration = Math.round(totalDurationForCase / tc.count);
    console.log(`  -> Average Egress Size: ${avgBytes} bytes`);
    console.log(`  -> Average Latency: ${avgDuration} ms`);
  }

  console.log('\n--- 📊 Aggregating and Uploading Metrics to Supabase ---');

  // Aggregate into hourly rows
  const aggregates = {};
  for (const event of rawEvents) {
    const date = new Date(event.ts);
    date.setMinutes(0, 0, 0);
    date.setMilliseconds(0);
    const hourStr = date.toISOString();

    const key = [
      hourStr,
      event.user_id,
      event.role,
      event.location,
      event.device_id,
      event.page,
      event.client_kind,
      event.http_method,
      event.table_name || '',
      event.columns_key || '',
      event.filter_key || '',
      event.status,
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
  console.log(`Aggregated ${rawEvents.length} operations into ${rows.length} record(s).`);

  // Insert aggregates into audit_metrics_hourly
  const insertOptions = {
    hostname,
    path: '/rest/v1/audit_metrics_hourly',
    method: 'POST',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  };

  try {
    const response = await performRequest(insertOptions, rows);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('✅ Success: Metrics uploaded successfully!');
      console.log('\n--- 💡 How to check in the Dashboard ---');
      console.log('1. Run your developer build and log in using PIN "9999".');
      console.log('2. Navigate to the "Developer Portal" in the sidebar.');
      console.log('3. In the "Egress Metrics" tab, check:');
      console.log('   - Filter the page to: "/cli-simulation-script"');
      console.log('   - Or filter by user/role: "developer" / "cli-developer"');
      console.log('   - The database requests you triggered are now charted and visible live!');
    } else {
      console.error(`❌ Upload failed: Status Code ${response.statusCode}`, response.data);
    }
  } catch (err) {
    console.error('❌ Upload failed with error:', err.message);
  }
}

run();
