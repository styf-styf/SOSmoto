-- KYC: solicitudes de verificación de negocio (cédula/RUC + foto del local),
-- revisadas por un admin desde el panel web. Se permite más de una solicitud
-- por negocio (reintentos tras un rechazo) -- la más reciente determina el
-- estado vigente; `businesses.is_verified` solo se activa cuando un admin
-- aprueba.
create type kyc_status as enum ('pending_review', 'approved', 'rejected');

create table business_verification_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  id_document_path text not null,
  ruc_document_path text,
  storefront_photo_path text not null,
  notes text,
  status kyc_status not null default 'pending_review',
  admin_notes text,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index business_verification_requests_business_id_idx on business_verification_requests(business_id);

alter table business_verification_requests enable row level security;

create policy business_verification_requests_select on business_verification_requests for select using (
  is_business_staff(business_id) or is_admin()
);
create policy business_verification_requests_insert on business_verification_requests for insert with check (
  is_business_staff(business_id)
);
create policy business_verification_requests_update_admin on business_verification_requests for update using (
  is_admin()
);

-- Bucket privado (a diferencia de public-images): son documentos de
-- identidad, no deben quedar públicamente accesibles por URL adivinable. El
-- admin panel genera URLs firmadas de corta duración con el service role
-- para mostrarlos; el dueño/staff del negocio solo puede leer lo que subió.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "kyc_documents_insert_staff" on storage.objects for insert
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );

create policy "kyc_documents_select_staff_or_admin" on storage.objects for select
  using (
    bucket_id = 'kyc-documents'
    and (
      (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and is_business_staff(((storage.foldername(name))[1])::uuid)
      )
      or is_admin()
    )
  );

create policy "kyc_documents_delete_staff" on storage.objects for delete
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and is_business_staff(((storage.foldername(name))[1])::uuid)
  );
