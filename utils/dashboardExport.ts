import { Alert, Share } from 'react-native';
import type { BusinessDashboardStats } from '../services/dashboard';

// Mismo patrón que utils/reportPdf.ts (expo-print + expo-sharing, ya
// compilados en el build actual desde el informe de servicio en PDF -- no
// hace falta un build nuevo para usarlos acá también).

const periodDisplayLabel: Record<string, string> = {
  week: 'Última semana',
  month: 'Último mes',
  all: 'Todo el historial',
  custom: 'Rango personalizado',
};

interface ExportRow {
  label: string;
  value: string | number;
  prev: string | number | null;
}

function buildRows(stats: BusinessDashboardStats): ExportRow[] {
  const rows: ExportRow[] = [
    { label: 'Auxilios recibidos', value: stats.helpRequestsTotal, prev: stats.helpRequestsPrevTotal },
    { label: 'Auxilios completados', value: stats.helpRequestsCompleted, prev: null },
    { label: 'Citas recibidas', value: stats.appointmentsTotal, prev: stats.appointmentsPrevTotal },
    { label: 'Citas completadas', value: stats.appointmentsCompleted, prev: null },
    {
      label: 'Tiempo de respuesta al auxilio (min)',
      value: stats.avgResponseMinutes !== null ? Math.round(stats.avgResponseMinutes) : 'N/D',
      prev: stats.avgResponseMinutesPrev !== null ? Math.round(stats.avgResponseMinutesPrev) : null,
    },
    {
      label: 'Calificación promedio',
      value: stats.ratingAvg !== null ? stats.ratingAvg.toFixed(1) : 'N/D',
      prev: stats.ratingAvgPrev !== null ? stats.ratingAvgPrev.toFixed(1) : null,
    },
    { label: 'Vistas de productos', value: stats.productViewsTotal, prev: stats.productViewsPrevTotal },
    { label: 'Vistas de servicios', value: stats.serviceViewsTotal, prev: stats.serviceViewsPrevTotal },
    {
      label: 'Conversión de catálogo (histórico)',
      value: stats.catalogConversionRate !== null ? `${Math.round(stats.catalogConversionRate * 100)}%` : 'N/D',
      prev: null,
    },
    { label: 'Impresiones de anuncios', value: stats.adImpressions, prev: stats.adImpressionsPrevTotal },
    { label: 'Clics en anuncios', value: stats.adClicks, prev: stats.adClicksPrevTotal },
    { label: 'Vistas de historias (histórico)', value: stats.storyViews, prev: null },
    { label: 'Clics en historias', value: stats.storyClicks, prev: stats.storyClicksPrevTotal },
    { label: 'Seguidores nuevos', value: stats.followersGained, prev: stats.followersGainedPrevTotal },
  ];
  return rows;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(stats: BusinessDashboardStats, businessName: string): string {
  const rows = buildRows(stats);
  const lines = [
    `Dashboard de ${businessName}`,
    `Periodo,${periodDisplayLabel[stats.period] ?? stats.period}`,
    '',
    'Métrica,Valor actual,Periodo anterior',
    ...rows.map((r) => [csvEscape(r.label), csvEscape(r.value), csvEscape(r.prev ?? '')].join(',')),
  ];
  return lines.join('\n');
}

function buildHtml(stats: BusinessDashboardStats, businessName: string): string {
  const rows = buildRows(stats);
  const rowsHtml = rows
    .map(
      (r, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#F5F5F7'}">
        <td>${r.label}</td>
        <td style="text-align:right;font-weight:700">${r.value}</td>
        <td style="text-align:right;color:#6B6B7B">${r.prev ?? '—'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1A1A2E;background:#fff;padding:32px;font-size:14px}
    .header{background:#F5F5F7;border-radius:12px;padding:18px;margin-bottom:16px}
    .header-title{font-size:18px;font-weight:700}.header-date{font-size:13px;color:#6B6B7B;margin-top:2px}
    table{width:100%;border-collapse:collapse;border:1px solid #E5E5EA;border-radius:8px;overflow:hidden}
    th,td{padding:9px 12px;font-size:13px}th{background:#fff;color:#6B6B7B;font-weight:700;font-size:12px;border-bottom:1px solid #E5E5EA;text-align:left}
    .footer{margin-top:24px;border-top:1px solid #E5E5EA;padding-top:12px;font-size:11px;color:#6B6B7B;text-align:center}
  </style></head><body>
  <div class="header">
    <div class="header-title">${businessName}</div>
    <div class="header-date">${periodDisplayLabel[stats.period] ?? stats.period} · Generado el ${new Date().toLocaleDateString('es-419', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>
  <table>
    <thead><tr><th>Métrica</th><th style="text-align:right">Valor actual</th><th style="text-align:right">Periodo anterior</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">Generado por SOSmoto</div>
</body></html>`;
}

function sanitizeFileNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim();
}

export async function shareDashboardAsCsv(stats: BusinessDashboardStats, businessName: string): Promise<void> {
  try {
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const csv = buildCsv(stats, businessName);
    const fileName = `Dashboard_${sanitizeFileNamePart(businessName)}_${new Date().toISOString().slice(0, 10)}.csv`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Compartir estadísticas (CSV)' });
    } else {
      await Share.share({ title: 'Estadísticas', message: csv });
    }
  } catch (err) {
    console.error('[Dashboard CSV] Error:', err);
    Alert.alert('Error', 'No se pudo generar el archivo CSV.');
  }
}

export async function shareDashboardAsPdf(stats: BusinessDashboardStats, businessName: string): Promise<void> {
  try {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const html = buildHtml(stats, businessName);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    let shareUri = uri;
    try {
      const { File, Paths } = await import('expo-file-system');
      const source = new File(uri);
      const dest = new File(Paths.cache, `Dashboard_${sanitizeFileNamePart(businessName)}_${new Date().toISOString().slice(0, 10)}.pdf`);
      if (dest.exists) dest.delete();
      source.copy(dest);
      shareUri = dest.uri;
    } catch (renameErr) {
      console.warn('[Dashboard PDF] No se pudo renombrar el archivo:', renameErr);
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', dialogTitle: 'Compartir estadísticas (PDF)', UTI: 'com.adobe.pdf' });
    } else {
      await Print.printAsync({ html });
    }
  } catch (err) {
    console.error('[Dashboard PDF] Error:', err);
    Alert.alert('Error', 'No se pudo generar el PDF.');
  }
}
