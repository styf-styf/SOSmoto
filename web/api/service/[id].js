const { createClient } = require('@supabase/supabase-js');
const { notFoundPage, renderPreviewPage } = require('../_lib/previewPage');

// Página pública de vista previa para el link compartido de un servicio
// (https://so-smoto.vercel.app/service/:id) -- mismo patrón que
// web/api/product/[id].js.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: service } = await supabase
    .from('services')
    .select('id, name, description, photos, reference_price, is_active, category_id, business:businesses(name, logo_url)')
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!service || !service.is_active) {
    res.status(404).send(notFoundPage('Este servicio ya no está disponible.'));
    return;
  }

  const businessName = service.business?.name ?? 'SOSmoto';
  const description = service.description || `Servicio de ${businessName} en SOSmoto`;
  const images = Array.isArray(service.photos) ? service.photos : [];
  const price = service.reference_price != null ? `$${Number(service.reference_price).toFixed(2)}` : null;
  const universalLink = `https://so-smoto.vercel.app/service/${service.id}`;
  const appLink = `sosmoto://service/${service.id}`;

  let related = [];
  if (service.category_id) {
    const { data: relatedRows } = await supabase
      .from('services')
      .select('id, name, photos, reference_price')
      .eq('category_id', service.category_id)
      .eq('is_active', true)
      .neq('id', service.id)
      .order('created_at', { ascending: false })
      .limit(10);
    related = (relatedRows ?? []).map((r) => ({
      href: `https://so-smoto.vercel.app/service/${r.id}`,
      image: Array.isArray(r.photos) ? r.photos[0] : null,
      name: r.name,
      price: r.reference_price != null ? `$${Number(r.reference_price).toFixed(2)}` : null,
      kind: 'service',
    }));
  }

  res.status(200).send(
    renderPreviewPage({
      authorName: businessName,
      authorAvatar: service.business?.logo_url ?? null,
      title: service.name,
      price,
      description: service.description || null,
      images,
      related,
      appLink,
      og: {
        title: `${service.name}${price ? ` · ${price}` : ''}`,
        description,
        url: universalLink,
        type: 'product',
      },
    })
  );
};
