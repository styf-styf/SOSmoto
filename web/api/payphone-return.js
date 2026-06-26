// Recibe tanto el regreso del navegador (GET, con id/clientTransactionId en
// la query) como el webhook servidor-a-servidor de Payphone (POST) cuando el
// pago se completa. Vive en el mismo dominio que el checkout (Vercel) para
// que coincida con "Dominio web" registrado en el panel de Payphone.
const CONFIRM_URL = `${process.env.SUPABASE_URL}/functions/v1/payphone-confirm`;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Payphone no siempre manda JSON estricto en el webhook; extraemos los
// campos con regex en vez de depender de un parser estricto.
function extractField(raw, key) {
  const re = new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']?([^,"'}&\\s]+)`, 'i');
  const match = raw.match(re);
  return match ? match[1].trim() : null;
}

async function confirm(id, clientTransactionId) {
  try {
    const response = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ id, clientTransactionId }),
    });
    return await response.json();
  } catch (err) {
    console.error('confirm call error', err);
    return { success: false };
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      let id;
      let clientTransactionId;
      const b = req.body;
      if (b && typeof b === 'object') {
        id = b.id || b.transactionId;
        clientTransactionId = b.clientTransactionId;
      }
      const raw = typeof b === 'string' ? b : JSON.stringify(b || {});
      console.log('payphone webhook body:', raw, '| type:', typeof b);
      id = id || extractField(raw, 'id') || extractField(raw, 'transactionId') || req.query.id;
      clientTransactionId = clientTransactionId || extractField(raw, 'clientTransactionId') || req.query.clientTransactionId;
      if (id && clientTransactionId) {
        await confirm(id, clientTransactionId);
      }
    } catch (err) {
      console.error('payphone webhook error', err);
    }
    res.status(200).send('OK');
    return;
  }

  const id = req.query.id;
  const clientTransactionId = req.query.clientTransactionId;
  let result = { success: false };
  if (id && clientTransactionId) {
    result = await confirm(id, clientTransactionId);
  } else {
    result = { success: false, error: 'Payphone no envió id/clientTransactionId en la URL de retorno', query: req.query };
  }

  const debugLine = result.success
    ? ''
    : `<pre style="text-align:left;max-width:400px;margin:16px auto;background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:12px;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-word;">${
        JSON.stringify({ id, clientTransactionId, result }, null, 2)
      }</pre>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Pago</title>
<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:60px 24px;background:#f5f5f5;}
h1{font-size:20px;} a{color:#FF6B00;font-weight:600;text-decoration:none;}</style>
</head>
<body>
<h1>${result.success ? 'Pago aprobado ✅' : 'No pudimos confirmar el pago'}</h1>
<p>${result.success ? 'Tu plan se actualizó.' : 'Si ya pagaste, espera un momento y vuelve a tu suscripción — si el cargo se aprobó, se reflejará solo.'}</p>
${debugLine}
<a href="/api/suscripcion">Volver a mi suscripción</a>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
