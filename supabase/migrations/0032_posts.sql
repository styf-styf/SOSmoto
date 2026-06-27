-- Publicaciones permanentes (no expiran, a diferencia de stories) con
-- comentarios, para clientes y negocios. Mismo patrón de dueño polimórfico
-- (business_id o client_id, nunca ambos) que stories (0030_client_stories.sql).
create table posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  client_id uuid references users(id) on delete cascade,
  image_url text not null,
  caption text,
  -- el cliente etiqueta un negocio; el negocio etiqueta un servicio o
  -- producto de su propio catálogo -- nunca ambos tipos a la vez.
  tag_business_id uuid references businesses(id) on delete set null,
  tag_service_id uuid references services(id) on delete set null,
  tag_product_id uuid references products(id) on delete set null,
  comments_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint posts_owner_check check (
    (business_id is not null and client_id is null) or (client_id is not null and business_id is null)
  ),
  constraint posts_tag_check check (
    (client_id is not null and tag_service_id is null and tag_product_id is null)
    or (business_id is not null and tag_business_id is null)
  )
);
create index posts_business_id_idx on posts(business_id);
create index posts_client_id_idx on posts(client_id);
create index posts_created_at_idx on posts(created_at desc);

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index post_comments_post_id_idx on post_comments(post_id);

create or replace function increment_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set comments_count = comments_count + 1 where id = new.post_id;
  return new;
end;
$$;

create trigger post_comments_increment
after insert on post_comments
for each row execute function increment_post_comments_count();

alter table posts enable row level security;

create policy posts_select_all on posts for select using (true);
create policy posts_insert_own on posts for insert
  with check (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
  );
create policy posts_delete_own_or_admin on posts for delete
  using (
    (business_id is not null and is_business_staff(business_id))
    or (client_id is not null and client_id = auth.uid())
    or is_admin()
  );

alter table post_comments enable row level security;

create policy post_comments_select_all on post_comments for select using (true);
create policy post_comments_insert_own on post_comments for insert with check (author_id = auth.uid());
create policy post_comments_delete_own_or_admin on post_comments for delete
  using (author_id = auth.uid() or is_admin());

-- Storage: imágenes de publicaciones de cliente, mismo patrón que
-- client-stories (0030_client_stories.sql). Las de negocio reusan la ruta
-- {business_id}/... ya cubierta por public_images_insert_staff (0031).
create policy "public_images_insert_posts_client" on storage.objects for insert
  with check (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "public_images_delete_posts_client" on storage.objects for delete
  using (
    bucket_id = 'public-images'
    and (storage.foldername(name))[1] = 'posts'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
