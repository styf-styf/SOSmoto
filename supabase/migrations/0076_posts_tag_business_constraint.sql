-- Antes: el tag del negocio solo podía apuntar a servicio/producto propio.
-- Ahora: tanto cliente como negocio etiquetan solo negocios (tag_business_id).
-- tag_service_id y tag_product_id quedan en el esquema pero sin uso.

-- Limpiar datos previos con etiquetas de servicio/producto (entorno de desarrollo)
update posts set tag_service_id = null, tag_product_id = null
where tag_service_id is not null or tag_product_id is not null;

-- Reemplazar constraint
alter table posts drop constraint posts_tag_check;
alter table posts add constraint posts_tag_check check (
  tag_service_id is null and tag_product_id is null
);
