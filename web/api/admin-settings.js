module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Admin · Configuración</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #1a1a1a; }
  .container { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  .helper { color: #666; font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #e0e0e0; }
  .field { margin-bottom: 14px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #444; margin-bottom: 4px; }
  input[type="number"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box; }
  .radius-row { display: flex; justify-content: space-between; align-items: center; background: #f9f9f9; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; }
  .radius-summary { font-size: 13px; color: #444; }
  .radius-summary b { color: #1a1a1a; }
  .link-btn { background: none; border: none; color: #FF6B00; font-weight: 600; font-size: 13px; cursor: pointer; padding: 4px; }
  .radius-edit { display: none; }
  .radius-edit.open { display: block; }
  .info-box { background: #fff8f0; border: 1px solid #ffe0c2; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #663c00; line-height: 1.5; margin-bottom: 12px; }
  .info-box code { background: #fff0dc; padding: 1px 4px; border-radius: 4px; }
  .alert { display: none; background: #fbe8e8; border: 1px solid #f0b8b8; color: #a33; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
  .alert.show { display: block; }
  .success { display: none; background: #e6f5ea; border: 1px solid #b8e0c2; color: #1e6b34; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
  .success.show { display: block; }
  button.primary { width: 100%; padding: 12px; background: #FF6B00; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 4px; }
  button.primary:disabled { opacity: 0.6; }
  #status { text-align: center; padding: 60px 0; color: #666; }
  .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .top-bar a { color: #444; font-size: 13px; text-decoration: none; }
  #logoutBtn { background: none; border: none; color: #c0392b; font-weight: 600; font-size: 13px; padding: 6px 8px; cursor: pointer; }
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
    <div class="top-bar">
      <a href="/api/admin-ads">← Publicidad (aprobación)</a>
      <button id="logoutBtn">Cerrar sesión</button>
    </div>
    <h1>Configuración</h1>
    <p class="helper">Reglas del sistema. Los cambios aplican de inmediato a las campañas nuevas.</p>

    <div class="card">
      <h2>Precio de publicidad</h2>
      <p class="helper">Precio por día según el alcance de la campaña.</p>

      <div id="alert" class="alert"></div>
      <div id="success" class="success">Guardado.</div>

      <div class="field">
        <label for="cityPrice">Solo tu ciudad ($/día)</label>
        <input type="number" id="cityPrice" step="0.01" min="0" />
      </div>

      <div class="radius-row">
        <div class="radius-summary" id="radiusSummary">Radio: cargando…</div>
        <button class="link-btn" id="editRadiusBtn" type="button">Editar</button>
      </div>
      <div class="radius-edit" id="radiusEdit">
        <div class="info-box">
          El precio del radio no se fija a mano -- se interpola entre el precio de Ciudad y el de País usando estos
          dos anclajes en <b>kilómetros</b> (no en dólares): a <code>radio de referencia</code> km cuesta lo mismo
          que "Ciudad"; a <code>radio tope</code> km (o más) cuesta lo mismo que "País" y ya no sigue subiendo.
          Fórmula: <code>precio(km) = base + tarifa_por_km × km</code>, donde <code>tarifa_por_km</code> y
          <code>base</code> se recalculan solos cada vez a partir de los precios de Ciudad/País de arriba -- por eso
          no hace falta editar esto cuando solo cambian los precios, solo si quieres mover en qué radio exacto
          cruza cada tarifa.
        </div>
        <div class="field">
          <label for="referenceKm">Radio de referencia (km) -- aquí cuesta igual que "Ciudad"</label>
          <input type="number" id="referenceKm" step="1" min="1" />
        </div>
        <div class="field">
          <label for="capKm">Radio tope (km) -- aquí cuesta igual que "País" y deja de subir</label>
          <input type="number" id="capKm" step="1" min="1" />
        </div>
      </div>

      <div class="field">
        <label for="nationalPrice">País / Nacional ($/día)</label>
        <input type="number" id="nationalPrice" step="0.01" min="0" />
      </div>

      <button class="primary" id="saveBtn" type="button">Guardar</button>
    </div>
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

  let currentPricing = null;

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
      window.location.href = '/api/login?next=/api/admin-settings';
      return;
    }
    const userId = sessionData.session.user.id;

    const { data: userRow } = await sb.from('users').select('role').eq('id', userId).maybeSingle();
    if (!userRow || userRow.role !== 'admin') {
      document.getElementById('status').textContent = 'No autorizado: esta cuenta no es admin.';
      return;
    }

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await sb.auth.signOut({ scope: 'local' });
      window.location.href = '/api/login';
    });

    document.getElementById('editRadiusBtn').addEventListener('click', () => {
      const editBox = document.getElementById('radiusEdit');
      const isOpen = editBox.classList.toggle('open');
      document.getElementById('editRadiusBtn').textContent = isOpen ? 'Listo' : 'Editar';
    });

    document.getElementById('saveBtn').addEventListener('click', handleSave);

    await loadPricing();

    document.getElementById('status').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  }

  function renderSummary() {
    if (!currentPricing) return;
    document.getElementById('radiusSummary').innerHTML =
      'Radio: <b>' + currentPricing.radius_reference_km + ' km</b> = precio de Ciudad · <b>' +
      currentPricing.radius_cap_km + ' km</b> (o más) = precio de País';
  }

  async function loadPricing() {
    const { data, error } = await sb.functions.invoke('admin-ad-pricing', { body: { action: 'get' } });
    if (error || (data && data.error)) {
      window.__showDebug('error cargando precios: ' + (error ? error.message : data.error));
      return;
    }
    currentPricing = data.pricing;
    document.getElementById('cityPrice').value = currentPricing.price_per_day_city;
    document.getElementById('nationalPrice').value = currentPricing.price_per_day_national;
    document.getElementById('referenceKm').value = currentPricing.radius_reference_km;
    document.getElementById('capKm').value = currentPricing.radius_cap_km;
    renderSummary();
  }

  function showAlert(msg) {
    const alertEl = document.getElementById('alert');
    alertEl.textContent = msg;
    alertEl.classList.add('show');
    document.getElementById('success').classList.remove('show');
  }

  function clearAlert() {
    document.getElementById('alert').classList.remove('show');
  }

  async function handleSave() {
    clearAlert();
    document.getElementById('success').classList.remove('show');

    const city = Number(document.getElementById('cityPrice').value);
    const national = Number(document.getElementById('nationalPrice').value);
    const referenceKm = Number(document.getElementById('referenceKm').value);
    const capKm = Number(document.getElementById('capKm').value);

    if (![city, national, referenceKm, capKm].every((n) => Number.isFinite(n) && n > 0)) {
      showAlert('Todos los valores deben ser números mayores a 0.');
      return;
    }
    if (city > national) {
      showAlert('El precio de "Solo tu ciudad" no puede ser mayor al de "País" (ni el de País menor al de Ciudad).');
      return;
    }
    if (referenceKm >= capKm) {
      showAlert('El "radio de referencia" debe ser menor al "radio tope".');
      return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    try {
      const { data, error } = await sb.functions.invoke('admin-ad-pricing', {
        body: {
          action: 'update',
          prices: {
            price_per_day_city: city,
            price_per_day_national: national,
            radius_reference_km: referenceKm,
            radius_cap_km: capKm,
          },
        },
      });
      if (error || (data && data.error)) {
        showAlert(error ? error.message : data.error);
        return;
      }
      currentPricing = {
        price_per_day_city: city,
        price_per_day_national: national,
        radius_reference_km: referenceKm,
        radius_cap_km: capKm,
      };
      renderSummary();
      document.getElementById('success').classList.add('show');
    } finally {
      btn.disabled = false;
    }
  }

  init();
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
