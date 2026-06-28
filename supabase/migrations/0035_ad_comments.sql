-- Comentarios en anuncios (ads): el anuncio ahora se ve y se comporta como
-- una publicación del feed (mismo patrón de comments_count + trigger que
-- posts/post_comments en 0032_posts.sql), para darle más alcance al negocio
-- que paga por publicidad.
alter table ads add column comments_count int not null default 0;

create table ad_comments (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references ads(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index ad_comments_ad_id_idx on ad_comments(ad_id);

create or replace function increment_ad_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update ads set comments_count = comments_count + 1 where id = new.ad_id;
  return new;
end;
$$;

create trigger ad_comments_increment
after insert on ad_comments
for each row execute function increment_ad_comments_count();

alter table ad_comments enable row level security;

create policy ad_comments_select_all on ad_comments for select using (true);
create policy ad_comments_insert_own on ad_comments for insert with check (author_id = auth.uid());
create policy ad_comments_delete_own_or_admin on ad_comments for delete
  using (author_id = auth.uid() or is_admin());
