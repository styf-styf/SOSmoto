const { COLORS, escapeHtml } = require('./_lib/webPage');

// Endpoint genérico de "abrir en la app" para botones de correos
// transaccionales (Resend). Un link crudo `sosmoto://...` puesto directo en
// el HTML de un correo no es confiable -- los clientes de correo (Gmail
// incluido) no siempre reconocen esquemas custom en un <a href>, a
// diferencia de un link https normal que sí abren en el navegador del
// teléfono. Este endpoint es la parte https: el correo enlaza acá, y esta
// página (ya corriendo en el navegador móvil) sí puede saltar a
// sosmoto://... con éxito -- mismo patrón que ya usan las páginas de vista
// previa (ver web/api/_lib/previewPage.js, línea ~524/530).
//
// Uso: /api/abrir?to=pago-resultado&tipo=subscription&ok=1
// "to" es la ruta interna (sin sosmoto://), el resto de los query params se
// reenvían tal cual al deep link.
const SAFE_PATH = /^[a-zA-Z0-9/_-]+$/;

module.exports = (req, res) => {
  const { to, ...rest } = req.query;

  if (!to || Array.isArray(to) || !SAFE_PATH.test(to)) {
    res.status(400).send('Falta o es inválido el parámetro "to".');
    return;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  const appLink = `sosmoto://${to}${query ? `?${query}` : ''}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" href="/favicon.png">
<title>Abrir en SOSmoto</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${COLORS.surface};margin:0;padding:60px 24px;text-align:center;}
.brand{color:${COLORS.primary};font-weight:700;font-size:16px;margin-bottom:24px;display:block;text-decoration:none;}
h1{font-size:16px;color:${COLORS.text};font-weight:600;margin-bottom:24px;}
.button{display:inline-block;background:${COLORS.primary};color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:24px;}
</style>
</head>
<body>
<a class="brand" href="/">SOSmoto</a>
<h1>Abriendo la app…</h1>
<a class="button" href="${escapeHtml(appLink)}">Ver en SOSmoto</a>
<script>
setTimeout(function () { window.location.href = ${JSON.stringify(appLink)}; }, 300);
</script>
</body>
</html>`);
};
