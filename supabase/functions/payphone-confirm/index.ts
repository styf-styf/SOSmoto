import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ADS_ENABLED, fulfillPayment, notifyPaymentFailed, type PaymentRow } from '../_shared/paymentFulfillment.ts';

const PAYPHONE_TOKEN = Deno.env.get('PAYPHONE_TOKEN')!;
// Único llamador legítimo de esta función es web/api/payphone-return.js
// (server-side, nunca el navegador ni la app) -- pero ese caller solo tenía
// la anon key pública como Authorization (necesaria para pasar el gate de
// plataforma de Supabase, ver check-maintenance), lo que en la práctica
// significaba que CUALQUIERA con la anon key (viene en el bundle de la app y
// en el JS del portal web) podía invocar esta función directo con cualquier
// id/clientTransactionId. No confirma nada gratis (sigue re-verificando con
// Payphone antes de activar algo), pero permitía enumerar/forzar llamadas
// pagas a la API de Payphone sin ser el dueño del pago. Se agrega un secreto
// compartido server-to-server (nunca expuesto al cliente) que solo
// payphone-return.js conoce.
const PAYPHONE_CONFIRM_SECRET = Deno.env.get('PAYPHONE_CONFIRM_SECRET')!;
// Endpoint real de confirmación de la Cajita de Pagos (Payment Box), según
// la documentación oficial (docs.payphone.app/cajita-de-pagos-payphone) --
// NO es el mismo que "Botón de Pago por redirección" (pay.../button/V3/Confirm,
// con query params). Es un producto distinto de Payphone, con su propio
// endpoint (paymentbox.../api/confirm) y su propio formato de body (JSON,
// campo "clientTxId" no "clientTransactionId", "id" numérico no string en la
// URL). Confundir los dos hacía que CADA confirmación fallara -- no era un
// bug de Payphone, era el endpoint equivocado para nuestro widget.
const PAYPHONE_CONFIRM_URL = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

Deno.serve(async (req) => {
  try {
    if (req.headers.get('x-internal-secret') !== PAYPHONE_CONFIRM_SECRET) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const { id, clientTransactionId } = await req.json();
    if (!id || !clientTransactionId) {
      return new Response(JSON.stringify({ error: 'Faltan datos' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, business_id, plan_id, status, type, metadata, amount, client_transaction_id')
      .eq('client_transaction_id', clientTransactionId)
      .single();
    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Pago no encontrado' }), { status: 404 });
    }
    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Se guarda apenas se recibe, ANTES de intentar confirmar con Payphone --
    // si la llamada de más abajo falla (red, timeout), este id numérico es
    // lo único que le permite a expire-stale-payments volver a preguntarle a
    // Payphone más tarde si el pago realmente se procesó. Sin esto, un pago
    // que sí se cobró pero cuya confirmación falló acá quedaba sin ninguna
    // forma de reconciliarse.
    await supabase.from('payments').update({ payphone_transaction_id: String(id) }).eq('id', payment.id);

    if (payment.type === 'advertising' && !ADS_ENABLED) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      await notifyPaymentFailed(supabase, payment as PaymentRow);
      return new Response(
        JSON.stringify({ success: false, error: 'La publicidad no está disponible por el momento.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const confirmResponse = await fetch(PAYPHONE_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYPHONE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: Number(id), clientTxId: clientTransactionId }),
    });

    if (!confirmResponse.ok) {
      const detail = await confirmResponse.text();
      console.error('payphone confirm not ok', confirmResponse.status, detail);

      // FIX CRÍTICO: antes, si la confirmación real con Payphone fallaba,
      // se confiaba en `transactionStatus` mandado por quien LLAMA a esta
      // función (hintedStatus, del body del propio POST) para activar el
      // pago igual. Ese campo no tiene ninguna verificación de firma --
      // cualquiera con una cuenta autenticada podía pedir un plan, nunca
      // pagarlo, y llamar a payphone-return/esta función a mano con
      // transactionStatus: "Approved" para activarlo gratis. Nunca se debe
      // confiar en un status que no viene de la respuesta verificada de
      // Payphone -- si el confirm real falla, el pago falla, punto.
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      await notifyPaymentFailed(supabase, payment as PaymentRow);
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo confirmar el pago', httpStatus: confirmResponse.status, detail }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const confirmData = await confirmResponse.json();

    if (confirmData.transactionStatus !== 'Approved') {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      await notifyPaymentFailed(supabase, payment as PaymentRow);
      console.error('payphone transaction not approved', confirmData);
      return new Response(
        JSON.stringify({ success: false, status: confirmData.transactionStatus, confirmData }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Defensa en profundidad: aunque el `id` numérico que se le pasa a
    // Payphone ya viene atado a un `clientTransactionId` en SU sistema (no
    // se puede fabricar un "Approved" para una transacción que no ocurrió),
    // nada obligaba a que el `id`/clientTransactionId que ESTA función
    // recibió correspondan de verdad al `payment` local que se está por
    // activar. Si alguien con el token filtrado (ver web/api/payphone-checkout.js)
    // llama a esta función con un `id` real y aprobado pero un
    // `clientTransactionId` de OTRO pago propio pendiente, la respuesta real
    // de Payphone trae su PROPIO clientTransactionId/amount (confirmados
    // contra docs.payphone.app/cajita-de-pagos-payphone) -- si no coinciden
    // con el pago local que se iba a activar, se corta acá.
    const returnedAmountCents = Math.round(Number(payment.amount) * 100);
    if (
      String(confirmData.clientTransactionId) !== payment.client_transaction_id ||
      Number(confirmData.amount) !== returnedAmountCents
    ) {
      console.error('payphone confirm mismatch', {
        expectedClientTransactionId: payment.client_transaction_id,
        expectedAmountCents: returnedAmountCents,
        confirmData,
      });
      // Antes esta rama no actualizaba `payments.status` para nada -- el
      // pago se quedaba silenciosamente en 'pending' (hasta que
      // expire-stale-payments lo agarrara horas después) en vez de
      // reflejar de inmediato que la confirmación no correspondía a este
      // pago.
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      await notifyPaymentFailed(supabase, payment as PaymentRow);
      return new Response(
        JSON.stringify({ success: false, error: 'La confirmación no corresponde a este pago' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await fulfillPayment(supabase, payment as PaymentRow, String(confirmData.transactionId));

    return new Response(JSON.stringify({ success: true, status: confirmData.transactionStatus }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
