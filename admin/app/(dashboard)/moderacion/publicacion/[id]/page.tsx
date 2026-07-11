import { notFound } from 'next/navigation';
import { createAdminClient } from '../../../../../lib/supabase/admin';
import { AdminPostRow } from '../../../../../lib/types';
import { PostCommentDeleteButton } from '../../PostCommentDeleteButton';
import { PostDeleteButton } from '../../PostDeleteButton';

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('posts')
    .select(
      'id, business_id, client_id, photos, caption, comments_count, created_at, businesses!posts_business_id_fkey(name), users!posts_client_id_fkey(full_name)'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-red-600">Error cargando la publicación: {error.message}</p>;
  }
  if (!data) notFound();
  const post = data as unknown as AdminPostRow;

  const { data: comments, error: commentsError } = await supabase
    .from('post_comments')
    .select('id, body, created_at, users(full_name)')
    .eq('post_id', params.id)
    .order('created_at', { ascending: true });

  return (
    <div>
      <a href="/moderacion?tab=posts" className="mb-4 inline-block text-sm text-primary underline">
        ← Volver a Publicaciones
      </a>

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {post.businesses?.name ?? post.users?.full_name ?? 'Usuario'}
            {post.client_id ? ' (cliente)' : ''}
          </p>
          <PostDeleteButton postId={post.id} />
        </div>

        {post.photos.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {post.photos.map((url: string, i: number) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="h-48 w-full rounded-lg object-cover" />
            ))}
          </div>
        )}

        {post.caption && <p className="mb-2 whitespace-pre-wrap text-sm text-gray-700">{post.caption}</p>}
        <p className="text-xs text-gray-400">
          Publicado el {new Date(post.created_at).toLocaleString('es-EC')} · {post.comments_count} comentario(s)
        </p>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Comentarios</h2>
      {commentsError && <p className="text-sm text-red-600">Error cargando comentarios: {commentsError.message}</p>}
      <div className="space-y-3">
        {(comments ?? []).map((comment: any) => (
          <div key={comment.id} className="flex items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold">{comment.users?.full_name ?? 'Usuario'}</p>
              <p className="text-sm text-gray-600">{comment.body}</p>
              <p className="mt-1 text-xs text-gray-400">{new Date(comment.created_at).toLocaleString('es-EC')}</p>
            </div>
            <PostCommentDeleteButton commentId={comment.id} />
          </div>
        ))}
        {(comments ?? []).length === 0 && !commentsError && (
          <p className="text-sm text-gray-500">Sin comentarios todavía.</p>
        )}
      </div>
    </div>
  );
}
