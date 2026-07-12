const { createClient } = require('@supabase/supabase-js');
const { escapeHtml, avatarHtml, renderPage } = require('../_lib/webPage');
const { notFoundPage } = require('../_lib/previewPage');

// Perfil publico de negocio (https://so-smoto.vercel.app/negocio/:id) --
// mismos campos que el modo "publico" de components/BusinessProfileView.tsx,
// sin las acciones que requieren cuenta (Seguir/Mensaje/Agendar): se
// reemplazan por "Abrir en SOSmoto" y, si el negocio cargo whatsapp, un
// link directo a wa.me (unica accion de contacto real sin cuenta ni app).
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const DAY_KEY_BY_JS_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const WEEK_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

// Mismo criterio que utils/businessSchedule.ts: agrupa dias consecutivos
// con el mismo horario en una sola fila.
function getScheduleRows(schedule) {
  const days = WEEK_ORDER.map((key) => {
    const value = schedule?.[key];
    return { key, hours: value ? `${value.open} - ${value.close}` : 'Cerrado' };
  });
  const rows = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1].hours === days[i].hours) j++;
    const groupKeys = days.slice(i, j + 1).map((d) => d.key);
    const label =
      groupKeys.length > 1
        ? `${DAY_LABELS[groupKeys[0]]} - ${DAY_LABELS[groupKeys[groupKeys.length - 1]]}`
        : DAY_LABELS[groupKeys[0]];
    rows.push({ label, hours: days[i].hours });
    i = j + 1;
  }
  return rows;
}

function isOpenNow(business) {
  if (business.is_24h) return true;
  const todayKey = DAY_KEY_BY_JS_INDEX[new Date().getDay()];
  const today = business.schedule?.[todayKey];
  // Un schedule mal formado (falta open/close para hoy) no debe tumbar la
  // pagina de perfil del negocio -- se trata como "cerrado" en vez de
  // lanzar una excepcion no capturada.
  if (!today || !today.open || !today.close) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = today.open.split(':').map(Number);
  const [closeH, closeM] = today.close.split(':').map(Number);
  return currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM;
}

function catalogSectionHtml(title, items, kind) {
  if (!items.length) return '';
  const withImage = items.filter((it) => it.photos?.[0]);
  const withoutImage = items.filter((it) => !it.photos?.[0]);
  const href = (id) => `/${kind}/${escapeHtml(id)}`;
  const priceLabel = (p) => (p.reference_price != null ? `$${Number(p.reference_price).toFixed(2)}` : null);

  return `
    <p class="section-title">${escapeHtml(title)}</p>
    ${
      withImage.length
        ? `<div class="catalog-grid">
             ${withImage
               .map(
                 (p) => `<a class="catalog-card" href="${href(p.id)}">
                   <div class="catalog-image"><img src="${escapeHtml(p.photos[0])}" alt="" /></div>
                   <p class="catalog-name">${escapeHtml(p.name)}</p>
                   ${priceLabel(p) ? `<p class="catalog-price">${escapeHtml(priceLabel(p))}</p>` : ''}
                 </a>`
               )
               .join('')}
           </div>`
        : ''
    }
    ${
      withoutImage.length
        ? `<div class="catalog-list">
             ${withoutImage
               .map(
                 (p) => `<a class="catalog-list-row" href="${href(p.id)}">
                   <span class="catalog-list-icon">${kind === 'service' ? '🔧' : '📦'}</span>
                   <span class="catalog-list-name">${escapeHtml(p.name)}</span>
                   ${priceLabel(p) ? `<span class="catalog-list-price">${escapeHtml(priceLabel(p))}</span>` : ''}
                 </a>`
               )
               .join('')}
           </div>`
        : ''
    }
  `;
}

module.exports = async (req, res) => {
  const { id } = req.query;
  const supabase = supabaseAdmin();

  const { data: business } = await supabase
    .from('businesses')
    .select(
      'id, name, description, logo_url, address, city, business_type, is_verified, rating_avg, followers_count, schedule, is_24h, whatsapp, is_limited'
    )
    .eq('id', id)
    .maybeSingle();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!business || business.is_limited) {
    res.status(404).send(notFoundPage('Este negocio ya no está disponible.'));
    return;
  }

  const [{ data: products }, { data: services }, { data: posts }, { count: postsCount }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, photos, reference_price')
      .eq('business_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('services')
      .select('id, name, photos, reference_price')
      .eq('business_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('posts')
      .select('id, caption, photos')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('business_id', id),
  ]);

  const typeLabel = business.business_type === 'workshop' ? 'Taller' : 'Tienda';
  const scheduleRows = business.is_24h ? [] : getScheduleRows(business.schedule);
  const openNow = isOpenNow(business);
  const whatsappDigits = business.whatsapp ? business.whatsapp.replace(/\D/g, '') : null;

  const postsWithImage = (posts ?? []).filter((p) => p.photos?.[0]);
  const postsWithoutImage = (posts ?? []).filter((p) => !p.photos?.[0]);

  const bodyHtml = `
<div class="header-row">
  ${avatarHtml(business.logo_url, business.name, 64)}
  <div class="header-info">
    <p class="biz-title">${escapeHtml(business.name)}${business.is_verified ? ' <span class="verified">✓</span>' : ''}</p>
    <p class="biz-subtitle">${escapeHtml(typeLabel)}${business.city ? ` · ${escapeHtml(business.city)}` : ''}</p>
    ${business.address ? `<p class="biz-address">${escapeHtml(business.address)}</p>` : ''}
  </div>
</div>

<div class="stats-row">
  <div class="stat"><p class="stat-value">${business.rating_avg != null ? Number(business.rating_avg).toFixed(1) : '—'}</p><p class="stat-label">★ Calificación</p></div>
  <div class="stat"><p class="stat-value">${business.followers_count ?? 0}</p><p class="stat-label">Seguidores</p></div>
  <div class="stat"><p class="stat-value">${postsCount ?? 0}</p><p class="stat-label">Publicaciones</p></div>
</div>

<div class="schedule-box">
  <p class="schedule-status ${openNow ? 'open' : 'closed'}">${business.is_24h ? 'Abierto 24/7' : openNow ? 'Abierto ahora' : 'Cerrado ahora'}</p>
  ${
    !business.is_24h
      ? scheduleRows.map((r) => `<div class="schedule-row"><span>${escapeHtml(r.label)}</span><span>${escapeHtml(r.hours)}</span></div>`).join('')
      : ''
  }
</div>

${business.description ? `<p class="description">${escapeHtml(business.description)}</p>` : ''}

<div class="actions-row">
  <a class="button" href="sosmoto://">Abrir en SOSmoto</a>
  ${whatsappDigits ? `<a class="button button-secondary" href="https://wa.me/${whatsappDigits}">WhatsApp</a>` : ''}
</div>

${catalogSectionHtml('Productos', products ?? [], 'product')}
${catalogSectionHtml('Servicios', services ?? [], 'service')}

${
  postsWithImage.length || postsWithoutImage.length
    ? `<p class="section-title">Publicaciones</p>
       ${
         postsWithImage.length
           ? `<div class="posts-grid">
                ${postsWithImage
                  .map((p) => `<a class="posts-cell" href="/post/${escapeHtml(p.id)}"><img src="${escapeHtml(p.photos[0])}" alt="" /></a>`)
                  .join('')}
              </div>`
           : ''
       }
       ${
         postsWithoutImage.length
           ? `<div class="catalog-list">
                ${postsWithoutImage
                  .map(
                    (p) => `<a class="catalog-list-row" href="/post/${escapeHtml(p.id)}">
                      <span class="catalog-list-icon">📝</span>
                      <span class="catalog-list-name">${escapeHtml(p.caption || 'Publicación')}</span>
                    </a>`
                  )
                  .join('')}
              </div>`
           : ''
       }`
    : ''
}
`;

  const extraStyle = `
.header-row { display: flex; align-items: flex-start; gap: 12px; }
.header-info { min-width: 0; flex: 1; }
.biz-title { font-size: 19px; font-weight: 700; color: #1A1A2E; margin: 0; }
.verified { color: #FF6B00; }
.biz-subtitle { font-size: 13px; color: #6B6B7B; margin: 2px 0 0; }
.biz-address { font-size: 13px; color: #6B6B7B; margin: 2px 0 0; }
.stats-row { display: flex; margin-top: 18px; border-top: 1px solid #E5E5EA; border-bottom: 1px solid #E5E5EA; padding: 12px 0; }
.stat { flex: 1; text-align: center; }
.stat-value { font-size: 16px; font-weight: 700; color: #1A1A2E; margin: 0; }
.stat-label { font-size: 11px; color: #6B6B7B; margin: 2px 0 0; }
.schedule-box { margin-top: 16px; }
.schedule-status { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; margin: 0 0 8px; }
.schedule-status.open { background: #E7F5E8; color: #2E7D32; }
.schedule-status.closed { background: #FBE8E8; color: #D32F2F; }
.schedule-row { display: flex; justify-content: space-between; font-size: 13px; color: #1A1A2E; padding: 3px 0; }
.description { font-size: 14px; line-height: 20px; color: #1A1A2E; margin-top: 16px; }
.actions-row { display: flex; gap: 8px; margin-top: 20px; }
.button { flex: 1; display: block; text-align: center; background: #FF6B00; color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 16px; border-radius: 22px; }
.button-secondary { background: #25D366; }
.section-title { font-size: 14px; font-weight: 700; color: #1A1A2E; margin: 24px 0 10px; }
.catalog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.catalog-card { display: block; text-decoration: none; min-width: 0; }
.catalog-image { width: 100%; aspect-ratio: 3 / 4; border-radius: 10px; overflow: hidden; background: #F5F5F7; }
.catalog-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.catalog-name { width: 100%; font-size: 12px; font-weight: 600; color: #1A1A2E; margin: 6px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.catalog-price { width: 100%; font-size: 12px; font-weight: 700; color: #FF6B00; margin: 2px 0 0; }
.catalog-list { margin-top: 4px; }
.catalog-list-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; text-decoration: none; }
.catalog-list-icon { width: 32px; height: 32px; border-radius: 16px; background: #FFF1E6; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
.catalog-list-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; color: #1A1A2E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.catalog-list-price { font-size: 13px; font-weight: 700; color: #FF6B00; flex-shrink: 0; }
.posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.posts-cell { display: block; aspect-ratio: 1; background: #F5F5F7; }
.posts-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
`;

  res.status(200).send(
    renderPage({
      title: `${business.name} · SOSmoto`,
      description: business.description || `${typeLabel} en SOSmoto`,
      maxWidth: 520,
      bodyHtml,
      extraStyle,
    })
  );
};
