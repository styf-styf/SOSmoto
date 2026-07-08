-- Permite etiquetar un cliente (motociclista) además de un negocio en un post.
-- Constraint: solo uno de los dos (cliente O negocio) puede estar etiquetado.

alter table posts add column tag_client_id uuid references users(id) on delete set null;
create index posts_tag_client_id_idx on posts(tag_client_id);

alter table posts drop constraint posts_tag_check;
alter table posts add constraint posts_tag_check check (
  tag_service_id is null
  and tag_product_id is null
  and (tag_client_id is null or tag_business_id is null)
);
