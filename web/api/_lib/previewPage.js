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

function avatarHtml(url, name, size) {
  const initial = escapeHtml((name || '?').trim().charAt(0).toUpperCase());
  const style = `width:${size}px;height:${size}px;border-radius:${size / 2}px;`;
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="" style="${style}object-fit:cover;display:block;" />`;
  }
  return `<div style="${style}background:${COLORS.surface};color:${COLORS.primary};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size * 0.45)}px;">${initial}</div>`;
}

// kicker: nombre del negocio/autor (texto pequeño arriba del título) -- se
// ignora si se pasa `authorName` (post: usa el layout de autor con avatar)
// title: nombre del producto/servicio, o el nombre del autor para posts/ads
// price: string ya formateado (ej. "$12.00") o null
// description: caption/descripción, string o null
// images: array de urls (1 o más -- 2+ arma un carrusel deslizable); `image`
//         (singular) sigue aceptado como atajo para una sola foto
// authorName/authorAvatar: fila de autor con avatar circular (solo posts)
// tag: { label } o null -- chip debajo de la descripción
// comments: [{ authorName, avatarUrl, body }] o null/[]
// appLink: sosmoto://... para el intento de apertura directa
function renderPreviewPage({
  kicker,
  title,
  price,
  description,
  image,
  images,
  authorName,
  authorAvatar,
  tag,
  comments,
  appLink,
  og,
}) {
  const imageList = images && images.length ? images : image ? [image] : [];
  const ogTitle = og?.title ?? title;
  const ogDescription = og?.description ?? description ?? '';
  const ogImage = imageList[0];

  const carouselHtml = imageList.length
    ? imageList.length === 1
      ? `<div class="image-wrap"><img src="${escapeHtml(imageList[0])}" alt="" /></div>`
      : `<div class="carousel">
           <div class="carousel-track">
             ${imageList.map((src) => `<img src="${escapeHtml(src)}" alt="" />`).join('')}
           </div>
           <div class="carousel-dots">
             ${imageList.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('')}
           </div>
         </div>`
    : '';

  const authorRowHtml = authorName
    ? `<div class="author-row">
         ${avatarHtml(authorAvatar, authorName, 32)}
         <span class="author-name">${escapeHtml(authorName)}</span>
       </div>`
    : '';

  const tagHtml = tag ? `<div class="tag-chip">${escapeHtml(tag.label)}</div>` : '';

  const commentsHtml =
    comments && comments.length
      ? `<div class="comments">
           <p class="comments-title">Comentarios</p>
           ${comments
             .map(
               (c) => `<div class="comment-row">
                 ${avatarHtml(c.avatarUrl, c.authorName, 26)}
                 <div class="comment-bubble">
                   <p class="comment-author">${escapeHtml(c.authorName)}</p>
                   <p class="comment-body">${escapeHtml(c.body)}</p>
                 </div>
               </div>`
             )
             .join('')}
         </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ogTitle)} · SOSmoto</title>
<meta property="og:title" content="${escapeHtml(ogTitle)}" />
<meta property="og:description" content="${escapeHtml(ogDescription)}" />
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : ''}
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
.author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px 0;
}
.author-name {
  font-size: 15px;
  font-weight: 700;
  color: ${COLORS.text};
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
.carousel {
  position: relative;
  margin-top: 12px;
}
.carousel-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.carousel-track::-webkit-scrollbar { display: none; }
.carousel-track img {
  flex: 0 0 100%;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  scroll-snap-align: start;
  background: ${COLORS.surface};
}
.carousel-dots {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 5px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.55);
}
.dot.active {
  background: #fff;
  width: 14px;
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
.tag-chip {
  display: inline-block;
  margin-top: 12px;
  background: #FFF1E6;
  color: ${COLORS.primary};
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 16px;
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
.comments {
  margin-top: 24px;
  border-top: 1px solid ${COLORS.border};
  padding-top: 16px;
}
.comments-title {
  font-size: 14px;
  font-weight: 700;
  color: ${COLORS.text};
  margin: 0 0 10px;
}
.comment-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.comment-bubble {
  flex: 1;
  background: ${COLORS.surface};
  border-radius: 12px;
  padding: 8px 10px;
}
.comment-author {
  font-size: 12px;
  font-weight: 700;
  color: ${COLORS.text};
  margin: 0 0 2px;
}
.comment-body {
  font-size: 13px;
  color: ${COLORS.text};
  margin: 0;
}
</style>
</head>
<body>
<div class="card">
  <div class="brand-bar"><span class="brand">SOSmoto</span></div>
  ${authorRowHtml}
  ${carouselHtml}
  <div class="content">
    ${!authorName && kicker ? `<p class="kicker">${escapeHtml(kicker)}</p>` : ''}
    ${!authorName ? `<p class="title">${escapeHtml(title)}</p>` : ''}
    ${price ? `<p class="price">${escapeHtml(price)}</p>` : ''}
    ${description ? `<p class="description">${escapeHtml(description)}</p>` : ''}
    ${tagHtml}
    <a class="button" href="${appLink}">Abrir en SOSmoto</a>
    ${commentsHtml}
  </div>
</div>
<script>
setTimeout(function () { window.location.href = ${JSON.stringify(appLink)}; }, 300);
document.querySelectorAll('.carousel-track').forEach(function (track) {
  var dots = track.parentElement.querySelectorAll('.dot');
  track.addEventListener('scroll', function () {
    var idx = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
  });
});
</script>
</body>
</html>`;
}

module.exports = { escapeHtml, notFoundPage, renderPreviewPage };
