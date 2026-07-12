const { createClient } = require('@supabase/supabase-js');
const { escapeHtml, avatarHtml, renderPage } = require('./_lib/webPage');

// Home (https://so-smoto.vercel.app/, ?home=1 via vercel.json) y
// busqueda/listado publico de negocios (https://so-smoto.vercel.app/negocios?q=...)
// -- fusionados en un solo archivo para no superar el limite de 12 funciones
// serverless del plan Hobby de Vercel (son casi la misma pantalla: home es
// la version con tagline y menos resultados, sin buscar; negocios/ es la
// version con resultados de una busqueda o el mismo listado "recientes").
//
// Sin GPS en la web (a diferencia de searchBusinesses() en la app), asi que
// la busqueda es solo por texto (nombre/ciudad/direccion) -- sin orden por
// cercania. Mismas exclusiones que getNewNearbyBusinesses en la app: sin
// marcas/brand_advertiser, sin negocios suspendidos.
function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

module.exports = async (req, res) => {
  const isHome = req.query.home === '1';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const supabase = supabaseAdmin();

  let query = supabase
    .from('businesses')
    .select('id, name, city, address, logo_url, business_type')
    .neq('business_type', 'brand_advertiser')
    .eq('is_limited', false)
    .order('created_at', { ascending: false })
    .limit(isHome ? 8 : 30);

  if (q) {
    // El filtro or() de PostgREST usa "," "(" ")" "." como caracteres
    // estructurales -- antes solo se sacaban "%" y "," dejando "(" ")" "."
    // sin escapar, lo que podia romper el filtro con input raro (ej. un
    // parentesis desbalanceado) sin que el usuario supiera por que la
    // busqueda no devolvia nada.
    const term = q.replace(/[%,().]/g, '');
    query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data: results, error: searchError } = await query;
  if (searchError) console.error('negocios search error', searchError);

  const resultsHtml = (results ?? [])
    .map(
      (b) => `<a class="biz-row" href="/negocio/${escapeHtml(b.id)}">
        ${avatarHtml(b.logo_url, b.name, 44)}
        <span class="biz-info">
          <span class="biz-name">${escapeHtml(b.name)}</span>
          <span class="biz-meta">${escapeHtml(b.business_type === 'workshop' ? 'Taller' : 'Tienda')}${b.city ? ` · ${escapeHtml(b.city)}` : ''}${!isHome && b.address ? ` · ${escapeHtml(b.address)}` : ''}</span>
        </span>
      </a>`
    )
    .join('');

  const sectionTitle = isHome ? 'Negocios recientes' : q ? `Resultados para "${escapeHtml(q)}"` : 'Negocios recientes';

  const bodyHtml = `
${isHome ? '<p class="tagline">Conectamos motociclistas con talleres y tiendas de confianza, y auxilio en carretera cuando lo necesitas.</p>' : ''}
<form class="search-form" action="/negocios" method="GET">
  <input class="search-input" type="text" name="q" value="${escapeHtml(q)}" placeholder="Buscar taller o tienda por nombre o ciudad" />
  <button class="search-button" type="submit">Buscar</button>
</form>
${
  resultsHtml
    ? `<p class="section-title">${sectionTitle}</p><div class="biz-list">${resultsHtml}</div>`
    : searchError
      ? '<p class="placeholder">Ocurrió un error al buscar. Probá con otro texto.</p>'
      : `<p class="placeholder">No encontramos negocios${q ? ' con ese nombre o ciudad' : ''}.</p>`
}
${isHome ? '<a class="button" href="sosmoto://">Abrir en SOSmoto</a>' : ''}
`;

  const extraStyle = `
.tagline {
  color: #1A1A2E;
  font-size: 15px;
  line-height: 22px;
  margin: 0 0 20px;
  text-align: center;
}
.search-form {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.search-input {
  flex: 1;
  height: 42px;
  border-radius: 10px;
  border: 1px solid #E5E5EA;
  padding: 0 12px;
  font-size: 14px;
}
.search-button {
  height: 42px;
  padding: 0 18px;
  border-radius: 10px;
  border: none;
  background: #FF6B00;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1A1A2E;
  margin: 24px 0 10px;
}
.placeholder {
  font-size: 14px;
  color: #6B6B7B;
}
.biz-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.biz-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  text-decoration: none;
  border-bottom: 1px solid #E5E5EA;
}
.biz-row:last-child { border-bottom: none; }
.biz-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.biz-name {
  font-size: 14px;
  font-weight: 600;
  color: #1A1A2E;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.biz-meta {
  font-size: 12px;
  color: #6B6B7B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.button {
  display: block;
  text-align: center;
  margin-top: 24px;
  background: #FF6B00;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  padding: 14px 24px;
  border-radius: 24px;
}
`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    renderPage({
      title: isHome ? 'SOSmoto' : q ? `${q} · Buscar en SOSmoto` : 'Buscar negocios · SOSmoto',
      description: isHome ? 'Conectamos motociclistas con talleres y tiendas de confianza.' : undefined,
      maxWidth: isHome ? 480 : 520,
      showHomeLink: !isHome,
      bodyHtml,
      extraStyle,
    })
  );
};
