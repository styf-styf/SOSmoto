-- El auxilio en carretera no tiene prioridad por plan: todos los talleres
-- dentro del radio de cobertura reciben la solicitud por igual (la unica
-- diferencia es el radio configurado). El tipo 'upgrade_plan_priority_matching'
-- describia un beneficio que nunca existio en el codigo; se elimina del
-- catalogo de tipos validos antes de que se genere alguna sugerencia con el.
alter table growth_suggestions drop constraint growth_suggestions_type_check;
alter table growth_suggestions add constraint growth_suggestions_type_check check (type in (
  'upgrade_plan_limit_reached',
  'upgrade_plan_near_limit',
  'advertise_low_visibility',
  'advertise_new_business'
));
