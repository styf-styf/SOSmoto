const { createClient } = require('@supabase/supabase-js');
const { notFoundPage, renderPreviewPage } = require('../_lib/previewPage');

// Página pública de vista previa para el link compartido de un producto
// (https://so-smoto.vercel.app/product/:id) -- mismo patrón que
// web/api/post/[id].js.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, photos, reference_price, is_active, category_id, business:businesses(name, logo_url)')
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!product || !product.is_active) {
    res.status(404).send(notFoundPage('Este producto ya no está disponible.'));
    return;
  }

  const businessName = product.business?.name ?? 'SOSmoto';
  const description = product.description || `Producto de ${businessName} en SOSmoto`;
  const images = Array.isArray(product.photos) ? product.photos : [];
  const price = product.reference_price != null ? `$${Number(product.reference_price).toFixed(2)}` : null;
  const universalLink = `https://so-smoto.vercel.app/product/${product.id}`;
  const appLink = `sosmoto://product/${product.id}`;

  let related = [];
  if (product.category_id) {
    const { data: relatedRows } = await supabase
      .from('products')
      .select('id, name, photos, reference_price')
      .eq('category_id', product.category_id)
      .eq('is_active', true)
      .neq('id', product.id)
      .order('created_at', { ascending: false })
      .limit(10);
    related = (relatedRows ?? []).map((r) => ({
      href: `https://so-smoto.vercel.app/product/${r.id}`,
      image: Array.isArray(r.photos) ? r.photos[0] : null,
      name: r.name,
      price: r.reference_price != null ? `$${Number(r.reference_price).toFixed(2)}` : null,
      kind: 'product',
    }));
  }

  res.status(200).send(
    renderPreviewPage({
      authorName: businessName,
      authorAvatar: product.business?.logo_url ?? null,
      title: product.name,
      price,
      description: product.description || null,
      images,
      related,
      appLink,
      og: {
        title: `${product.name}${price ? ` · ${price}` : ''}`,
        description,
        url: universalLink,
        type: 'product',
      },
    })
  );
};
