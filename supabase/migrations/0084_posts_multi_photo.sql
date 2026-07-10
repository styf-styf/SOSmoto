-- Publicaciones con varias fotos (carrusel), igual que products/services --
-- reemplaza image_url (una sola) por photos (array). Tope fijo de 5 fotos
-- por publicación para todos (clientes y negocios), sin ligarlo a ningún
-- plan de suscripción -- solo aplica a productos/servicios.
alter table posts add column photos text[] not null default '{}';
update posts set photos = array[image_url] where image_url is not null;
alter table posts drop column image_url;
