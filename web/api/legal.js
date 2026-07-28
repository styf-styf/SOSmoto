const { createClient } = require('@supabase/supabase-js');

// Páginas de Términos y Política de Privacidad, ahora dinámicas -- el
// contenido vive en la tabla legal_documents (editable desde el admin en
// Configuración) en vez de HTML estático. /terminos y /privacidad reescriben
// acá vía vercel.json (?doc=terminos|privacidad).
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const DOC_CONFIG = {
  terminos: { type: 'terms', title: 'Términos y Condiciones', otherHref: '/privacidad', otherLabel: 'Ver Política de Privacidad ›' },
  privacidad: { type: 'privacy', title: 'Política de Privacidad', otherHref: '/terminos', otherLabel: '‹ Ver Términos y Condiciones' },
};

module.exports = async (req, res) => {
  const doc = DOC_CONFIG[req.query.doc];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!doc) {
    res.status(404).send('Documento no encontrado.');
    return;
  }

  const supabase = supabaseAdmin();
  const { data: row } = await supabase
    .from('legal_documents')
    .select('content, published_at')
    .eq('type', doc.type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const content = row?.content ?? '<p>Este documento todavía no está disponible.</p>';
  const updated = row?.published_at
    ? new Date(row.published_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  res.status(200).send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" type="image/png" href="/favicon.png" />
<title>${doc.title} · SOSmoto</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #F5F5F7;
    margin: 0;
    padding: 32px 16px 64px;
    color: #1A1A2E;
    line-height: 1.6;
  }
  .card {
    max-width: 720px;
    margin: 0 auto;
    background: #FFFFFF;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 28px rgba(26,26,46,0.12);
  }
  .brand-bar {
    padding: 14px 20px;
    text-align: center;
    border-bottom: 1px solid #E5E5EA;
  }
  .brand { color: #FF6B00; font-weight: 700; font-size: 14px; }
  .content { padding: 28px 28px 36px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .updated { color: #6B6B7B; font-size: 13px; margin: 0 0 20px; }
  h2 { font-size: 17px; margin: 28px 0 8px; }
  p, li { font-size: 14.5px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #E5E5EA; vertical-align: top; }
  th { color: #6B6B7B; font-weight: 600; }
  a { color: #FF6B00; }
</style>
</head>
<body>
<div class="card">
  <div class="brand-bar"><span class="brand">SOSmoto</span></div>
  <div class="content">
    <h1>${doc.title}</h1>
    <p class="updated">Última actualización: ${updated}</p>

    ${content}

    <p style="margin-top:32px;"><a href="${doc.otherHref}">${doc.otherLabel}</a></p>
  </div>
</div>
</body>
</html>`);
};
