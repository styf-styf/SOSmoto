import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fulfillPayment, type PaymentRow } from '../_shared/paymentFulfillment.ts';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
// Mismo endpoint que payphone-confirm (ver nota ahí sobre por qué es este y
// no el de "Botón de Pago por redirección").
const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';
const STALE_HOURS = 2;
// Tope defensivo por corrida -- el volumen actual es mínimo, pero evita que
// una sola corrida quede procesando cientos de filas si algo se acumula.
const BATCH_LIMIT = 100;

type StalePayment = PaymentRow & { payphone_transaction_id: string | null };

// Cierra los pagos que quedaron 'pending' por más de STALE_HOURS -- ya sea
// porque el negocio abandonó el checkout (nunca volvió, payphone-confirm ni
// se llamó) o porque sí se intentó confirmar pero algo falló de nuestro lado
// (red, timeout). Corre cada hora (ver migración 0197), mismo cron que antes
// hacía esto con un UPDATE de SQL directo -- se cambió a Edge Function
// porque verificar con Payphone antes de cerrar requiere una llamada HTTP
// real.
Deno.serve(async (req) => {
  // Solo el cron interno puede invocar esto -- mismo patrón que
  // expire-stale-help-requests.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('payments')
      .select('id, business_id, plan_id, type, metadata, amount, client_transaction_id, payphone_transaction_id')
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .limit(BATCH_LIMIT);
    if (error) throw error;

    const stalePayments = (data ?? []) as StalePayment[];
    let completed = 0;
    let cancelled = 0;

    for (const payment of stalePayments) {
      // Sin id de Payphone no hay nada que verificar -- el negocio nunca
      // volvió del checkout, así que payphone-confirm ni se llamó. Payphone
      // documenta que reversa la transacción sola si no se confirma dentro
      // de los primeros 5 minutos (ver web/api/payphone-return.js), así que
      // no hay riesgo de "cobró y no nos enteramos" en este caso -- se
      // cancela directo, sin llamar a Payphone.
      if (!payment.payphone_transaction_id) {
        await supabase.from('payments').update({ status: 'cancelled' }).eq('id', payment.id);
        cancelled++;
        continue;
      }

      // Sí llegó a intentar confirmar pero algo falló de nuestro lado -- se
      // le vuelve a preguntar a Payphone una última vez antes de darlo por
      // perdido, para no cancelar un pago que en realidad sí se cobró.
      let fulfilled = false;
      try {
        const confirmResponse = await fetch(PAYPHONE_CONFIRM_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYPHONE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: Number(payment.payphone_transaction_id),
            clientTxId: payment.client_transaction_id,
          }),
        });

        if (confirmResponse.ok) {
          const confirmData = await confirmResponse.json();
          const returnedAmountCents = Math.round(Number(payment.amount) * 100);
          // Misma validación que payphone-confirm: no basta con "Approved",
          // tiene que corresponder de verdad a este pago.
          const matches =
            confirmData.transactionStatus === 'Approved' &&
            String(confirmData.clientTransactionId) === payment.client_transaction_id &&
            Number(confirmData.amount) === returnedAmountCents;

          if (matches) {
            await fulfillPayment(supabase, payment as PaymentRow, String(confirmData.transactionId));
            completed++;
            fulfilled = true;
          }
        }
      } catch (err) {
        console.error('expire-stale-payments recheck error', payment.id, err);
      }

      if (!fulfilled) {
        await supabase.from('payments').update({ status: 'cancelled' }).eq('id', payment.id);
        cancelled++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, checked: stalePayments.length, completed, cancelled }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
