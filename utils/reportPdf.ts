import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ServiceReportWithBusiness } from '../services/serviceReports';
import type { InspectionGroup, InspectionStatus } from '../types/database';

function statusLabel(s: InspectionStatus): string {
  if (s === 'ok') return 'OK';
  if (s === 'attention') return 'Atención';
  if (s === 'critical') return 'Crítico';
  return 'N/A';
}

function statusColor(s: InspectionStatus): string {
  if (s === 'ok') return '#2ECC71';
  if (s === 'attention') return '#ED6C02';
  if (s === 'critical') return '#D32F2F';
  return '#999';
}

function buildHtml(report: ServiceReportWithBusiness): string {
  const date = new Date(report.created_at).toLocaleDateString('es-EC', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const clientLine = [report.client_name, report.vehicle_label, report.vehicle_plate]
    .filter(Boolean).join('  ·  ');

  const groups = (report.inspection_checklist ?? []) as InspectionGroup[];
  const hasChecklist = groups.some((g) => g.items.some((i) => i.status !== 'na') || !!g.observations);

  const partsHtml = report.parts_used && report.parts_used.length > 0 ? `
    <div class="section">
      <div class="section-title">Repuestos / partes usadas</div>
      <table>
        <thead><tr><th style="text-align:left">Repuesto</th><th style="text-align:center;width:70px">Cant.</th></tr></thead>
        <tbody>
          ${report.parts_used.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#F5F5F7'}">
              <td>${p.name}</td>
              <td style="text-align:center">${p.quantity}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  const checklistHtml = hasChecklist ? `
    <div class="section">
      <div class="section-title">Inspección visual</div>
      ${groups.map((grp) => {
        const visible = grp.items.filter((i) => i.status !== 'na');
        if (visible.length === 0 && !grp.observations) return '';
        return `
          <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:700;color:#6B6B7B;text-transform:uppercase;margin-bottom:6px">${grp.group}</div>
            ${visible.map((it) => `
              <div style="display:flex;justify-content:space-between;border-top:1px solid #E5E5EA;padding:6px 0;font-size:13px">
                <span>${it.item}</span>
                <span style="font-weight:700;color:${statusColor(it.status)}">${statusLabel(it.status)}</span>
              </div>`).join('')}
            ${grp.observations ? `<div style="font-size:12px;color:#6B6B7B;font-style:italic;margin-top:6px">${grp.observations}</div>` : ''}
          </div>`;
      }).join('')}
    </div>` : '';

  const nextMaintHtml = (report.next_maintenance_km || report.next_maintenance_date) ? `
    <div class="section">
      <div class="section-title">Próximo mantenimiento</div>
      ${report.next_maintenance_km ? `<p class="body-text">A los ${report.next_maintenance_km.toLocaleString()} km</p>` : ''}
      ${report.next_maintenance_date ? `<p class="body-text">${new Date(report.next_maintenance_date).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}</p>` : ''}
    </div>` : '';

  const confirmedHtml = report.client_confirmed_at ? `
    <div style="display:flex;align-items:center;gap:8px;background:#E7F6EC;border-radius:8px;padding:10px;margin-bottom:12px">
      <span style="color:#2ECC71;font-weight:700;font-size:13px">✓ Confirmado por el cliente el ${new Date(report.client_confirmed_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1A2E; background: #fff; padding: 32px; font-size: 14px; }
    .header { display: flex; align-items: flex-start; gap: 16px; background: #F5F5F7; border-radius: 12px; padding: 18px; margin-bottom: 16px; }
    .header-icon { width: 52px; height: 52px; border-radius: 26px; background: #EEF4FF; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
    .header-title { font-size: 18px; font-weight: 700; }
    .header-date { font-size: 13px; color: #6B6B7B; margin-top: 2px; }
    .badge { display: inline-block; background: #EEF4FF; color: #FF6B00; font-size: 11px; font-weight: 700; border-radius: 8px; padding: 3px 10px; margin-top: 8px; }
    .client-line { font-size: 12px; color: #6B6B7B; margin-top: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .info-item { background: #F5F5F7; border-radius: 10px; padding: 12px; }
    .info-item.full { grid-column: 1 / -1; }
    .info-label { font-size: 10px; font-weight: 700; color: #6B6B7B; text-transform: uppercase; }
    .info-value { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .km-card { display: flex; align-items: center; gap: 10px; background: #F5F5F7; border-radius: 10px; padding: 12px; margin-bottom: 12px; font-weight: 600; }
    .section { background: #F5F5F7; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .section-title { font-size: 11px; font-weight: 700; color: #6B6B7B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .bullet { display: flex; gap: 8px; margin-bottom: 4px; }
    .body-text { font-size: 14px; line-height: 1.6; color: #1A1A2E; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #E5E5EA; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 12px; font-size: 13px; }
    th { background: #fff; color: #6B6B7B; font-weight: 700; font-size: 12px; border-bottom: 1px solid #E5E5EA; }
    .footer { margin-top: 32px; border-top: 1px solid #E5E5EA; padding-top: 12px; font-size: 11px; color: #6B6B7B; text-align: center; }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-icon">🔧</div>
    <div style="flex:1">
      <div class="header-title">${report.business_name}</div>
      <div class="header-date">${date}</div>
      ${report.service_category ? `<div class="badge">${report.service_category}</div>` : ''}
      ${clientLine ? `<div class="client-line">${clientLine}</div>` : ''}
    </div>
  </div>

  ${confirmedHtml}

  ${(report.vehicle_label || report.vehicle_plate || report.entry_date || report.exit_date) ? `
  <div class="info-grid">
    ${report.vehicle_label ? `<div class="info-item full"><div class="info-label">Vehículo</div><div class="info-value">${report.vehicle_label}</div></div>` : ''}
    ${report.vehicle_plate ? `<div class="info-item"><div class="info-label">Placa</div><div class="info-value">${report.vehicle_plate}</div></div>` : ''}
    ${report.entry_date ? `<div class="info-item"><div class="info-label">Ingreso</div><div class="info-value">${new Date(report.entry_date).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</div></div>` : ''}
    ${report.exit_date ? `<div class="info-item"><div class="info-label">Salida</div><div class="info-value">${new Date(report.exit_date).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</div></div>` : ''}
  </div>` : ''}

  ${report.service_km ? `<div class="km-card">🏍️ ${report.service_km.toLocaleString()} km al momento del servicio</div>` : ''}

  <div class="section">
    <div class="section-title">Servicios realizados</div>
    ${report.services_performed.map((s) => `<div class="bullet"><span style="color:#FF6B00">•</span><span>${s}</span></div>`).join('')}
  </div>

  ${partsHtml}
  ${checklistHtml}

  ${report.observations ? `<div class="section"><div class="section-title">Descripción del servicio</div><p class="body-text">${report.observations}</p></div>` : ''}
  ${report.recommendations ? `<div class="section"><div class="section-title">Recomendaciones</div><p class="body-text">${report.recommendations}</p></div>` : ''}
  ${nextMaintHtml}

  <div class="footer">Generado por SOSmoto</div>
</body>
</html>`;
}

export async function shareReportAsPdf(report: ServiceReportWithBusiness): Promise<void> {
  const html = buildHtml(report);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    await Print.printAsync({ html });
    return;
  }
  const filename = `informe_${report.business_name.replace(/\s+/g, '_')}_${new Date(report.created_at).toISOString().slice(0, 10)}.pdf`;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartir informe', UTI: 'com.adobe.pdf' });
  void filename;
}
