// Prefijo "_" -- Vercel ignora archivos/carpetas asi para el ruteo de
// funciones, asi que esto es un modulo compartido, no un endpoint.
// Piezas compartidas por TODAS las paginas web (vista previa de contenido
// compartido en previewPage.js, y home/negocios/negocio de navegacion
// publica) -- mismo lenguaje visual que la app (ver constants/colors.ts).
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

function avatarHtml(url, name, size) {
  const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase());
  const style = `width:${size}px;height:${size}px;border-radius:${size / 2}px;`;
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="" style="${style}object-fit:cover;display:block;" />`;
  }
  return `<div style="${style}background:${COLORS.surface};color:${COLORS.primary};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size * 0.45)}px;">${initial}</div>`;
}

// Cascara comun para paginas de navegacion (home, negocios, perfil de
// negocio) -- a diferencia de renderPreviewPage() (previewPage.js), estas
// NO son intersticiales de apertura de la app: no llevan auto-redirect a
// sosmoto://, y el ancho de tarjeta es mas generoso para listas/perfiles.
function renderPage({ title, description, maxWidth = 480, bodyHtml, showHomeLink = true, extraStyle = '' }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ''}
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
  max-width: ${maxWidth}px;
  background: ${COLORS.background};
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(26,26,46,0.12);
}
.brand-bar {
  position: relative;
  padding: 14px 20px;
  text-align: center;
  border-bottom: 1px solid ${COLORS.border};
}
.brand {
  color: ${COLORS.primary};
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.2px;
}
.home-link {
  position: absolute;
  left: 14px;
  top: 10px;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${COLORS.text};
  font-size: 18px;
  text-decoration: none;
}
.content {
  padding: 20px;
}
${extraStyle}
</style>
</head>
<body>
<div class="card">
  <div class="brand-bar">
    ${showHomeLink ? `<a class="home-link" href="/" aria-label="Ir al inicio">‹</a>` : ''}
    <span class="brand">SOSmoto</span>
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
</div>
</body>
</html>`;
}

module.exports = { COLORS, escapeHtml, avatarHtml, renderPage };
