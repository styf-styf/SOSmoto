import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPostRow, AdminStoryRow } from '../../../lib/types';
import { PostDeleteButton } from './PostDeleteButton';
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

  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select(
      'id, business_id, client_id, image_url, caption, comments_count, created_at, businesses!posts_business_id_fkey(name), users!posts_client_id_fkey(full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(60);

  const posts = (postsData ?? []) as unknown as AdminPostRow[];

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

      <h1 className="mb-2 mt-10 text-xl font-bold">Moderación · Publicaciones</h1>
      <p className="mb-4 text-sm text-gray-500">
        Contenido permanente subido por clientes y negocios. Elimina cualquiera que sea inapropiado.
      </p>

      {postsError && <p className="text-sm text-red-600">Error cargando publicaciones: {postsError.message}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          <div key={post.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            {post.image_url ? (
              <img src={post.image_url} alt="" className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                Sin imagen
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold">
                {post.businesses?.name ?? post.users?.full_name ?? 'Usuario'}
                {post.client_id ? ' (cliente)' : ''}
              </p>
              {post.caption && <p className="mt-1 text-sm text-gray-600">{post.caption}</p>}
              <p className="mt-1 text-xs text-gray-400">{post.comments_count} comentario(s)</p>
              <PostDeleteButton postId={post.id} />
            </div>
          </div>
        ))}
        {posts.length === 0 && !postsError && <p className="text-sm text-gray-500">No hay publicaciones.</p>}
      </div>
    </div>
  );
}
