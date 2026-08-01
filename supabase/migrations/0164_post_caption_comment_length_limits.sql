-- Límite de caracteres para publicaciones y comentarios -- no existía
-- ninguno, ni en la app (TextInput sin maxLength) ni acá (columnas `text`
-- sin restricción). Se agrega en los dos lados: maxLength en la app evita
-- que se pueda escribir de más, esta constraint evita que alguien lo salte
-- pegando directo a la API.
--
-- 1000 en publicaciones -- alcanza para describir servicios con detalle o
-- contar una anécdota completa, sin abrir la puerta a un texto gigante.
-- 300 en comentarios -- una opinión o sugerencia puntual, no un párrafo.
alter table posts
  add constraint posts_caption_length check (char_length(caption) <= 1000);

alter table post_comments
  add constraint post_comments_body_length check (char_length(body) <= 300);
