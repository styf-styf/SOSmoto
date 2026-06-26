import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
const PAYPHONE_STORE_ID = Deno.env.get('PAYPHONE_STORE_ID')!;

// Sirve la "Cajita de Pagos" de Payphone como página HTML.
// El widget corre en el navegador (no desde este servidor) porque Payphone
// valida el dominio de origen de la llamada a su Prepare interno; llamarlo
// directo desde una Edge Function (sin navegador) producía un error genérico.
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('paymentId');
  if (!paymentId) {
    return new Response('Falta paymentId', { status: 400 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: payment, error } = await supabase
    .from('payments')
    .select('id, amount, client_transaction_id, status')
    .eq('id', paymentId)
    .single();

  if (error || !payment || !payment.client_transaction_id) {
    return new Response('Pago no encontrado', { status: 404 });
  }
  if (payment.status !== 'pending') {
    return new Response('Este pago ya fue procesado.', { status: 409 });
  }

  const amountCents = Math.round(Number(payment.amount) * 100);

  const options = {
    token: PAYPHONE_TOKEN,
    clientTransactionId: payment.client_transaction_id,
    amount: amountCents,
    amountWithoutTax: amountCents,
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    currency: 'USD',
    storeId: PAYPHONE_STORE_ID,
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

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});
