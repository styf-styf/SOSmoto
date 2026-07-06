alter table business_clients
  add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted', 'rejected'));
