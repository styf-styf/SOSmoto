create table if not exists payphone_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  raw_body text,
  extracted jsonb,
  created_at timestamptz not null default now()
);
