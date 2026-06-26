-- Mantiene businesses.rating_avg sincronizado con el promedio de reviews públicas.
create or replace function public.update_business_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_business_id uuid;
begin
  target_business_id := coalesce(new.reviewed_business_id, old.reviewed_business_id);
  if target_business_id is null then
    return coalesce(new, old);
  end if;

  update businesses
  set rating_avg = coalesce((
    select round(avg(rating)::numeric, 2)
    from reviews
    where reviewed_business_id = target_business_id and is_public = true
  ), 0)
  where id = target_business_id;

  return coalesce(new, old);
end;
$$;

create trigger on_review_change
  after insert or update or delete on reviews
  for each row execute function public.update_business_rating();
