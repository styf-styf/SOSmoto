const { createClient } = require('@supabase/supabase-js');
const { escapeHtml } = require('./_lib/webPage');

// Recibe el regreso del navegador (GET, con id/clientTransactionId en la
// query) tras el pago -- ahí mismo se confirma con Payphone (ver `confirm`).
// El handler POST queda por si Payphone algún día manda una notificación
// server-a-servidor real (feature "External Notification" de su doc, no
// configurada hoy en el panel -- solo tenemos "Dominio web" y "URL de
// respuesta"), pero el camino real de confirmación es el GET. Vive en el
// mismo dominio que el checkout (Vercel) para que coincida con "Dominio web"
// registrado en el panel de Payphone.
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
  // La Cajita de Pagos no manda un webhook servidor-a-servidor aparte (según
  // la documentación oficial: docs.payphone.app/cajita-de-pagos-payphone) --
  // la confirmación real es este mismo llamado, que debe ocurrir dentro de
  // los primeros 5 minutos tras el pago o Payphone reversa la transacción
  // sola. Antes se perdían ~6s esperando un webhook que nunca iba a llegar
  // antes de recién confirmar -- ya no hace falta esperar nada.
  // Se busca el pago por clientTransactionId (generado antes de pagar, ver
  // payphone-prepare/ad-prepare) sin importar si el confirm sale bien o mal
  // -- así el botón "Volver a SOSmoto" sabe a qué pantalla mandar al negocio
  // (suscripción o publicidad) incluso cuando el pago falló.
  let payment = null;
  if (clientTransactionId) {
    const { data } = await supabaseAdmin()
      .from('payments')
      .select('id, business_id, plan_id, status, type')
      .eq('client_transaction_id', clientTransactionId)
      .maybeSingle();
    payment = data;
  }

  let wait = { success: false, payment };
  if (clientTransactionId && id) {
    // No confiamos ciegamente en que el navegador solo redirige aqui tras un
    // pago real (eso permitía activar un plan/campaña con un
    // clientTransactionId propio sin pagar, ver git history) -- siempre se
    // verifica con Payphone antes de activar nada.
    const confirmResult = await confirm(id, clientTransactionId, undefined);
    wait =
      confirmResult && confirmResult.success
        ? { success: true, payment }
        : { success: false, payment, confirmResult };
  }

  // "ok" viaja en el deep link para que pago-resultado.tsx pueda avisar si
  // el cobro no se confirmó -- antes se navegaba a la pantalla sin decir
  // nada, y un pago rechazado/pendiente se veía idéntico a uno cancelado.
  const okParam = wait.success ? '1' : '0';
  const appLink =
    payment?.type === 'advertising'
      ? `sosmoto://pago-resultado?tipo=advertising&ok=${okParam}`
      : payment?.type === 'subscription'
        ? `sosmoto://pago-resultado?tipo=subscription&ok=${okParam}`
        : 'sosmoto://';

  const debugLine = wait.success
    ? ''
    : `<pre style="text-align:left;max-width:400px;margin:16px auto;background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:12px;border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(
        JSON.stringify({ query: req.query, wait }, null, 2)
      )}</pre>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SOSmoto · Pago</title>
<style>body{font-family:-apple-system,sans-serif;text-align:center;padding:60px 24px;background:#f5f5f5;}
h1{font-size:20px;}
.button{display:inline-block;margin-top:24px;background:#FF6B00;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:24px;}</style>
</head>
<body>
<h1>${wait.success ? 'Pago aprobado ✅' : 'No pudimos confirmar el pago todavía'}</h1>
<p>${
    wait.success
      ? payment && payment.type === 'advertising'
        ? 'Tu campaña quedó registrada y en revisión. Te avisaremos cuando esté aprobada.'
        : 'Tu plan se actualizó.'
      : 'Si ya pagaste, espera un momento y vuelve a la app — la confirmación llega por separado y puede tardar unos segundos más.'
  }</p>
${debugLine}
<a class="button" href="${appLink}">Volver a SOSmoto</a>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
