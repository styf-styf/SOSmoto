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
  .card { background: #fff; border-radius: 20px; padding: 20px; margin-bottom: 16px; border: 1px solid #e0e0e0; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
  .card.current { border-color: #FF6B00; border-width: 2px; background: #FFF8F2; }
  .card-header { display: flex; justify-content: space-between; align-items: center; }
  .card-title { font-size: 20px; font-weight: 800; }
  .badge { font-size: 11px; font-weight: 700; color: #fff; background: #FF6B00; border-radius: 999px; padding: 4px 10px; }
  .price-row { display: flex; align-items: flex-end; margin: 10px 0 14px; }
  .price-amount { font-size: 38px; font-weight: 800; color: #FF6B00; line-height: 1; }
  .price-period { font-size: 15px; font-weight: 600; color: #666; margin-left: 4px; }
  .divider { height: 1px; background: #e5e5ea; margin-bottom: 14px; }
  .feature-list { display: flex; flex-direction: column; gap: 12px; }
  .feature { font-size: 14px; color: #1a1a1a; display: flex; align-items: center; gap: 10px; }
  .feature.unavailable { color: #999; }
  .feature .check { color: #FF6B00; font-size: 16px; flex-shrink: 0; }
  .feature .no-check { color: #e5e5ea; font-size: 16px; flex-shrink: 0; }
  button { width: 100%; padding: 14px; background: #FF6B00; color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 20px; }
  button:disabled { opacity: 0.6; }
  .top-bar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  #logoutBtn { width: auto; background: none; color: #c0392b; font-weight: 600; font-size: 13px; padding: 6px 8px; margin-top: 0; }
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
    <div class="top-bar"><button id="logoutBtn">Cerrar sesión</button></div>
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
  const dashboardTierLabel = { free: 'Básico', standard: 'Intermedio', pro: 'Avanzado' };
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
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const targetPlanId = urlParams.get('planId');
    if (code) {
      // Codigo de un solo uso emitido por la app (servicio web-login-ticket)
      // para auto-loguear sin pedir email/contraseña de nuevo en el portal.
      const { data: exchangeData, error: exchangeError } = await sb.functions.invoke('web-login-exchange', {
        body: { code },
      });
      history.replaceState(null, '', window.location.pathname);
      if (exchangeError) {
        window.__showDebug('exchange error: ' + (exchangeError.message || JSON.stringify(exchangeError)));
      } else if (exchangeData && exchangeData.error) {
        window.__showDebug('exchange data error: ' + exchangeData.error);
      } else if (exchangeData && exchangeData.access_token) {
        const { error: setSessionError } = await sb.auth.setSession({
          access_token: exchangeData.access_token,
          refresh_token: exchangeData.refresh_token,
        });
        if (setSessionError) {
          window.__showDebug('setSession error: ' + setSessionError.message);
        }
      } else {
        window.__showDebug('exchange devolvio algo inesperado: ' + JSON.stringify(exchangeData));
      }
    }

    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) {
      const debugBox = document.getElementById('debugBox');
      if (debugBox && debugBox.style.display === 'block') {
        // Hubo un error en el auto-login por codigo -- no redirigir todavia,
        // que se vea el detalle antes de mandar al login manual.
        document.getElementById('status').innerHTML =
          'No se pudo iniciar sesión automáticamente. <a href="/api/login">Entrar manualmente</a>';
        return;
      }
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

    const [{ data: servicesData }, { data: productsData }, { data: employeesData }] = await Promise.all([
      sb.from('services').select('is_active').eq('business_id', business.id),
      sb.from('products').select('is_active').eq('business_id', business.id),
      sb.rpc('get_business_employees', { target_business_id: business.id }),
    ]);
    const usage = {
      services: (servicesData || []).filter((s) => s.is_active).length,
      products: (productsData || []).filter((p) => p.is_active).length,
      employees: (employeesData || []).length + 1,
    };

    async function executeSwitch(planId) {
      const targetPrice = ((plans || []).find((p) => p.id === planId) || {}).price_monthly || 0;
      if (targetPrice <= 0) {
        const { error } = await sb.from('businesses').update({ plan_id: planId }).eq('id', business.id);
        if (error) { alert('No se pudo cambiar de plan.'); return false; }
        window.location.reload();
        return true;
      }

      const { data, error } = await sb.functions.invoke('payphone-prepare', {
        body: { businessId: business.id, planId },
      });
      if (error || (data && data.error)) {
        alert('No se pudo iniciar el pago: ' + ((data && data.error) || (error && error.message)));
        return false;
      }
      window.location.href = data.checkoutUrl;
      return true;
    }

    // Si la app mandó un plan preseleccionado (usuario ya confirmó ahí),
    // saltamos la lista de planes e iniciamos el pago directamente.
    const preselectedPlan = targetPlanId ? (plans || []).find((p) => p.id === targetPlanId) : null;
    if (preselectedPlan && preselectedPlan.id !== business.plan_id) {
      document.getElementById('status').textContent = 'Redirigiendo al pago...';
      document.getElementById('status').style.display = 'block';
      const ok = await executeSwitch(preselectedPlan.id);
      if (!ok) {
        document.getElementById('status').style.display = 'none';
        document.getElementById('content').style.display = 'block';
      } else {
        return;
      }
    }

    document.getElementById('status').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      // scope:'local' -- por defecto signOut() es 'global' y revoca TODAS
      // las sesiones del usuario, incluida la de la app movil. Cerrar
      // sesion aqui no deberia desloguear la app.
      await sb.auth.signOut({ scope: 'local' });
      window.location.href = '/api/login';
    });

    if (activeSub && activeSub.expires_at) {
      document.getElementById('expiry').innerHTML =
        '<p class="helper">Tu plan actual vence el ' + new Date(activeSub.expires_at).toLocaleDateString('es-EC') + '.</p>';
    }

    const plansEl = document.getElementById('plans');
    plansEl.innerHTML = (plans || []).map((plan) => {
      const isCurrent = plan.id === business.plan_id;
      const features = [
        { label: 'Productos: ' + limitLabel(plan.max_products), available: true },
        { label: 'Servicios: ' + limitLabel(plan.max_services), available: true },
        { label: 'Fotos por producto/servicio/publicación: ' + plan.max_photos_per_item, available: true },
        { label: 'Personas en el equipo: ' + limitLabel(plan.max_employees), available: true },
        { label: 'Historias activas: ' + limitLabel(plan.max_active_stories), available: true },
        { label: 'Dashboard/métricas: ' + (dashboardTierLabel[plan.name] || plan.name), available: true },
        { label: 'Insignia de verificado (KYC)', available: plan.name !== 'free' },
      ];
      return '<div class="card ' + (isCurrent ? 'current' : '') + '">' +
        '<div class="card-header"><span class="card-title">' + (planLabel[plan.name] || plan.name) + '</span>' +
        (isCurrent ? '<span class="badge">Tu plan actual</span>' : '') + '</div>' +
        '<div class="price-row">' +
          (plan.price_monthly > 0
            ? '<span class="price-amount">$' + plan.price_monthly.toFixed(2) + '</span><span class="price-period">/mes</span>'
            : '<span class="price-amount">Gratis</span>') +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="feature-list">' +
        features.map((f) =>
          '<div class="feature' + (f.available ? '' : ' unavailable') + '">' +
            '<span class="' + (f.available ? 'check' : 'no-check') + '">' + (f.available ? '&#10003;' : '&#8854;') + '</span>' +
            '<span>' + f.label + '</span>' +
          '</div>'
        ).join('') +
        '</div>' +
        (!isCurrent ? '<button data-plan-id="' + plan.id + '" data-price="' + plan.price_monthly + '" data-plan-name="' + (planLabel[plan.name] || plan.name) + '" class="pay-btn">' +
          (plan.price_monthly > 0 ? 'Obtener plan ' + (planLabel[plan.name] || plan.name) : 'Cambiar a plan ' + (planLabel[plan.name] || plan.name)) +
          '</button>' : '') +
        '</div>';
    }).join('');

    document.querySelectorAll('.pay-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const planId = btn.getAttribute('data-plan-id');
        const planName = btn.getAttribute('data-plan-name');
        const price = parseFloat(btn.getAttribute('data-price'));
        const plan = (plans || []).find((p) => p.id === planId);
        const expiresLabel = activeSub && activeSub.expires_at
          ? new Date(activeSub.expires_at).toLocaleDateString('es-EC')
          : null;

        const lines = price > 0
          ? [
              'Pagarás $' + price.toFixed(2) + '/mes vía Payphone.',
              'El plan se activa de inmediato en cuanto se confirme el pago.',
            ]
          : ['Vas a cambiar a un plan gratuito.'];

        if (price <= 0 && plan) {
          const warnings = [];
          if (plan.max_services !== null && usage.services > plan.max_services) {
            warnings.push('tienes ' + usage.services + ' servicios activos (el plan permite ' + plan.max_services + ')');
          }
          if (plan.max_products !== null && usage.products > plan.max_products) {
            warnings.push('tienes ' + usage.products + ' productos activos (el plan permite ' + plan.max_products + ')');
          }
          if (plan.max_employees !== null && usage.employees > plan.max_employees) {
            warnings.push('tienes ' + usage.employees + ' personas en el equipo (el plan permite ' + plan.max_employees + ')');
          }
          if (warnings.length > 0) {
            lines.push(
              'Al cambiarte a ' + planName + ', ' + warnings.join('; ') +
                '. No se eliminará nada, pero no podrás agregar más hasta bajar de esos números.'
            );
          }
        }

        if (expiresLabel) {
          lines.push(
            (price > 0 ? 'Esto reemplaza' : 'Perderás') +
              ' tu plan actual (vencía el ' + expiresLabel + '); los días que te quedaban no se ' +
              (price > 0 ? 'prorratean ni se reembolsan.' : 'reembolsan.')
          );
        }
        if (!window.confirm((price > 0 ? 'Obtener plan ' : 'Cambiar a plan ') + planName + '\\n\\n' + lines.join('\\n'))) {
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Procesando...';

        const ok = await executeSwitch(planId);
        if (!ok) {
          btn.disabled = false;
          btn.textContent = price > 0 ? 'Reintentar' : 'Cambiar a plan ' + planName;
        }
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
