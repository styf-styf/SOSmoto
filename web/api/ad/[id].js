const { createClient } = require('@supabase/supabase-js');
const { notFoundPage, renderPreviewPage } = require('../_lib/previewPage');

// Página pública de vista previa para el link compartido de un anuncio
// (https://so-smoto.vercel.app/ad/:id). Usa el cliente admin (bypassea RLS)
// igual que post/[id].js, así que filtramos "status" a mano -- sin esto se
// podría exponer contenido pendiente/rechazado vía un UUID compartido.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();
  const { data: ad } = await supabase
    .from('ads')
    .select('id, title, image_url, status, business:businesses(name)')
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!ad || !['approved', 'active'].includes(ad.status)) {
    res.status(404).send(notFoundPage('Este anuncio ya no está disponible.'));
    return;
  }

  const businessName = ad.business?.name ?? 'Anuncio';
  const title = ad.title || `Anuncio de ${businessName} en SOSmoto`;
  const universalLink = `https://so-smoto.vercel.app/ad/${ad.id}`;
  const appLink = `sosmoto://ad/${ad.id}`;

  res.status(200).send(
    renderPreviewPage({
      kicker: businessName,
      title: ad.title || businessName,
      image: ad.image_url,
      appLink,
      og: { title: `${businessName} en SOSmoto`, description: title, url: universalLink, type: 'article' },
    })
  );
};
