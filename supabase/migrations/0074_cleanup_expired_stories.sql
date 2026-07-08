-- Borra físicamente las historias expiradas (>24h, no fijadas) cada hora.
-- Las story_views se eliminan por CASCADE (on delete cascade en story_views.story_id).
-- Las imágenes en Storage quedan huérfanas por ahora — se limpiará con una
-- Edge Function de Storage cleanup en una fase posterior.
select cron.schedule(
  'cleanup-expired-stories',
  '0 * * * *',
  $$
    delete from public.stories
    where is_pinned = false
      and created_at < now() - interval '24 hours';
  $$
);
