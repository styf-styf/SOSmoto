import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPostRow, AdminStoryRow } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';
import { PostDeleteButton } from './PostDeleteButton';
import { StoryDeleteButton } from './StoryDeleteButton';

const PAGE_SIZE = 12;

export default async function ModeracionPage({
  searchParams,
}: {
  searchParams: { stories_page?: string; posts_page?: string };
}) {
  const storiesPage = Math.max(1, Number(searchParams.stories_page) || 1);
  const postsPage = Math.max(1, Number(searchParams.posts_page) || 1);

  const supabase = createAdminClient();
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [storiesResult, postsResult] = await Promise.all([
    supabase
      .from('stories')
      .select(
        'id, business_id, client_id, image_url, caption, is_pinned, views, clicks, created_at, businesses(name), users!stories_client_id_fkey(full_name)',
        { count: 'exact' }
      )
      .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
      .order('created_at', { ascending: false })
      .range((storiesPage - 1) * PAGE_SIZE, storiesPage * PAGE_SIZE - 1),
    supabase
      .from('posts')
      .select(
        'id, business_id, client_id, photos, caption, comments_count, created_at, businesses!posts_business_id_fkey(name), users!posts_client_id_fkey(full_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((postsPage - 1) * PAGE_SIZE, postsPage * PAGE_SIZE - 1),
  ]);

  const stories = (storiesResult.data ?? []) as unknown as AdminStoryRow[];
  const posts = (postsResult.data ?? []) as unknown as AdminPostRow[];
  const storiesTotalPages = storiesResult.count ? Math.ceil(storiesResult.count / PAGE_SIZE) : 1;
  const postsTotalPages = postsResult.count ? Math.ceil(postsResult.count / PAGE_SIZE) : 1;

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Moderación · Historias activas</h1>
      <p className="mb-4 text-sm text-gray-500">
        Las historias se publican sin aprobación previa (contenido orgánico de 24h). Desde aquí puedes eliminar
        cualquiera que sea inapropiada.
      </p>

      {storiesResult.error && <p className="text-sm text-red-600">Error cargando historias: {storiesResult.error.message}</p>}

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
        {stories.length === 0 && !storiesResult.error && (
          <p className="text-sm text-gray-500">No hay historias activas.</p>
        )}
      </div>
      <Paginator
        page={storiesPage}
        totalPages={storiesTotalPages}
        buildHref={(p) => `?stories_page=${p}&posts_page=${postsPage}`}
      />

      <h1 className="mb-2 mt-10 text-xl font-bold">Moderación · Publicaciones</h1>
      <p className="mb-4 text-sm text-gray-500">
        Contenido permanente subido por clientes y negocios. Elimina cualquiera que sea inapropiado.
      </p>

      {postsResult.error && <p className="text-sm text-red-600">Error cargando publicaciones: {postsResult.error.message}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          <div key={post.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            {post.photos[0] ? (
              <img src={post.photos[0]} alt="" className="h-48 w-full object-cover" />
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
        {posts.length === 0 && !postsResult.error && (
          <p className="text-sm text-gray-500">No hay publicaciones.</p>
        )}
      </div>
      <Paginator
        page={postsPage}
        totalPages={postsTotalPages}
        buildHref={(p) => `?stories_page=${storiesPage}&posts_page=${p}`}
      />
    </div>
  );
}
