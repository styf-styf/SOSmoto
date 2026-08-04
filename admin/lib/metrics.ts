// Helpers de cálculo para el dashboard de Métricas -- puros (sin llamadas a
// Supabase), pensados para reutilizarse entre secciones (crecimiento,
// ingresos, auxilio, reseñas, engagement). Misma lógica de "buckets" que
// services/dashboard.ts (dashboard del negocio en la app), portada aquí
// porque admin/ es un proyecto Next.js independiente que no puede importar
// fuera de esta carpeta.

export type Period = 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
  since: Date;
  until: Date;
  prevSince: Date;
  prevUntil: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// 'all' no tiene periodo anterior con el que comparar -- ahí las flechas de
// comparación y las gráficas de tendencia quedan vacías, solo se muestran
// totales históricos (mismo criterio usado en el dashboard del negocio).
export function resolveRange(period: Period, fromStr?: string, toStr?: string): DateRange | null {
  if (period === 'all') return null;
  if (period === 'custom') {
    if (!fromStr || !toStr) return null;
    const since = new Date(`${fromStr}T00:00:00`);
    const until = new Date(`${toStr}T23:59:59.999`);
    const span = Math.max(until.getTime() - since.getTime(), MS_PER_DAY);
    return { since, until, prevSince: new Date(since.getTime() - span), prevUntil: since };
  }
  const days = period === 'week' ? 7 : 30;
  const until = new Date();
  const since = new Date(until.getTime() - days * MS_PER_DAY);
  return { since, until, prevSince: new Date(since.getTime() - days * MS_PER_DAY), prevUntil: since };
}

export interface Bucket {
  label: string;
  start: number;
  end: number;
}

// Día si el rango cabe en ~9 días, semana si cabe en ~70, si no mes -- así
// nunca se dibujan decenas de barras apretadas.
export function buildBuckets(since: Date, until: Date): Bucket[] {
  const spanDays = (until.getTime() - since.getTime()) / MS_PER_DAY;
  const buckets: Bucket[] = [];
  if (spanDays <= 9) {
    let cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() < until.getTime()) {
      const start = cursor.getTime();
      const end = start + MS_PER_DAY;
      buckets.push({ label: WEEKDAY_SHORT[cursor.getDay()], start, end });
      cursor = new Date(end);
    }
  } else if (spanDays <= 70) {
    let i = 1;
    let cursor = since.getTime();
    while (cursor < until.getTime()) {
      const end = Math.min(cursor + MS_PER_DAY * 7, until.getTime());
      buckets.push({ label: `Sem ${i}`, start: cursor, end });
      cursor = end;
      i++;
    }
  } else {
    const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
    while (cursor.getTime() < until.getTime()) {
      const start = cursor.getTime();
      const label = cursor.toLocaleDateString('es-EC', { month: 'short' });
      cursor.setMonth(cursor.getMonth() + 1);
      buckets.push({ label, start, end: cursor.getTime() });
    }
  }
  return buckets;
}

export interface ChartPoint {
  label: string;
  values: Record<string, number>;
}

function bucketIndexFor(t: number, buckets: Bucket[]): number {
  let idx = buckets.findIndex((b) => t >= b.start && t < b.end);
  if (idx === -1 && buckets.length > 0 && t >= buckets[buckets.length - 1].end) idx = buckets.length - 1;
  return idx;
}

// Cuenta ocurrencias por bucket -- para series tipo "cuántos eventos pasaron"
// (nuevos usuarios, solicitudes, reseñas, seguidores...).
export function buildCountChartPoints(buckets: Bucket[], series: Record<string, string[]>): ChartPoint[] {
  const counts: Record<string, number[]> = {};
  for (const key of Object.keys(series)) {
    const arr = new Array(buckets.length).fill(0);
    for (const iso of series[key]) {
      const idx = bucketIndexFor(new Date(iso).getTime(), buckets);
      if (idx !== -1) arr[idx] += 1;
    }
    counts[key] = arr;
  }
  return buckets.map((b, i) => ({
    label: b.label,
    values: Object.fromEntries(Object.keys(series).map((key) => [key, counts[key][i]])),
  }));
}

// Suma un valor numérico por bucket -- para series tipo "cuánto dinero
// entró" (ingresos), donde importa el monto y no solo el conteo.
export function buildSumChartPoints(
  buckets: Bucket[],
  series: Record<string, { date: string; value: number }[]>
): ChartPoint[] {
  const sums: Record<string, number[]> = {};
  for (const key of Object.keys(series)) {
    const arr = new Array(buckets.length).fill(0);
    for (const item of series[key]) {
      const idx = bucketIndexFor(new Date(item.date).getTime(), buckets);
      if (idx !== -1) arr[idx] += item.value;
    }
    sums[key] = arr;
  }
  return buckets.map((b, i) => ({
    label: b.label,
    values: Object.fromEntries(Object.keys(series).map((key) => [key, Math.round(sums[key][i] * 100) / 100])),
  }));
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
