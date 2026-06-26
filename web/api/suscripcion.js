module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Suscripción</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #1a1a1a; }
  .container { max-width: 480px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .helper { color: #666; font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid #e0e0e0; }
  .card.current { border-color: #FF6B00; background: #FFF1E6; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 17px; font-weight: 700; }
  .badge { font-size: 12px; font-weight: 600; color: #FF6B00; }
  .price { font-size: 15px; font-weight: 600; margin: 4px 0 10px; }
  .feature { font-size: 13px; color: #555; margin-bottom: 2px; }
  button { width: 100%; padding: 12px; background: #FF6B00; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 12px; }
  button:disabled { opacity: 0.6; }
  #status { text-align: center; padding: 60px 0; color: #666; }
  #debugBox { display: none; max-width: 480px; margin: 0 auto 12px; background: #fff3cd; border: 1px solid #ffe69c; color: #664d03; border-radius: 8px; padding: 12px; font-size: 12px; font-family: monospace; word-break: break-word; white-space: pre-wrap; }
</style>
<script>
  window.__showDebug = function (msg) {
    var box = document.getElementById('debugBox');
    if (!box) return;
    box.style.display = 'block';
    box.textContent += (box.textContent ? '\\n' : '') + msg;
  };
  window.onerror = function (msg, src, line, col) {
    window.__showDebug('ERROR JS: ' + msg + ' (linea ' + line + ')');
  };
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
    <h1>Plan y suscripción</h1>
    <p class="helper">Los planes pagos se cobran vía Payphone. Te avisaremos antes de que venza tu suscripción.</p>
    <div id="expiry"></div>
    <div id="plans"></div>
  </div>
</div>
<script>
  if (!window.supabase) {
    window.__showDebug('window.supabase es undefined al ejecutar el script principal.');
    document.getElementById('status').textContent = 'No se pudo cargar la librería de Supabase. Revisa tu conexión e intenta de nuevo.';
    throw new Error('window.supabase not loaded');
  }

  const sb = window.supabase.createClient(
    ${JSON.stringify((process.env.SUPABASE_URL || '').trim())},
    ${JSON.stringify((process.env.SUPABASE_ANON_KEY || '').trim())}
  );

  const planLabel = { free: 'Free', standard: 'Estándar', pro: 'Pro' };
  function limitLabel(v) { return v === null ? 'Ilimitado' : v; }

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
      window.location.href = '/api/login';
      return;
    }
    const userId = sessionData.session.user.id;

    let { data: business } = await sb.from('businesses').select('*').eq('owner_id', userId).maybeSingle();
    if (!business) {
      const { data: employee } = await sb
        .from('business_employees')
        .select('businesses(*)')
        .eq('user_id', userId)
        .maybeSingle();
      business = employee && employee.businesses ? employee.businesses : null;
    }
    if (!business) {
      document.getElementById('status').textContent = 'No tienes un negocio asociado a esta cuenta.';
      return;
    }

    const { data: plans } = await sb.from('subscription_plans').select('*').order('price_monthly', { ascending: true });
    const { data: activeSub } = await sb
      .from('business_subscriptions')
      .select('expires_at')
      .eq('business_id', business.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    document.getElementById('status').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    if (activeSub && activeSub.expires_at) {
      document.getElementById('expiry').innerHTML =
        '<p class="helper">Tu plan actual vence el ' + new Date(activeSub.expires_at).toLocaleDateString('es-EC') + '.</p>';
    }

    const plansEl = document.getElementById('plans');
    plansEl.innerHTML = (plans || []).map((plan) => {
      const isCurrent = plan.id === business.plan_id;
      return '<div class="card ' + (isCurrent ? 'current' : '') + '">' +
        '<div class="card-header"><span class="card-title">' + (planLabel[plan.name] || plan.name) + '</span>' +
        (isCurrent ? '<span class="badge">Tu plan actual</span>' : '') + '</div>' +
        '<div class="price">' + (plan.price_monthly > 0 ? '$' + plan.price_monthly.toFixed(2) + '/mes' : 'Gratis') + '</div>' +
        '<div class="feature">Productos: ' + limitLabel(plan.max_products) + '</div>' +
        '<div class="feature">Servicios: ' + limitLabel(plan.max_services) + '</div>' +
        '<div class="feature">Personas en el equipo: ' + limitLabel(plan.max_employees) + '</div>' +
        (!isCurrent ? '<button data-plan-id="' + plan.id + '" data-price="' + plan.price_monthly + '" class="pay-btn">' +
          (plan.price_monthly > 0 ? 'Pagar y cambiar a ' + (planLabel[plan.name] || plan.name) : 'Cambiar a este plan') +
          '</button>' : '') +
        '</div>';
    }).join('');

    document.querySelectorAll('.pay-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const planId = btn.getAttribute('data-plan-id');
        const price = parseFloat(btn.getAttribute('data-price'));
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        if (price <= 0) {
          const { error } = await sb.from('businesses').update({ plan_id: planId }).eq('id', business.id);
          if (error) { alert('No se pudo cambiar de plan.'); btn.disabled = false; return; }
          window.location.reload();
          return;
        }

        const { data, error } = await sb.functions.invoke('payphone-prepare', {
          body: { businessId: business.id, planId },
        });
        if (error || (data && data.error)) {
          alert('No se pudo iniciar el pago: ' + ((data && data.error) || (error && error.message)));
          btn.disabled = false;
          btn.textContent = 'Reintentar';
          return;
        }
        window.location.href = data.checkoutUrl;
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
