-- Los anuncios dejan de ser un banner suelto (imagen + texto libre) y pasan
-- a anunciar un producto/servicio real (o uno creado solo para el anuncio,
-- sin que aparezca en el catálogo normal del negocio) -- necesario para que
-- el anuncio pueda "competir" como resultado al buscar ese mismo
-- producto/servicio (ver services/ads.ts searchActiveAds).
alter table ads add column kind text not null default 'product' check (kind in ('product', 'service'));
alter table ads add column category_id uuid references categories(id);
-- Nombre del producto/servicio anunciado, usado para el match de búsqueda
-- (ilike, igual que products.name/services.name) -- distinto de `title`,
-- que sigue siendo el texto promocional libre ("20% de descuento hoy").
alter table ads add column item_name text;
update ads set item_name = title where item_name is null;
alter table ads alter column item_name set not null;

-- Si el negocio elige anunciar algo "ya publicado" en su catálogo, se guarda
-- la referencia real (por ahora solo informativo -- no se usa para mostrar
-- stock ni nada más). Si el anuncio se creó solo para la campaña, ambos
-- quedan en null.
alter table ads add column product_id uuid references products(id) on delete set null;
alter table ads add column service_id uuid references services(id) on delete set null;
alter table ads add constraint ads_single_catalog_link check (product_id is null or service_id is null);
alter table ads add constraint ads_kind_matches_link check (
  (kind = 'product' and service_id is null) or
  (kind = 'service' and product_id is null)
);

-- image_url (una sola foto) -> photos (arreglo, 1 a 3 fotos, igual que
-- products/services) -- obligatorio subir al menos una imagen al crear.
alter table ads add column photos text[] not null default '{}';
update ads set photos = array[image_url] where image_url is not null and coalesce(array_length(photos, 1), 0) = 0;
alter table ads drop column image_url;
