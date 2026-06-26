module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Iniciar sesión</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
  .card { max-width: 360px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  h1 { font-size: 20px; margin-bottom: 16px; color: #1a1a1a; }
  input { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box; }
  button { width: 100%; padding: 12px; background: #FF6B00; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .error { color: #c0392b; font-size: 13px; margin-top: 8px; }
  #debugBox { display: none; max-width: 360px; margin: 0 auto 12px; background: #fff3cd; border: 1px solid #ffe69c; color: #664d03; border-radius: 8px; padding: 12px; font-size: 12px; font-family: monospace; word-break: break-word; white-space: pre-wrap; }
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
<div class="card">
  <h1>SOSmoto · Negocio</h1>
  <form id="loginForm">
    <input type="email" id="email" placeholder="Correo electrónico" required autocomplete="email" />
    <input type="password" id="password" placeholder="Contraseña" required autocomplete="current-password" />
    <button type="submit" id="submitBtn">Iniciar sesión</button>
    <div class="error" id="error"></div>
  </form>
</div>
<script>
  if (!window.supabase) {
    window.__showDebug('window.supabase es undefined al ejecutar el script principal.');
    document.getElementById('error').textContent = 'No se pudo cargar la librería de Supabase. Revisa tu conexión e intenta de nuevo.';
    throw new Error('window.supabase not loaded');
  }

  const supabase = window.supabase.createClient(
    ${JSON.stringify((process.env.SUPABASE_URL || '').trim())},
    ${JSON.stringify((process.env.SUPABASE_ANON_KEY || '').trim())}
  );

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = '/api/suscripcion';
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('submitBtn');
    const errorEl = document.getElementById('error');
    errorEl.textContent = '';
    btn.disabled = true;
    let result;
    try {
      result = await supabase.auth.signInWithPassword({ email, password });
    } catch (err) {
      btn.disabled = false;
      window.__showDebug('EXCEPTION en signInWithPassword: ' + (err && err.message ? err.message : err));
      errorEl.textContent = 'Error de conexión al iniciar sesión. Intenta de nuevo.';
      return;
    }
    const { error } = result;
    btn.disabled = false;
    if (error) {
      errorEl.textContent = 'No se pudo iniciar sesión: ' + error.message;
      return;
    }
    window.location.href = '/api/suscripcion';
  });
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
