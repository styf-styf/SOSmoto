import type { Business, BusinessSchedule } from '../types/database';

const DAY_KEY_BY_JS_INDEX = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const WEEK_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export interface ScheduleDayRow {
  label: string;
  hours: string;
  isToday: boolean;
}

// Agrupa días consecutivos con el mismo horario (ej. lunes a viernes con el
// mismo rango) en una sola fila "Lunes - Viernes" en vez de repetir la hora 5
// veces -- sábado y domingo casi siempre difieren, así que típicamente quedan
// como filas propias.
export function getScheduleRows(schedule: BusinessSchedule | null): ScheduleDayRow[] {
  const todayKey = DAY_KEY_BY_JS_INDEX[new Date().getDay()];
  const days = WEEK_ORDER.map((key) => {
    const value = schedule?.[key];
    return { key, hours: value ? `${value.open} - ${value.close}` : 'Cerrado' };
  });

  const rows: ScheduleDayRow[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1].hours === days[i].hours) j++;
    const groupKeys = days.slice(i, j + 1).map((d) => d.key);
    const label =
      groupKeys.length > 1
        ? `${DAY_LABELS[groupKeys[0]]} - ${DAY_LABELS[groupKeys[groupKeys.length - 1]]}`
        : DAY_LABELS[groupKeys[0]];
    rows.push({
      label,
      hours: days[i].hours,
      isToday: groupKeys.includes(todayKey),
    });
    i = j + 1;
  }
  return rows;
}

// No maneja horarios que cruzan medianoche (ej. 22:00-02:00) -- caso no
// contemplado en el MVP, los talleres registrados usan horarios diurnos.
export function isBusinessOpenNow(business: Business): boolean {
  if (business.is_24h) return true;
  const todayKey = DAY_KEY_BY_JS_INDEX[new Date().getDay()];
  const today = business.schedule?.[todayKey];
  if (!today) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = today.open.split(':').map(Number);
  const [closeH, closeM] = today.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}
