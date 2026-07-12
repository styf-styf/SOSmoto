const { createClient } = require('@supabase/supabase-js');
const { notFoundPage, renderPreviewPage } = require('../_lib/previewPage');

// Página pública de vista previa para el link compartido de una publicación
// (https://so-smoto.vercel.app/post/:id) -- vive fuera de la app para que
// WhatsApp/Telegram/etc. puedan leer las etiquetas Open Graph y armar la
// tarjeta de vista previa. Si el sistema operativo intercepta el Universal
// Link (app instalada), esta página nunca llega a mostrarse.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Mismo orden de prioridad que getPostTag() en services/posts.ts.
function resolveTag(post) {
  if (post.tag_business) return { label: post.tag_business.name };
  if (post.tag_client) return { label: post.tag_client.full_name };
  if (post.tag_service) return { label: post.tag_service.name };
  if (post.tag_product) return { label: post.tag_product.name };
  return null;
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const [{ data: post }, { data: comments }] = await Promise.all([
    supabase
      .from('posts')
      .select(
        `id, caption, photos,
         author_business:businesses!posts_business_id_fkey(name, logo_url),
         author_client:users!posts_client_id_fkey(full_name, avatar_url),
         tag_business:businesses!posts_tag_business_id_fkey(name),
         tag_client:users!posts_tag_client_id_fkey(full_name),
         tag_service:services!posts_tag_service_id_fkey(name),
         tag_product:products!posts_tag_product_id_fkey(name)`
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('post_comments')
      .select('body, users(full_name, avatar_url)')
      .eq('post_id', id)
      .order('created_at', { ascending: true }),
  ]);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!post) {
    res.status(404).send(notFoundPage('Esta publicación ya no está disponible.'));
    return;
  }

  const authorName = post.author_business?.name ?? post.author_client?.full_name ?? 'Usuario';
  const authorAvatar = post.author_business?.logo_url ?? post.author_client?.avatar_url ?? null;
  const caption = post.caption || `Publicación de ${authorName} en SOSmoto`;
  const images = Array.isArray(post.photos) ? post.photos : [];
  const universalLink = `https://so-smoto.vercel.app/post/${post.id}`;
  const appLink = `sosmoto://post/${post.id}`;
  const commentList = (comments ?? []).map((c) => ({
    authorName: c.users?.full_name ?? 'Usuario',
    avatarUrl: c.users?.avatar_url ?? null,
    body: c.body,
  }));

  res.status(200).send(
    renderPreviewPage({
      authorName,
      authorAvatar,
      title: authorName,
      description: post.caption || null,
      images,
      tag: resolveTag(post),
      comments: commentList,
      appLink,
      og: { title: `${authorName} en SOSmoto`, description: caption, url: universalLink, type: 'article' },
    })
  );
};
