import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminStoryRow } from '../../../lib/types';
import { StoryDeleteButton } from './StoryDeleteButton';

export default async function ModeracionPage() {
  const supabase = createAdminClient();
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, business_id, client_id, image_url, caption, is_pinned, views, clicks, created_at, businesses(name), users!stories_client_id_fkey(full_name)'
    )
    .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
    .order('created_at', { ascending: false });

  const stories = (data ?? []) as unknown as AdminStoryRow[];

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Moderación · Historias activas</h1>
      <p className="mb-4 text-sm text-gray-500">
        Las historias se publican sin aprobación previa (contenido orgánico de 24h). Desde aquí puedes eliminar
        cualquiera que sea inapropiada.
      </p>

      {error && <p className="text-sm text-red-600">Error cargando historias: {error.message}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {stories.map((story) => (
          <div key={story.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <img src={story.image_url} alt="" className="h-48 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-semibold">
                {story.businesses?.name ?? story.users?.full_name ?? 'Usuario'}
                {story.client_id ? ' (cliente)' : ''}
              </p>
              {story.caption && <p className="mt-1 text-sm text-gray-600">{story.caption}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {story.is_pinned ? 'Destacada · ' : ''}
                {story.views} vistas · {story.clicks} clics
              </p>
              <StoryDeleteButton storyId={story.id} />
            </div>
          </div>
        ))}
        {stories.length === 0 && !error && <p className="text-sm text-gray-500">No hay historias activas.</p>}
      </div>
    </div>
  );
}
