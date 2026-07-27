-- Permite reportar un comentario de publicación individual, no solo la
-- publicación entera -- reusa la misma tabla polimórfica de reports (post,
-- review, business, product, service) ya usada para el resto de contenido.
alter table reports drop constraint reports_target_type_check;
alter table reports add constraint reports_target_type_check
  check (target_type in ('post', 'review', 'business', 'product', 'service', 'comment'));
