import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../services/supabase';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getClientProfileForBusiness, getBusinessHistory, type HistoryItem, type ClientProfileForBusiness } from '../../../services/history';
import { getActiveClientAppointments, type ActiveClientAppointment } from '../../../services/appointments';
import { getBusinessClientReports, type ServiceReportWithBusiness } from '../../../services/serviceReports';
import { getVehicles } from '../../../services/vehicles';
import { formatVehicle, type Vehicle } from '../../../types/database';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClienteDetailScreen() {
  const { id, pending } = useLocalSearchParams<{ id: string; pending?: string }>();
  const isPending = pending === 'true';
  const { profile } = useAuth();
  const [client, setClient] = useState<ClientProfileForBusiness | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeAppointments, setActiveAppointments] = useState<ActiveClientAppointment[]>([]);
  const [clientReports, setClientReports] = useState<ServiceReportWithBusiness[]>([]);
  const [clientVehicles, setClientVehicles] = useState<Vehicle[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [work, clientProfile] = await Promise.all([
      getMyWorkBusiness(profile.id),
      getClientProfileForBusiness(id),
    ]);
    if (!work || !clientProfile) return;
    setBusinessId(work.business.id);
    setClient(clientProfile);
    const [items, active, reports, vehs] = await Promise.all([
      getBusinessHistory(work.business.id, { clientId: id }),
      getActiveClientAppointments(work.business.id, id),
      getBusinessClientReports(work.business.id, id).then(async (rpts) => {
        const { data: biz } = await supabase.from('businesses').select('name').eq('id', work.business.id).maybeSingle();
        return rpts.map((r) => ({ ...r, business_name: (biz as any)?.name ?? '' }));
      }),
      getVehicles(id),
    ]);
    setHistory(items);
    setActiveAppointments(active);
    setClientReports(reports);
    setClientVehicles(vehs);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load cliente detail error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Cliente no encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Banner pendiente */}
      {isPending && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={18} color="#F57F17" />
          <Text style={styles.pendingBannerText}>
            Pendiente de aprobación — el cliente aún no ha aceptado tu invitación.
          </Text>
        </View>
      )}

      {/* Header del cliente */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          {client.avatar_url ? (
            <Image source={{ uri: client.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={32} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.clientName}>{client.full_name}</Text>
          {client.phone && <Text style={styles.clientPhone}>{client.phone}</Text>}
          {client.email && <Text style={styles.clientPhone}>{client.email}</Text>}
        </View>
      </View>

      {/* Vehículos del cliente */}
      {clientVehicles.length > 0 && (
        <View style={styles.vehiclesCard}>
          <Text style={styles.vehiclesLabel}>Vehículos</Text>
          {clientVehicles.map((v) => (
            <View key={v.id} style={styles.vehicleChip}>
              <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.vehicleChipText}>
                {[v.brand, v.model, v.year, (v as any).plate].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Acciones rápidas */}
      <View style={styles.actionsRow}>
        {client.phone && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${client.phone}`)}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Llamar</Text>
          </Pressable>
        )}
        {client.phone && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => Linking.openURL(`https://wa.me/${client.phone?.replace(/\D/g, '')}`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, isPending && styles.actionBtnDisabled]}
          onPress={() => !isPending && router.push(`/(business)/chat/${id}`)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={isPending ? colors.textMuted : colors.primary} />
          <Text style={[styles.actionLabel, isPending && styles.actionLabelDisabled]}>Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, isPending && styles.actionBtnDisabled]}
          onPress={() => !isPending && router.push(`/(business)/nuevo-informe?clientId=${id}&clientName=${encodeURIComponent(client.full_name)}`)}
        >
          <Ionicons name="document-text-outline" size={20} color={isPending ? colors.textMuted : colors.primary} />
          <Text style={[styles.actionLabel, isPending && styles.actionLabelDisabled]}>Informe</Text>
        </Pressable>
      </View>

      {/* Próximas citas activas */}
      {activeAppointments.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Próximas citas</Text>
          {activeAppointments.map((apt) => (
            <Pressable
              key={apt.id}
              style={styles.activeAptCard}
              onPress={() => router.push('/(business)/agenda-negocio')}
            >
              <View style={styles.activeAptHeader}>
                <View style={[styles.aptBadge, aptBadgeStyle(apt)]}>
                  <Text style={[styles.aptBadgeText, aptBadgeTextStyle(apt)]}>
                    {aptStatusLabel(apt)}
                  </Text>
                </View>
                {apt.requested_at && (
                  <Text style={styles.aptDate}>
                    {new Date(apt.requested_at).toLocaleString('es-EC', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                )}
              </View>
              {apt.service_name && (
                <Text style={styles.aptService}>{apt.service_name}</Text>
              )}
              {apt.notes && (
                <Text style={styles.aptNotes} numberOfLines={1}>{apt.notes}</Text>
              )}
              <Text style={styles.aptLink}>Ver en agenda →</Text>
            </Pressable>
          ))}
        </>
      )}

      {/* Informes de servicio (standalone — sin cita ni auxilio vinculado) */}
      {(() => {
        const standalone = clientReports.filter((r) => !r.appointment_id && !r.help_request_id);
        if (standalone.length === 0) return null;
        return (
          <>
            <Text style={styles.sectionTitle}>Informes de servicio</Text>
            {standalone.map((report) => {
              const isDraftReport = report.status === 'draft';
              const href = isDraftReport
                ? `/(business)/nuevo-informe?clientId=${id}&clientName=${encodeURIComponent(client.full_name)}&reportId=${report.id}&appointmentStatus=completed`
                : `/(business)/informe/${report.id}`;
              return (
                <Pressable
                  key={report.id}
                  style={styles.historyCard}
                  onPress={() => router.push(href as any)}
                >
                  <View style={styles.historyHeader}>
                    <View style={[styles.badge, styles.badgeAppt]}>
                      <Text style={styles.badgeText}>
                        {report.service_category ?? 'Informe'}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>{formatDate(report.created_at)}</Text>
                  </View>
                  {report.vehicle_label && (
                    <Text style={styles.historyMeta}>{report.vehicle_label}</Text>
                  )}
                  <View style={styles.historyReportBtn}>
                    <Ionicons
                      name={isDraftReport ? 'document-text-outline' : 'document-text'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.historyReportBtnText}>
                      {isDraftReport ? 'Continuar borrador' : 'Ver informe'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        );
      })()}

      {/* Historial de interacciones */}
      <Text style={styles.sectionTitle}>Historial contigo</Text>
      {history.length === 0 ? (
        <Text style={styles.placeholder}>Sin interacciones registradas.</Text>
      ) : (
        history.map((item) => {
          const rawId = item.id.replace(/^(appt|aid):/, '');
          const isAppt = item.id.startsWith('appt:');
          const isAid = item.id.startsWith('aid:');
          const existingReport = clientReports.find(
            (r) => (isAppt && r.appointment_id === rawId) || (isAid && r.help_request_id === rawId)
          );
          const isDraft = existingReport?.status === 'draft';
          // El historial solo muestra citas completadas → appointmentStatus siempre 'completed'
          const baseInformeHref = `/(business)/nuevo-informe?clientId=${id}&clientName=${encodeURIComponent(client.full_name)}&appointmentStatus=completed` +
            (isAppt ? `&appointmentId=${rawId}` : '') +
            (isAid ? `&helpRequestId=${rawId}` : '');
          const cardPress = isPending ? undefined : existingReport
            ? isDraft
              ? () => router.push(baseInformeHref as any)
              : () => router.push(`/(business)/informe/${existingReport.id}`)
            : () => router.push(baseInformeHref as any);

          return (
            <Pressable key={item.id} style={styles.historyCard} onPress={cardPress}>
              <View style={styles.historyHeader}>
                <View style={[styles.badge, item.type === 'aid' ? styles.badgeAid : styles.badgeAppt]}>
                  <Text style={styles.badgeText}>{item.type === 'aid' ? 'Auxilio' : 'Cita'}</Text>
                </View>
                <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
              </View>
              {item.vehicle && (
                <Text style={styles.historyMeta}>
                  <Ionicons name="bicycle-outline" size={12} /> {formatVehicle(item.vehicle)}
                </Text>
              )}
              {item.description && (
                <Text style={styles.historyDesc} numberOfLines={2}>{item.description}</Text>
              )}
              {!isPending && (
                <View style={styles.historyReportBtn}>
                  {existingReport ? (
                    isDraft ? (
                      <>
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                        <Text style={[styles.historyReportBtnText, { color: colors.primary }]}>Continuar borrador</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                        <Text style={styles.historyReportBtnText}>Ver informe</Text>
                      </>
                    )
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
                      <Text style={styles.historyReportBtnText}>Crear informe</Text>
                    </>
                  )}
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function aptStatusLabel(apt: ActiveClientAppointment): string {
  if (apt.status === 'pending') return 'Sin fecha aún';
  if (apt.status === 'scheduled' && apt.proposed_by === 'client') return 'Cliente propuso fecha';
  if (apt.status === 'scheduled') return 'Propuesta enviada';
  if (apt.status === 'confirmed') return 'Confirmada';
  return apt.status;
}

function aptBadgeStyle(apt: ActiveClientAppointment) {
  if (apt.status === 'confirmed') return { backgroundColor: '#E7F6EC' };
  if (apt.status === 'scheduled' && apt.proposed_by === 'client') return { backgroundColor: '#FFF1E6' };
  return { backgroundColor: colors.surface };
}

function aptBadgeTextStyle(apt: ActiveClientAppointment) {
  if (apt.status === 'confirmed') return { color: colors.success };
  if (apt.status === 'scheduled' && apt.proposed_by === 'client') return { color: colors.primary };
  return { color: colors.textMuted };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#F57F17',
    fontWeight: '600',
    lineHeight: 18,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionLabelDisabled: {
    color: colors.textMuted,
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  profileInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  clientPhone: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeAid: {
    backgroundColor: '#FFF1E6',
  },
  badgeAppt: {
    backgroundColor: '#E8F0FF',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  historyDesc: {
    fontSize: 14,
    color: colors.text,
  },
  placeholder: {
    fontSize: 14,
    color: colors.textMuted,
  },
  activeAptCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  activeAptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aptBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aptDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  aptService: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  aptNotes: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  aptLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  historyReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  historyReportBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  vehiclesCard: {
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 14, marginBottom: 16, gap: 8,
  },
  vehiclesLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  vehicleChipText: { fontSize: 13, color: colors.text },
});
