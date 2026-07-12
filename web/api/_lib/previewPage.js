// Prefijo "_" -- Vercel ignora archivos/carpetas asi para el ruteo de
// funciones, asi que esto es un modulo compartido, no un endpoint.
// Mismo lenguaje visual que la app (ver constants/colors.ts): tarjeta blanca
// centrada sobre fondo gris claro, imagen arriba, acento naranja para precio
// y boton de accion.
const COLORS = {
  primary: '#FF6B00',
  secondary: '#1A1A2E',
  background: '#FFFFFF',
  surface: '#F5F5F7',
  text: '#1A1A2E',
  textMuted: '#6B6B7B',
  border: '#E5E5EA',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function notFoundPage(message) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${COLORS.surface};margin:0;padding:60px 24px;text-align:center;}
h1{font-size:16px;color:${COLORS.text};font-weight:600;}
.brand{color:${COLORS.primary};font-weight:700;font-size:14px;margin-bottom:20px;}
</style>
</head>
<body>
<div class="brand">SOSmoto</div>
<h1>${escapeHtml(message)}</h1>
</body>
</html>`;
}

// kicker: nombre del negocio/autor (texto pequeño arriba del título)
// title: nombre del producto/servicio o autor de la publicación/anuncio
// price: string ya formateado (ej. "$12.00") o null
// description: caption/descripción, string o null
// image: url de la foto principal, o null
// appLink: sosmoto://... para el intento de apertura directa
function renderPreviewPage({ kicker, title, price, description, image, appLink, og }) {
  const ogTitle = og?.title ?? title;
  const ogDescription = og?.description ?? description ?? '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ogTitle)} · SOSmoto</title>
<meta property="og:title" content="${escapeHtml(ogTitle)}" />
<meta property="og:description" content="${escapeHtml(ogDescription)}" />
${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
${og?.url ? `<meta property="og:url" content="${escapeHtml(og.url)}" />` : ''}
<meta property="og:type" content="${og?.type ?? 'website'}" />
<meta name="twitter:card" content="summary_large_image" />
<style>
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: ${COLORS.surface};
  margin: 0;
  padding: 32px 16px;
  display: flex;
  justify-content: center;
}
.card {
  width: 100%;
  max-width: 420px;
  background: ${COLORS.background};
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(26,26,46,0.12);
}
.brand-bar {
  padding: 14px 20px 0;
  text-align: center;
}
.brand {
  color: ${COLORS.primary};
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.2px;
}
.image-wrap {
  width: 100%;
  aspect-ratio: 4 / 3;
  background: ${COLORS.surface};
  margin-top: 12px;
}
.image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.content {
  padding: 18px 20px 24px;
}
.kicker {
  font-size: 13px;
  font-weight: 600;
  color: ${COLORS.textMuted};
  margin: 0 0 4px;
}
.title {
  font-size: 20px;
  font-weight: 700;
  color: ${COLORS.text};
  margin: 0 0 6px;
}
.price {
  font-size: 17px;
  font-weight: 700;
  color: ${COLORS.primary};
  margin: 0 0 10px;
}
.description {
  font-size: 14px;
  line-height: 20px;
  color: ${COLORS.text};
  margin: 0;
  white-space: pre-line;
}
.button {
  display: block;
  text-align: center;
  margin-top: 22px;
  background: ${COLORS.primary};
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  padding: 14px 24px;
  border-radius: 24px;
}
</style>
</head>
<body>
<div class="card">
  <div class="brand-bar"><span class="brand">SOSmoto</span></div>
  ${image ? `<div class="image-wrap"><img src="${escapeHtml(image)}" alt="" /></div>` : ''}
  <div class="content">
    ${kicker ? `<p class="kicker">${escapeHtml(kicker)}</p>` : ''}
    <p class="title">${escapeHtml(title)}</p>
    ${price ? `<p class="price">${escapeHtml(price)}</p>` : ''}
    ${description ? `<p class="description">${escapeHtml(description)}</p>` : ''}
    <a class="button" href="${appLink}">Abrir en SOSmoto</a>
  </div>
</div>
<script>
setTimeout(function () { window.location.href = ${JSON.stringify(appLink)}; }, 300);
</script>
</body>
</html>`;
}

module.exports = { escapeHtml, notFoundPage, renderPreviewPage };
