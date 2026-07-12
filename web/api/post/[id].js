const { createClient } = require('@supabase/supabase-js');

// Página pública de vista previa para el link compartido de una publicación
// (https://so-smoto.vercel.app/post/:id) -- vive fuera de la app para que
// WhatsApp/Telegram/etc. puedan leer las etiquetas Open Graph y armar la
// tarjeta de vista previa. Si el sistema operativo intercepta el Universal
// Link (app instalada), esta página nunca llega a mostrarse.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function notFound(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404).send(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><title>SOSmoto</title></head>' +
    '<body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px 24px;">' +
    '<h1>Esta publicación ya no está disponible.</h1></body></html>'
  );
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

  if (!post) {
    notFound(res);
    return;
  }

  const authorName = post.author_business?.name ?? post.author_client?.full_name ?? 'Usuario';
  const caption = post.caption || `Publicación de ${authorName} en SOSmoto`;
  const image = Array.isArray(post.photos) ? post.photos[0] : null;
  const universalLink = `https://so-smoto.vercel.app/post/${post.id}`;
  const appLink = `sosmoto://post/${post.id}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(authorName)} en SOSmoto</title>
<meta property="og:title" content="${escapeHtml(authorName)} en SOSmoto" />
<meta property="og:description" content="${escapeHtml(caption)}" />
${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
<meta property="og:url" content="${universalLink}" />
<meta property="og:type" content="article" />
<meta name="twitter:card" content="summary_large_image" />
<style>
body{font-family:-apple-system,sans-serif;text-align:center;padding:40px 24px;background:#f5f5f5;margin:0;}
img{max-width:100%;border-radius:12px;margin-top:16px;}
h1{font-size:18px;}
p{color:#444;font-size:15px;}
a.button{display:inline-block;margin-top:20px;background:#FF6B00;color:#fff;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:24px;}
</style>
</head>
<body>
<h1>${escapeHtml(authorName)}</h1>
<p>${escapeHtml(caption)}</p>
${image ? `<img src="${escapeHtml(image)}" alt="" />` : ''}
<div><a class="button" href="${appLink}">Abrir en SOSmoto</a></div>
<script>
setTimeout(function () { window.location.href = ${JSON.stringify(appLink)}; }, 300);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
