alter table service_reports
  add column if not exists status text not null default 'sent'
  check (status in ('draft', 'sent'));
