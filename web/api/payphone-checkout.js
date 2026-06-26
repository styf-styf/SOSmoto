const { createClient } = require('@supabase/supabase-js');

// Supabase Edge Functions fuerzan Content-Type: text/plain + CSP sandbox en
// cualquier respuesta no-JSON (no sirven para hospedar HTML/JS ejecutable).
// Por eso esta página vive en Vercel: aquí sí podemos servir el widget de
// Payphone (Cajita de Pagos) con un Content-Type real de text/html.
module.exports = async (req, res) => {
  const paymentId = req.query.paymentId;
  if (!paymentId) {
    res.status(400).send('Falta paymentId');
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: payment, error } = await supabase
    .from('payments')
    .select('id, amount, client_transaction_id, status')
    .eq('id', paymentId)
    .single();

  if (error || !payment || !payment.client_transaction_id) {
    res.status(404).send('Pago no encontrado');
    return;
  }
  if (payment.status !== 'pending') {
    res.status(409).send('Este pago ya fue procesado.');
    return;
  }

  const amountCents = Math.round(Number(payment.amount) * 100);

  const options = {
    token: process.env.PAYPHONE_TOKEN,
    clientTransactionId: payment.client_transaction_id,
    amount: amountCents,
    amountWithoutTax: amountCents,
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    currency: 'USD',
    storeId: process.env.PAYPHONE_STORE_ID,
    reference: 'Suscripcion SOSmoto',
    lang: 'es',
    defaultMethod: 'card',
    timeZone: -5,
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pago SOSmoto</title>
<link rel="stylesheet" href="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css" />
<style>body { font-family: sans-serif; background: #fff; padding: 16px; margin: 0; }</style>
</head>
<body>
<div id="pp-button"></div>
<script type="module" src="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js"></script>
<script type="module">
  window.addEventListener('DOMContentLoaded', () => {
    new window.PPaymentButtonBox(${JSON.stringify(options)}).render('pp-button');
  });
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
