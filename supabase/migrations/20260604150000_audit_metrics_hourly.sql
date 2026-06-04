-- ================================================================
-- Diastar ERP — Egress Audit & Query Performance Monitoring Table
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_metrics_hourly (
  id BIGSERIAL PRIMARY KEY,
  hour TIMESTAMPTZ NOT NULL,
  user_id TEXT,
  role TEXT,
  location TEXT,
  device_id UUID NOT NULL,
  page TEXT,
  client_kind TEXT NOT NULL,
  http_method TEXT NOT NULL,
  table_name TEXT,
  columns_key TEXT,
  filter_key TEXT,
  call_count INTEGER NOT NULL DEFAULT 1,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  total_duration_ms BIGINT NOT NULL DEFAULT 0,
  status_code INTEGER,
  is_meta BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS and add public/anon permissive policy
ALTER TABLE audit_metrics_hourly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All access audit_metrics_hourly" ON audit_metrics_hourly;
CREATE POLICY "All access audit_metrics_hourly" ON audit_metrics_hourly FOR ALL USING (true) WITH CHECK (true);

-- Create indexes on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_audit_metrics_hourly_hour ON audit_metrics_hourly(hour);
CREATE INDEX IF NOT EXISTS idx_audit_metrics_hourly_device_id ON audit_metrics_hourly(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_metrics_hourly_table_name ON audit_metrics_hourly(table_name);
