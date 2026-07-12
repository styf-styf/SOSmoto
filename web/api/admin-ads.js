module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Admin · Publicidad</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #1a1a1a; }
  .container { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .helper { color: #666; font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #e0e0e0; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 16px; font-weight: 700; }
  .meta { font-size: 13px; color: #555; margin: 2px 0; }
  img.preview { width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; margin: 8px 0; }
  .actions { display: flex; gap: 10px; margin-top: 10px; }
  button { flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .approve { background: #1e8e3e; color: #fff; }
  .reject { background: #c0392b; color: #fff; }
  #status { text-align: center; padding: 60px 0; color: #666; }
  .top-bar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  #logoutBtn { width: auto; background: none; color: #c0392b; font-weight: 600; font-size: 13px; padding: 6px 8px; }
  #debugBox { display: none; max-width: 560px; margin: 0 auto 12px; background: #fff3cd; border: 1px solid #ffe69c; color: #664d03; border-radius: 8px; padding: 12px; font-size: 12px; font-family: monospace; word-break: break-word; white-space: pre-wrap; }
</style>
<script>
  window.__showDebug = function (msg) {
    var box = document.getElementById('debugBox');
    if (!box) return;
    box.style.display = 'block';
    box.textContent += (box.textContent ? '\\n' : '') + msg;
  };
  window.onerror = function (msg, src, line) { window.__showDebug('ERROR JS: ' + msg + ' (linea ' + line + ')'); };
  window.addEventListener('unhandledrejection', function (ev) {
    window.__showDebug('PROMISE ERROR: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason));
  });
</script>
<script src="/supabase.js" onerror="window.__showDebug('No se pudo cargar /supabase.js (problema de red)')"></script>
</head>
<body>
<div id="debugBox"></div>
<div class="container">
  <div id="status">Cargando...</div>
  <div id="content" style="display:none">
    <div class="top-bar"><button id="logoutBtn" style="flex:none;">Cerrar sesión</button></div>
    <h1>Publicidad · Cola de aprobación</h1>
    <p class="helper">Campañas pagadas, pendientes de revisión antes de mostrarse a los clientes.</p>
    <div id="list"></div>
  </div>
</div>
<script>
  if (!window.supabase) {
    window.__showDebug('window.supabase es undefined al ejecutar el script principal.');
    document.getElementById('status').textContent = 'No se pudo cargar la librería de Supabase.';
    throw new Error('window.supabase not loaded');
  }

  const sb = window.supabase.createClient(
    ${JSON.stringify((process.env.SUPABASE_URL || '').trim())},
    ${JSON.stringify((process.env.SUPABASE_ANON_KEY || '').trim())}
  );

  async function init() {
    try {
      await initInner();
    } catch (err) {
      window.__showDebug('EXCEPTION en init(): ' + (err && err.message ? err.message : err));
      document.getElementById('status').textContent = 'Ocurrió un error al cargar.';
    }
  }

  async function initInner() {
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) {
      window.location.href = '/api/login?next=/api/admin-ads';
      return;
    }
    const userId = sessionData.session.user.id;

    const { data: userRow } = await sb.from('users').select('role').eq('id', userId).maybeSingle();
    if (!userRow || userRow.role !== 'admin') {
      document.getElementById('status').textContent = 'No autorizado: esta cuenta no es admin.';
      return;
    }

    document.getElementById('status').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await sb.auth.signOut({ scope: 'local' });
      window.location.href = '/api/login';
    });

    await loadPending();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function loadPending() {
    const { data, error } = await sb.functions.invoke('admin-campaigns', { body: { action: 'list' } });

    const listEl = document.getElementById('list');
    if (error) {
      window.__showDebug('error cargando campañas: ' + error.message);
      listEl.innerHTML = '<p class="helper">No se pudo cargar la cola.</p>';
      return;
    }
    if (data && data.error) {
      window.__showDebug('error cargando campañas: ' + data.error);
      listEl.innerHTML = '<p class="helper">No se pudo cargar la cola.</p>';
      return;
    }
    const ads = data ? data.campaigns : [];
    if (!ads || ads.length === 0) {
      listEl.innerHTML = '<p class="helper">No hay campañas pendientes de revisión.</p>';
      return;
    }

    listEl.innerHTML = ads.map((ad) => (
      '<div class="card" id="ad-' + escapeHtml(ad.id) + '">' +
        '<div class="card-header"><span class="card-title">' + escapeHtml(ad.businesses ? ad.businesses.name : 'Negocio') + '</span></div>' +
        '<p class="meta">' + escapeHtml(ad.title) + '</p>' +
        '<p class="meta">Alcance: ' + escapeHtml(ad.target_city || 'Nacional') + '</p>' +
        '<p class="meta">' + new Date(ad.starts_at).toLocaleDateString('es-EC') + ' – ' + new Date(ad.ends_at).toLocaleDateString('es-EC') + '</p>' +
        (ad.link_url ? '<p class="meta">Link: ' + escapeHtml(ad.link_url) + '</p>' : '') +
        '<img class="preview" src="' + escapeHtml(ad.image_url) + '" />' +
        '<div class="actions">' +
        '<button class="approve" data-id="' + escapeHtml(ad.id) + '" data-action="active">Aprobar</button>' +
        '<button class="reject" data-id="' + escapeHtml(ad.id) + '" data-action="rejected">Rechazar</button>' +
        '</div>' +
      '</div>'
    )).join('');

    document.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        document.querySelectorAll('#ad-' + id + ' button').forEach((b) => (b.disabled = true));
        const { data, error } = await sb.functions.invoke('admin-campaigns', {
          body: { action: 'review', id, decision: action },
        });
        if (error || (data && data.error)) {
          window.__showDebug('error actualizando campaña ' + id + ': ' + (error ? error.message : data.error));
          document.querySelectorAll('#ad-' + id + ' button').forEach((b) => (b.disabled = false));
          return;
        }
        const card = document.getElementById('ad-' + id);
        if (card) card.remove();
        const listEl = document.getElementById('list');
        if (!listEl.children.length) listEl.innerHTML = '<p class="helper">No hay campañas pendientes de revisión.</p>';
      });
    });
  }

  init();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
