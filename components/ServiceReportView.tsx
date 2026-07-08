import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { InspectionGroup, InspectionStatus } from '../types/database';
import type { ServiceReportWithBusiness } from '../services/serviceReports';

interface Props {
  report: ServiceReportWithBusiness;
  footer?: React.ReactNode;
}


function statusColor(s: InspectionStatus): string {
  if (s === 'ok') return '#2ECC71';
  if (s === 'attention') return colors.warning;
  if (s === 'critical') return colors.danger;
  return colors.border;
}

function statusIcon(s: InspectionStatus): string {
  if (s === 'ok') return 'checkmark-circle';
  if (s === 'attention') return 'warning';
  if (s === 'critical') return 'close-circle';
  return 'remove-circle-outline';
}

function statusLabel(s: InspectionStatus): string {
  if (s === 'ok') return 'OK';
  if (s === 'attention') return 'Atención';
  if (s === 'critical') return 'Crítico';
  return 'N/A';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ServiceReportView({ report, footer }: Props) {
  const date = new Date(report.created_at).toLocaleDateString('es-EC', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const groups = (report.inspection_checklist ?? []) as InspectionGroup[];
  const hasChecklist = groups.some((g) => g.items.some((i) => i.status !== 'na') || !!g.observations);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Cabecera */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="document-text" size={28} color={colors.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{report.business_name}</Text>
          <Text style={styles.headerDate}>{date}</Text>
          {report.service_category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{report.service_category}</Text>
            </View>
          )}
          {(report.client_name || report.vehicle_label) && (
            <View style={styles.clientRow}>
              <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.clientRowText} numberOfLines={2}>
                {[report.client_name, report.vehicle_label, report.vehicle_plate]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Vehículo, placa y fechas */}
      {(report.vehicle_label || report.vehicle_plate || report.entry_date || report.exit_date) && (
        <View style={styles.infoGrid}>
          {report.vehicle_label && (
            <View style={[styles.infoItem, styles.infoItemFull]}>
              <Ionicons name="bicycle-outline" size={15} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Vehículo</Text>
                <Text style={styles.infoValue}>{report.vehicle_label}</Text>
              </View>
            </View>
          )}
          {report.vehicle_plate && (
            <View style={styles.infoItem}>
              <Ionicons name="car-outline" size={15} color={colors.textMuted} />
              <View>
                <Text style={styles.infoLabel}>Placa</Text>
                <Text style={styles.infoValue}>{report.vehicle_plate}</Text>
              </View>
            </View>
          )}
          {report.entry_date && (
            <View style={styles.infoItem}>
              <Ionicons name="log-in-outline" size={15} color={colors.textMuted} />
              <View>
                <Text style={styles.infoLabel}>Ingreso</Text>
                <Text style={styles.infoValue}>
                  {new Date(report.entry_date).toLocaleString('es-EC', {
                    dateStyle: 'short', timeStyle: 'short',
                  })}
                </Text>
              </View>
            </View>
          )}
          {report.exit_date && (
            <View style={styles.infoItem}>
              <Ionicons name="log-out-outline" size={15} color={colors.textMuted} />
              <View>
                <Text style={styles.infoLabel}>Salida</Text>
                <Text style={styles.infoValue}>
                  {new Date(report.exit_date).toLocaleString('es-EC', {
                    dateStyle: 'short', timeStyle: 'short',
                  })}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Kilometraje */}
      {report.service_km && (
        <View style={styles.kmCard}>
          <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
          <Text style={styles.kmText}>
            {report.service_km.toLocaleString()} km al momento del servicio
          </Text>
        </View>
      )}

      {/* Confirmación cliente */}
      {report.client_confirmed_at && (
        <View style={styles.confirmedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#2ECC71" />
          <Text style={styles.confirmedText}>
            Confirmado por el cliente el{' '}
            {new Date(report.client_confirmed_at).toLocaleDateString('es-EC', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
      )}

      {/* Servicios realizados */}
      <Section title="Servicios realizados">
        {report.services_performed.map((svc, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{svc}</Text>
          </View>
        ))}
      </Section>

      {/* Partes usadas */}
      {report.parts_used && report.parts_used.length > 0 && (
        <Section title="Repuestos / partes usadas">
          <View style={styles.partsTable}>
            <View style={styles.partsHeader}>
              <Text style={[styles.partsCell, styles.partsHeaderText, { flex: 3 }]}>Repuesto</Text>
              <Text style={[styles.partsCell, styles.partsHeaderText, { flex: 1 }]}>Cant.</Text>
            </View>
            {report.parts_used.map((part, i) => (
              <View key={i} style={[styles.partsRow, i % 2 === 1 && styles.partsRowAlt]}>
                <Text style={[styles.partsCell, { flex: 3 }]}>{part.name}</Text>
                <Text style={[styles.partsCell, { flex: 1 }]}>{part.quantity}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* Checklist de inspección */}
      {hasChecklist && (
        <Section title="Inspección visual">
          {groups.map((grp, gi) => {
            const visibleItems = grp.items.filter((i) => i.status !== 'na');
            if (visibleItems.length === 0 && !grp.observations) return null;
            return (
              <View key={gi} style={styles.checkGroup}>
                <Text style={styles.checkGroupTitle}>{grp.group}</Text>
                {visibleItems.map((it, ii) => (
                  <View key={ii} style={styles.checkRow}>
                    <Ionicons name={statusIcon(it.status) as any} size={16} color={statusColor(it.status)} />
                    <Text style={styles.checkItem}>{it.item}</Text>
                    <Text style={[styles.checkStatus, { color: statusColor(it.status) }]}>
                      {statusLabel(it.status)}
                    </Text>
                  </View>
                ))}
                {grp.observations ? (
                  <Text style={styles.groupObs}>{grp.observations}</Text>
                ) : null}
              </View>
            );
          })}
        </Section>
      )}

      {/* Descripción del servicio */}
      {report.observations && (
        <Section title="Descripción del servicio">
          <Text style={styles.bodyText}>{report.observations}</Text>
        </Section>
      )}

      {/* Recomendaciones */}
      {report.recommendations && (
        <Section title="Recomendaciones">
          <Text style={styles.bodyText}>{report.recommendations}</Text>
        </Section>
      )}

      {/* Próximo mantenimiento */}
      {(report.next_maintenance_km || report.next_maintenance_date) && (
        <Section title="Próximo mantenimiento">
          <View style={styles.nextMaintRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <View style={styles.nextMaintInfo}>
              {report.next_maintenance_km && (
                <Text style={styles.nextMaintText}>
                  A los {report.next_maintenance_km.toLocaleString()} km
                </Text>
              )}
              {report.next_maintenance_date && (
                <Text style={styles.nextMaintText}>
                  {new Date(report.next_maintenance_date).toLocaleDateString('es-EC', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </Text>
              )}
            </View>
          </View>
        </Section>
      )}

      {footer && <View style={styles.footerSlot}>{footer}</View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: colors.background, paddingBottom: 40 },
  footerSlot: { gap: 10, paddingTop: 8 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  headerIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  headerDate: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  clientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 6 },
  clientRowText: { flex: 1, fontSize: 12, color: colors.textMuted },
  categoryBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: '#EEF4FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flex: 1, minWidth: 130,
  },
  infoItemFull: {
    flexBasis: '100%',
    flex: 0,
  },
  infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '700', marginTop: 2 },
  kmCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12,
  },
  kmText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  confirmedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E7F6EC', borderRadius: 10, padding: 10, marginBottom: 12,
  },
  confirmedText: { fontSize: 13, color: '#2ECC71', fontWeight: '600' },
  section: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  bullet: { fontSize: 16, color: colors.primary, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  partsTable: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  partsHeader: {
    flexDirection: 'row', backgroundColor: colors.background,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  partsHeaderText: { fontWeight: '700', color: colors.textMuted, fontSize: 13 },
  partsRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12 },
  partsRowAlt: { backgroundColor: colors.background },
  partsCell: { fontSize: 14, color: colors.text },
  checkGroup: { marginBottom: 10 },
  checkGroupTitle: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', marginBottom: 6,
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  checkItem: { flex: 1, fontSize: 14, color: colors.text },
  checkStatus: { fontSize: 12, fontWeight: '700' },
  groupObs: { fontSize: 13, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  bodyText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  nextMaintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nextMaintInfo: { flex: 1 },
  nextMaintText: { fontSize: 15, color: colors.text, fontWeight: '600' },
});
