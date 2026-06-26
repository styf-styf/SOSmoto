const { createClient } = require('@supabase/supabase-js');

// Recibe tanto el regreso del navegador (GET, con id/clientTransactionId en
// la query) como el webhook servidor-a-servidor de Payphone (POST) cuando el
// pago se completa. Vive en el mismo dominio que el checkout (Vercel) para
// que coincida con "Dominio web" registrado en el panel de Payphone.
const CONFIRM_URL = `${process.env.SUPABASE_URL}/functions/v1/payphone-confirm`;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Payphone no siempre manda JSON estricto en el webhook; extraemos los
// campos con regex en vez de depender de un parser estricto.
function extractField(raw, key) {
  const re = new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']?([^,"'}&\\s]+)`, 'i');
  const match = raw.match(re);
  return match ? match[1].trim() : null;
}

async function confirm(id, clientTransactionId, transactionStatus) {
  try {
    const response = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ id, clientTransactionId, transactionStatus }),
    });
    return await response.json();
  } catch (err) {
    console.error('confirm call error', err);
    return { success: false };
  }
}

// EcuaPred (integración de Payphone previa, probada en producción incluyendo
// el handoff a la app nativa) NUNCA llama a V3/Confirm desde la página de
// retorno del navegador -- solo desde el webhook server-to-server. La
// página de retorno solo refleja lo que el webhook ya haya confirmado. Acá
// hacemos lo mismo: en vez de volver a llamar a V3/Confirm desde el GET (que
// tiene un bug confirmado con Payphone para pagos via handoff a la app),
// esperamos un poco a que el webhook (que corre en paralelo) actualice la
// fila en `payments` y solo leemos su estado.
async function waitForPaymentStatus(clientTransactionId, { attempts = 6, delayMs = 1000 } = {}) {
  const supabase = supabaseAdmin();
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase
      .from('payments')
      .select('status, gateway_transaction_id')
      .eq('client_transaction_id', clientTransactionId)
      .maybeSingle();
    if (data && data.status === 'completed') return { success: true, payment: data };
    if (data && data.status === 'failed') return { success: false, payment: data };
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { success: false, payment: null, timedOut: true };
}

// EcuaPred tampoco verifica nada con Payphone en su pagina de retorno: si el
// navegador llega ahi con un `id` valido, confia en eso y acredita directo
// (el webhook es secundario, no bloquea el camino feliz). Replicamos eso:
// si el webhook no confirmo a tiempo, pero el pago que NOSOTROS creamos
// (con un client_transaction_id que es un UUID propio, no adivinable) sigue
// 'pending', confiamos en que Payphone solo redirige aqui tras un pago
// exitoso y activamos el plan -- evita depender de V3/Confirm (con bug
// confirmado) o del webhook (que no esta llegando).
async function activateByTrust(clientTransactionId, gatewayId) {
  const supabase = supabaseAdmin();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, business_id, plan_id, status')
    .eq('client_transaction_id', clientTransactionId)
    .maybeSingle();
  if (!payment || payment.status !== 'pending') return { success: false, payment };

  await supabase.from('payments').update({ status: 'completed', gateway_transaction_id: gatewayId }).eq('id', payment.id);

  if (payment.plan_id) {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await supabase.from('business_subscriptions').update({ status: 'expired' }).eq('business_id', payment.business_id).eq('status', 'active');
    await supabase.from('business_subscriptions').insert({
      business_id: payment.business_id,
      plan_id: payment.plan_id,
      status: 'active',
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_id: payment.id,
    });
    await supabase.from('businesses').update({ plan_id: payment.plan_id }).eq('id', payment.business_id);
  }

  return { success: true, payment, trusted: true };
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    let id;
    let clientTransactionId;
    let transactionStatus;
    let raw = '';
    try {
      const b = req.body;
      if (b && typeof b === 'object') {
        id = b.id || b.transactionId;
        clientTransactionId = b.clientTransactionId;
        transactionStatus = b.transactionStatus;
      }
      raw = typeof b === 'string' ? b : JSON.stringify(b || {});
      console.log('payphone webhook body:', raw, '| type:', typeof b);
      id = id || extractField(raw, 'id') || extractField(raw, 'transactionId') || req.query.id;
      clientTransactionId = clientTransactionId || extractField(raw, 'clientTransactionId') || req.query.clientTransactionId;
      transactionStatus = transactionStatus || extractField(raw, 'transactionStatus') || req.query.transactionStatus;
    } catch (err) {
      console.error('payphone webhook parse error', err);
    }

    // Log permanente del webhook crudo -- sin esto no hay forma de revisar
    // que Payphone realmente llamó ni qué mandó, ya que no tenemos acceso
    // directo a los logs de Vercel desde aquí.
    try {
      await supabaseAdmin().from('payphone_webhook_logs').insert({
        raw_body: raw,
        extracted: { id, clientTransactionId, transactionStatus, query: req.query },
      });
    } catch (err) {
      console.error('webhook log insert error', err);
    }

    try {
      if (id && clientTransactionId) {
        await confirm(id, clientTransactionId, transactionStatus);
      }
    } catch (err) {
      console.error('payphone webhook confirm error', err);
    }
    res.status(200).send('OK');
    return;
  }

  const clientTransactionId = req.query.clientTransactionId;
  const id = req.query.id;
  let wait = clientTransactionId ? await waitForPaymentStatus(clientTransactionId) : { success: false, payment: null };
  if (wait.timedOut && clientTransactionId && id) {
    // El webhook nunca llego (status sigue 'pending', no es un rechazo
    // explicito) -- confiamos en el retorno del navegador, igual que EcuaPred.
    wait = await activateByTrust(clientTransactionId, id);
  }

  const debugLine = wait.success
    ? ''
    : `<pre style="text-align:left;max-width:400px;margin:16px auto;background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:12px;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-word;">${
        JSON.stringify({ query: req.query, wait }, null, 2)
      }</pre>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Pago</title>
<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:60px 24px;background:#f5f5f5;}
h1{font-size:20px;} a{color:#FF6B00;font-weight:600;text-decoration:none;}</style>
</head>
<body>
<h1>${wait.success ? 'Pago aprobado ✅' : 'No pudimos confirmar el pago todavía'}</h1>
<p>${wait.success ? 'Tu plan se actualizó.' : 'Si ya pagaste, espera un momento y vuelve a tu suscripción — la confirmación llega por separado y puede tardar unos segundos más.'}</p>
${debugLine}
<a href="/api/suscripcion">Volver a mi suscripción</a>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
