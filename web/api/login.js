module.exports = async (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Iniciar sesión</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<style>
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
  .card { max-width: 360px; margin: 40px auto; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  h1 { font-size: 20px; margin-bottom: 16px; color: #1a1a1a; }
  input { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; box-sizing: border-box; }
  button { width: 100%; padding: 12px; background: #FF6B00; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: 0.6; }
  .error { color: #c0392b; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
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
  const supabase = window.supabase.createClient(
    '${process.env.SUPABASE_URL}',
    '${process.env.SUPABASE_ANON_KEY}'
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
