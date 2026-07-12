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
    .select('id, name, description, photos, reference_price, is_active, business:businesses(name)')
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!service || !service.is_active) {
    res.status(404).send(notFoundPage('Este servicio ya no está disponible.'));
    return;
  }

  const businessName = service.business?.name ?? 'SOSmoto';
  const description = service.description || `Servicio de ${businessName} en SOSmoto`;
  const image = Array.isArray(service.photos) ? service.photos[0] : null;
  const price = service.reference_price != null ? `$${Number(service.reference_price).toFixed(2)}` : null;
  const universalLink = `https://so-smoto.vercel.app/service/${service.id}`;
  const appLink = `sosmoto://service/${service.id}`;

  res.status(200).send(
    renderPreviewPage({
      kicker: businessName,
      title: service.name,
      price,
      description: service.description || null,
      image,
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
