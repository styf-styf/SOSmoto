import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_MAPS_SERVER_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

interface ActiveRequest {
  id: string;
  latitude: number;
  longitude: number;
  business_latitude: number | null;
  business_longitude: number | null;
  estimated_arrival_minutes: number | null;
}

async function fetchEtaMinutes(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${originLat},${originLng}&destinations=${destLat},${destLng}` +
    `&key=${GOOGLE_MAPS_SERVER_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const element = data?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK' || !element.duration) return null;

  return Math.round(element.duration.value / 60);
}

// Recalcula el ETA real (por carretera, vía Google Distance Matrix) de cada
// auxilio activo a partir de la ubicacion en vivo del taller -- antes el
// "tiempo estimado de llegada" era solo un numero que el taller escribia a
// mano al aceptar y nunca se actualizaba. Se corre cada ~2 minutos (ver
// migracion de cron); el costo es ~1 elemento de Distance Matrix por
// solicitud activa por corrida, no por taller candidato.
Deno.serve(async () => {
  if (!GOOGLE_MAPS_SERVER_KEY) {
    return new Response(JSON.stringify({ error: 'Falta GOOGLE_MAPS_SERVER_KEY' }), { status: 500 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data, error } = await supabase
    .from('help_requests')
    .select('id, latitude, longitude, business_latitude, business_longitude, estimated_arrival_minutes')
    .in('status', ['accepted', 'in_progress'])
    .not('business_latitude', 'is', null)
    .not('business_longitude', 'is', null);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const requests = (data ?? []) as ActiveRequest[];
  let updated = 0;

  for (const request of requests) {
    const etaMinutes = await fetchEtaMinutes(
      request.business_latitude as number,
      request.business_longitude as number,
      request.latitude,
      request.longitude
    );
    if (etaMinutes === null || etaMinutes === request.estimated_arrival_minutes) continue;

    await supabase.from('help_requests').update({ estimated_arrival_minutes: etaMinutes }).eq('id', request.id);
    updated++;
  }

  return new Response(JSON.stringify({ ok: true, checked: requests.length, updated }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
