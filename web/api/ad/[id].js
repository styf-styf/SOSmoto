const { createClient } = require('@supabase/supabase-js');

// Página pública de vista previa para el link compartido de un anuncio
// (https://so-smoto.vercel.app/ad/:id). Usa el cliente admin (bypassea RLS)
// igual que post/[id].js, así que filtramos "status" a mano -- sin esto se
// podría exponer contenido pendiente/rechazado vía un UUID compartido.
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
    '<h1>Este anuncio ya no está disponible.</h1></body></html>'
  );
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: ad } = await supabase
    .from('ads')
    .select('id, title, image_url, status, business:businesses(name)')
    .eq('id', id)
    .maybeSingle();

  if (!ad || !['approved', 'active'].includes(ad.status)) {
    notFound(res);
    return;
  }

  const businessName = ad.business?.name ?? 'Anuncio';
  const title = ad.title || `Anuncio de ${businessName} en SOSmoto`;
  const universalLink = `https://so-smoto.vercel.app/ad/${ad.id}`;
  const appLink = `sosmoto://ad/${ad.id}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(businessName)} en SOSmoto</title>
<meta property="og:title" content="${escapeHtml(businessName)} en SOSmoto" />
<meta property="og:description" content="${escapeHtml(title)}" />
<meta property="og:image" content="${escapeHtml(ad.image_url)}" />
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
<h1>${escapeHtml(businessName)}</h1>
<p>${escapeHtml(title)}</p>
<img src="${escapeHtml(ad.image_url)}" alt="" />
<div><a class="button" href="${appLink}">Abrir en SOSmoto</a></div>
<script>
setTimeout(function () { window.location.href = ${JSON.stringify(appLink)}; }, 300);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
