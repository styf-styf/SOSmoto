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

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: post } = await supabase
    .from('posts')
    .select(
      'id, caption, photos, author_business:businesses!posts_business_id_fkey(name), author_client:users!posts_client_id_fkey(full_name)'
    )
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!post) {
    res.status(404).send(notFoundPage('Esta publicación ya no está disponible.'));
    return;
  }

  const authorName = post.author_business?.name ?? post.author_client?.full_name ?? 'Usuario';
  const caption = post.caption || `Publicación de ${authorName} en SOSmoto`;
  const image = Array.isArray(post.photos) ? post.photos[0] : null;
  const universalLink = `https://so-smoto.vercel.app/post/${post.id}`;
  const appLink = `sosmoto://post/${post.id}`;

  res.status(200).send(
    renderPreviewPage({
      title: authorName,
      description: post.caption || null,
      image,
      appLink,
      og: { title: `${authorName} en SOSmoto`, description: caption, url: universalLink, type: 'article' },
    })
  );
};
