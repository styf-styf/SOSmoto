-- Texto personalizable del boton de link del anuncio (ej. "WhatsApp",
-- "Sitio web") en vez del "Ver mas" fijo -- obligatorio del lado de la app
-- cuando el negocio agrega un link_url, pero se guarda nullable acá porque
-- los anuncios ya creados antes de esta migracion no lo tienen.
alter table ads add column link_label text;
