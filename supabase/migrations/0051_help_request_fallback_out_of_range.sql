-- Si ningun taller tiene al cliente dentro de su radio de cobertura
-- configurado, la solicitud de auxilio se quedaba sin nadie a quien
-- notificar. Esta columna marca las notificaciones generadas por el
-- fallback (los N talleres mas cercanos, sin importar su radio) para que la
-- UI pueda explicar por que les llego una solicitud fuera de su zona.
alter table help_request_notifications add column out_of_range boolean not null default false;
