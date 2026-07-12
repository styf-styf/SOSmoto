const { createClient } = require('@supabase/supabase-js');

// Página pública de vista previa para el link compartido de un producto
// (https://so-smoto.vercel.app/product/:id) -- mismo patrón que
// web/api/post/[id].js.
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
    '<h1>Este producto ya no está disponible.</h1></body></html>'
  );
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, photos, reference_price, is_active, business:businesses(name)')
    .eq('id', id)
    .maybeSingle();

  if (!product || !product.is_active) {
    notFound(res);
    return;
  }

  const businessName = product.business?.name ?? 'SOSmoto';
  const description = product.description || `Producto de ${businessName} en SOSmoto`;
  const image = Array.isArray(product.photos) ? product.photos[0] : null;
  const price = product.reference_price != null ? `$${Number(product.reference_price).toFixed(2)}` : null;
  const universalLink = `https://so-smoto.vercel.app/product/${product.id}`;
  const appLink = `sosmoto://product/${product.id}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(product.name)} · SOSmoto</title>
<meta property="og:title" content="${escapeHtml(product.name)}${price ? ` · ${price}` : ''}" />
<meta property="og:description" content="${escapeHtml(description)}" />
${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
<meta property="og:url" content="${universalLink}" />
<meta property="og:type" content="product" />
<meta name="twitter:card" content="summary_large_image" />
<style>
body{font-family:-apple-system,sans-serif;text-align:center;padding:40px 24px;background:#f5f5f5;margin:0;}
img{max-width:100%;border-radius:12px;margin-top:16px;}
h1{font-size:18px;}
p{color:#444;font-size:15px;}
.price{font-weight:700;font-size:16px;color:#FF6B00;margin-top:6px;}
a.button{display:inline-block;margin-top:20px;background:#FF6B00;color:#fff;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:24px;}
</style>
</head>
<body>
<h1>${escapeHtml(product.name)}</h1>
<p>${escapeHtml(businessName)}</p>
${price ? `<p class="price">${price}</p>` : ''}
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
