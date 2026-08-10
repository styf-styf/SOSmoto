import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CircleActionButton } from '../../../components/CircleActionButton';
import { ContactActionButtons } from '../../../components/ContactActionButtons';
import { SegmentedTabs } from '../../../components/SegmentedTabs';
import { StatusBadge, type StatusBadgeTone } from '../../../components/StatusBadge';
import { useColors } from '../../../hooks/ThemeContext';
import type { ColorTheme } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useProductIntentAction } from '../../../hooks/useProductIntentAction';
import { supabase } from '../../../services/supabase';
import { getMyWorkBusiness } from '../../../services/businesses';
import { dialCodeForCountry } from '../../../constants/locations';
import { getClientProfileForBusiness, getBusinessHistory, type HistoryItem, type ClientProfileForBusiness } from '../../../services/history';
import {
  cancelAppointment,
  completeAppointment,
  getActiveClientAppointments,
  rejectAppointment,
  type ActiveClientAppointment,
} from '../../../services/appointments';
import {
  getActiveAppointmentRequests,
  subscribeToAppointmentRequest,
  type AppointmentRequest,
} from '../../../services/appointmentRequests';
import { useBusinessAppointmentRequestActions } from '../../../hooks/useBusinessAppointmentRequestActions';
import { useAppointmentRescheduleActions } from '../../../hooks/useAppointmentRescheduleActions';
import { getBusinessClientReports, type ServiceReportWithBusiness } from '../../../services/serviceReports';
import { getVehicles } from '../../../services/vehicles';
import { getClientProductIntents } from '../../../services/productIntents';
import { getBusinessClientByClientId, upsertClientNotes, type BusinessClientRecord } from '../../../services/businessClients';
import { formatVehicle, type Vehicle, type ProductIntentWithProduct } from '../../../types/database';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-419', { day: '2-digit', month: 'short', year: 'numeric' });
}

// La pestaña "Historial" mezcla 3 fuentes distintas (interacciones
// completadas -- citas y auxilio, ya vienen juntas y ordenadas desde
// getBusinessHistory -- y compras de producto cerradas) en una sola lista
// cronológica, en vez de 3 secciones apiladas por separado.
type HistorialEntry =
  | { kind: 'interaction'; date: string; data: HistoryItem }
  | { kind: 'purchase'; date: string; data: ProductIntentWithProduct };

type ClienteTab = 'citas' | 'pedidos' | 'informes' | 'historial';

export default function ClienteDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, pending, highlightIntentId } = useLocalSearchParams<{ id: string; pending?: string; highlightIntentId?: string }>();
  const isPending = pending === 'true';
  const { profile } = useAuth();
  const [client, setClient] = useState<ClientProfileForBusiness | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeAppointments, setActiveAppointments] = useState<ActiveClientAppointment[]>([]);
  const [appointmentRequests, setAppointmentRequests] = useState<AppointmentRequest[]>([]);
  const [clientReports, setClientReports] = useState<ServiceReportWithBusiness[]>([]);
  const [clientVehicles, setClientVehicles] = useState<Vehicle[]>([]);
  const [productIntents, setProductIntents] = useState<ProductIntentWithProduct[]>([]);
  const [clientRecord, setClientRecord] = useState<BusinessClientRecord | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [isStore, setIsStore] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessCountry, setBusinessCountry] = useState<string>('Ecuador');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ClienteTab>('citas');
  const [refreshing, setRefreshing] = useState(false);
  const { processingId: processingIntentId, handleAction: handleIntentAction } = useProductIntentAction(setProductIntents);
  const requestActions = useBusinessAppointmentRequestActions<AppointmentRequest>(setAppointmentRequests);
  const rescheduleActions = useAppointmentRescheduleActions('business', (aptId, patch) =>
    setActiveAppointments((prev) => prev.map((a) => (a.id === aptId ? { ...a, ...patch } : a)))
  );
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [work, clientProfile] = await Promise.all([
      getMyWorkBusiness(profile.id),
      getClientProfileForBusiness(id),
    ]);
    if (!work || !clientProfile) return;
    setBusinessId(work.business.id);
    setBusinessCountry(work.business.country);
    setClient(clientProfile);
    const storeType = work.business.business_type === 'store';
    setIsStore(storeType);

    // Notas privadas -- aplica a cualquier tipo de negocio, no solo taller.
    const clientBc = await getBusinessClientByClientId(work.business.id, id).catch(() => null);
    setClientRecord(clientBc);
    setNotesDraft(clientBc?.notes ?? '');

    // Los apartados/compras de producto no son exclusivos de tienda -- un
    // taller también puede vender productos de su catálogo.
    const intents = await getClientProductIntents(work.business.id, id);
    setProductIntents(intents);

    if (storeType) return;

    const [items, active, requests, reports, vehs] = await Promise.all([
      getBusinessHistory(work.business.id, { clientId: id }),
      getActiveClientAppointments(work.business.id, id),
      getActiveAppointmentRequests(id, work.business.id),
      getBusinessClientReports(work.business.id, id).then(async (rpts) => {
        const { data: biz } = await supabase.from('businesses_public').select('name').eq('id', work.business.id).maybeSingle();
        return rpts.map((r) => ({ ...r, business_name: (biz as any)?.name ?? '' }));
      }),
      getVehicles(id),
    ]);
    setHistory(items);
    setActiveAppointments(active);
    setAppointmentRequests(requests);
    setClientReports(reports);
    setClientVehicles(vehs);
  }, [profile, id]);

  // Solicitudes de cita en tiempo real -- para que una solicitud nueva (o
  // una que el cliente cancele) aparezca sin tener que salir y volver a
  // entrar a este perfil.
  useEffect(() => {
    if (!businessId || !id || isStore) return;
    const unsubscribe = subscribeToAppointmentRequest(id, businessId, 'business', (req) => {
      if (req.status === 'pending') {
        setAppointmentRequests((prev) =>
          prev.some((r) => r.id === req.id) ? prev.map((r) => (r.id === req.id ? req : r)) : [...prev, req]
        );
      } else {
        setAppointmentRequests((prev) => prev.filter((r) => r.id !== req.id));
        requestActions.resetIfApproving(req.id);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, id, isStore]);

  // Tienda nunca tiene citas ni informes -- si la pestaña activa quedó en
  // alguna de esas (valor inicial por defecto) al resolver que es tienda,
  // la movemos a "Pedidos" en vez de dejar una pestaña vacía seleccionada.
  useEffect(() => {
    if (isStore) setActiveTab((prev) => (prev === 'citas' || prev === 'informes' ? 'pedidos' : prev));
  }, [isStore]);

  // Si se llegó acá desde "Pedidos" con un apartado puntual a resaltar
  // (highlightIntentId), hay que abrir la pestaña donde ese apartado vive
  // realmente -- Pedidos si sigue abierto, Historial si ya se cerró (vendido,
  // no disponible, cancelado) -- si no, quedaría resaltado en una pestaña
  // que el usuario nunca ve por defecto.
  useEffect(() => {
    if (!highlightIntentId) return;
    const target = productIntents.find((i) => i.id === highlightIntentId);
    if (!target) return;
    setActiveTab(target.status === 'pending' || target.status === 'confirmed' ? 'pedidos' : 'historial');
  }, [highlightIntentId, productIntents]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  function handleRejectAppointment(aptId: string) {
    Alert.alert('Rechazar cita', '¿Seguro que quieres rechazar esta cita? El cliente será notificado.', [
      { text: 'No rechazar', style: 'cancel' },
      {
        text: 'Sí, rechazar',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectAppointment(aptId);
            setActiveAppointments((prev) => prev.filter((a) => a.id !== aptId));
          } catch (err) {
            console.error('reject appointment error', err);
            Alert.alert('Error', 'No se pudo rechazar la cita.');
          }
        },
      },
    ]);
  }

  function handleCancelAppointment(aptId: string) {
    Alert.alert('Cancelar cita', '¿Seguro que quieres cancelar esta cita? El cliente será notificado.', [
      { text: 'No cancelar', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAppointment(aptId, 'business');
            setActiveAppointments((prev) => prev.filter((a) => a.id !== aptId));
          } catch (err) {
            console.error('cancel appointment error', err);
            Alert.alert('Error', 'No se pudo cancelar la cita.');
          }
        },
      },
    ]);
  }

  async function handleCompleteAppointment(aptId: string) {
    try {
      await completeAppointment(aptId);
      setActiveAppointments((prev) => prev.filter((a) => a.id !== aptId));
    } catch (err) {
      console.error('complete appointment error', err);
    }
  }

  function startEditingNotes() {
    setNotesDraft(clientRecord?.notes ?? '');
    setEditingNotes(true);
  }

  async function handleSaveNotes() {
    if (!businessId || !id) return;
    setSavingNotes(true);
    try {
      const updated = await upsertClientNotes(businessId, id, notesDraft);
      setClientRecord(updated);
      setEditingNotes(false);
    } catch (err) {
      console.error('save client notes error', err);
      Alert.alert('Error', 'No se pudieron guardar las notas.');
    } finally {
      setSavingNotes(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load cliente detail error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('load cliente detail error', err));
      }
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

  const openProductIntents = productIntents.filter((i) => i.status === 'pending' || i.status === 'confirmed');
  const pastProductIntents = productIntents.filter((i) => i.status !== 'pending' && i.status !== 'confirmed');
  const standaloneReports = clientReports.filter((r) => !r.appointment_id && !r.help_request_id);
  const historialEntries: HistorialEntry[] = [
    ...history.map((item) => ({ kind: 'interaction' as const, date: item.date, data: item })),
    ...pastProductIntents.map((item) => ({ kind: 'purchase' as const, date: item.updated_at, data: item })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const citasTabEmpty = appointmentRequests.length === 0 && activeAppointments.length === 0;
  // Punto rojo en la pestaña "Citas" -- solo cuando hay algo que requiere que
  // el negocio actúe (aceptar/rechazar/proponer fecha), no simplemente "hay
  // citas" (una cita ya confirmada o esperando respuesta del cliente no cuenta).
  const citasNeedsAction =
    appointmentRequests.length > 0 ||
    activeAppointments.some((a) => a.status === 'pending' || (a.status === 'scheduled' && a.proposed_by === 'client'));

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      {/* Banner pendiente */}
      {isPending && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={18} color="#F57F17" />
          <Text style={styles.pendingBannerText}>
            Pendiente de aprobación — el cliente aún no ha aceptado tu invitación.
          </Text>
        </View>
      )}

      {/* Header del cliente -- si esta persona compra a nombre de su propio
          negocio (ej. un taller comprándole al por mayor a esta tienda),
          avatar y nombre llevan al perfil público de ESE negocio. Si es un
          cliente final, llevan a su perfil público de cliente (ClientProfileView). */}
      <Pressable
        style={styles.profileCard}
        onPress={() =>
          client.ownedBusinessId
            ? router.push(`/(business)/business/${client.ownedBusinessId}`)
            : router.push(`/(business)/usuario/${client.id}`)
        }
      >
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
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {/* Vehículos del cliente */}
      {!isStore && clientVehicles.length > 0 && (
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

      {/* Referencia histórica -- vehículo(s) que este cliente tenía
          registrados cuando todavía era "externo" (antes de tener la app).
          Solo de lectura a propósito: es un dato que el negocio anotó a su
          criterio, no algo que el cliente declaró él mismo, así que no se
          mezcla con su perfil real de vehículos (tabla `vehicles`). */}
      {!isStore && (clientRecord?.vehicles?.length ?? 0) > 0 && (
        <View style={styles.vehiclesCardMuted}>
          <Text style={styles.vehiclesLabel}>Antes de tener la app tenía registrado</Text>
          {clientRecord!.vehicles.map((v, i) => (
            <View key={i} style={styles.vehicleChip}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.vehicleChipText}>
                {[v.brand, v.model, v.year, v.plate].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Acciones rápidas */}
      <View style={styles.actionsRow}>
        {client.phone && <ContactActionButtons phone={client.phone} dialCode={dialCodeForCountry(businessCountry)} />}
        <Pressable
          style={[styles.actionBtn, isPending && styles.actionBtnDisabled]}
          onPress={() => !isPending && router.push(`/(business)/chat/${id}`)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={isPending ? colors.textMuted : colors.primary} />
          <Text style={[styles.actionLabel, isPending && styles.actionLabelDisabled]}>Chat</Text>
        </Pressable>
        {!isStore && (
          <Pressable
            style={[styles.actionBtn, isPending && styles.actionBtnDisabled]}
            onPress={() => !isPending && router.push(`/(business)/nuevo-informe?clientId=${id}&clientName=${encodeURIComponent(client.full_name)}`)}
          >
            <Ionicons name="document-text-outline" size={20} color={isPending ? colors.textMuted : colors.primary} />
            <Text style={[styles.actionLabel, isPending && styles.actionLabelDisabled]}>Crear informe</Text>
          </Pressable>
        )}
      </View>

      {/* Notas privadas -- nunca las ve el cliente, sirven para que
          cualquier mecánico que lo atienda sepa de un vistazo cómo tratarlo
          (preferencias de contacto/pago, detalles de su moto, etc.). */}
      <View style={styles.notesCard}>
        <View style={styles.notesHeader}>
          <Text style={styles.notesTitle}>Notas privadas</Text>
          {!editingNotes && (
            <Pressable onPress={startEditingNotes} hitSlop={8}>
              <Ionicons
                name={clientRecord?.notes ? 'create-outline' : 'add-circle-outline'}
                size={20}
                color={colors.primary}
              />
            </Pressable>
          )}
        </View>
        {editingNotes ? (
          <>
            <TextInput
              style={styles.notesInput}
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Ej: prefiere WhatsApp, paga en efectivo, moto modificada..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.notesActions}>
              <Pressable
                style={[styles.notesBtn, styles.notesBtnCancel]}
                onPress={() => setEditingNotes(false)}
                disabled={savingNotes}
              >
                <Text style={styles.notesBtnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.notesBtn, styles.notesBtnSave, savingNotes && styles.notesBtnDisabled]}
                onPress={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.notesBtnSaveText}>Guardar</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={clientRecord?.notes ? styles.notesText : styles.notesPlaceholder}>
            {clientRecord?.notes || 'Sin notas todavía. Toca (+) para agregar una.'}
          </Text>
        )}
      </View>

      {/* Pestañas: Citas (taller) / Pedidos / Informes (taller) / Historial */}
      <SegmentedTabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'citas', label: 'Citas', hidden: isStore, showDot: citasNeedsAction },
          { key: 'pedidos', label: 'Pedidos' },
          { key: 'informes', label: 'Informes', hidden: isStore },
          { key: 'historial', label: 'Historial' },
        ]}
      />

      {/* Pestaña Citas: solicitudes de cita sin responder, próximas citas y
          servicios agendados -- antes las solicitudes solo se veían en el chat */}
      {activeTab === 'citas' && !isStore && (citasTabEmpty ? (
        <Text style={styles.placeholder}>Sin citas ni servicios agendados.</Text>
      ) : (
        <>
      {appointmentRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Solicitudes de cita</Text>
          {appointmentRequests.map((request) => (
            <View key={request.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <StatusBadge label="Sin responder" tone="pending" />
                {request.suggested_at && (
                  <Text style={styles.historyDate}>{formatDate(request.suggested_at)}</Text>
                )}
              </View>
              {request.service_name && <Text style={styles.historyMeta}>{request.service_name}</Text>}
              {request.notes && <Text style={styles.historyDesc}>{request.notes}</Text>}

              {requestActions.approvingRequestId === request.id ? (
                <View style={styles.proposeBox}>
                  <Text style={styles.proposeTitle}>Confirmar fecha de cita</Text>
                  <Text style={styles.fieldLabel}>Fecha</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => requestActions.setShowApproveDatePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {requestActions.approvePickerDate.toLocaleDateString('es-419', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </Text>
                  </Pressable>
                  {requestActions.showApproveDatePicker && (
                    <DateTimePicker
                      value={requestActions.approvePickerDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                      minimumDate={new Date()}
                      onChange={requestActions.handleApproveDateChange}
                    />
                  )}
                  <Text style={styles.fieldLabel}>Hora</Text>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => requestActions.setShowApproveTimePicker((prev) => !prev)}
                  >
                    <Text style={styles.pickerButtonText}>
                      {requestActions.approvePickerTime.toLocaleTimeString('es-419', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </Pressable>
                  {requestActions.showApproveTimePicker && (
                    <DateTimePicker
                      value={requestActions.approvePickerTime}
                      mode="time"
                      display="spinner"
                      onChange={requestActions.handleApproveTimeChange}
                    />
                  )}
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton icon="close" label="Cancelar" color={colors.textMuted} variant="outline" onPress={requestActions.cancelApproveForm} />
                    <CircleActionButton
                      icon="checkmark"
                      label="Confirmar cita"
                      color={colors.primary}
                      loading={requestActions.processingRequestId === request.id}
                      onPress={() => requestActions.handleAcceptRequest(request, client.full_name)}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.circleActionsRow}>
                  <CircleActionButton
                    icon="close"
                    label="Rechazar"
                    color={colors.danger}
                    onPress={() => requestActions.handleRejectRequest(request)}
                    disabled={requestActions.processingRequestId !== null}
                  />
                  <CircleActionButton
                    icon="calendar-outline"
                    label="Proponer fecha"
                    color={colors.primary}
                    onPress={() => requestActions.openApproveForm(request)}
                    disabled={requestActions.processingRequestId !== null}
                  />
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* Próximas citas activas */}
      {activeAppointments.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Próximas citas</Text>
          {activeAppointments.map((apt) => {
            const clientProposed = apt.status === 'scheduled' && apt.proposed_by === 'client';
            const businessProposed = apt.status === 'scheduled' && apt.proposed_by === 'business';
            const isRescheduling = rescheduleActions.reschedulingId === apt.id;
            return (
              <View key={apt.id} style={styles.activeAptCard}>
                <View style={styles.activeAptHeader}>
                  <StatusBadge label={aptStatusLabel(apt)} tone={aptTone(apt)} />
                  {apt.requested_at && (
                    <Text style={styles.aptDate}>
                      {new Date(apt.requested_at).toLocaleString('es-419', {
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

                {isRescheduling ? (
                  <View style={styles.proposeBox}>
                    <Text style={styles.proposeTitle}>{clientProposed ? 'Proponer otra fecha' : 'Proponer fecha'}</Text>
                    <Text style={styles.fieldLabel}>Fecha</Text>
                    <Pressable
                      style={styles.pickerButton}
                      onPress={() => rescheduleActions.setShowDatePicker((prev) => !prev)}
                    >
                      <Text style={styles.pickerButtonText}>
                        {rescheduleActions.pickerDate.toLocaleDateString('es-419', {
                          day: '2-digit', month: 'long', year: 'numeric',
                        })}
                      </Text>
                    </Pressable>
                    {rescheduleActions.showDatePicker && (
                      <DateTimePicker
                        value={rescheduleActions.pickerDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                        minimumDate={new Date()}
                        onChange={rescheduleActions.handleDateChange}
                      />
                    )}
                    <Text style={styles.fieldLabel}>Hora</Text>
                    <Pressable
                      style={styles.pickerButton}
                      onPress={() => rescheduleActions.setShowTimePicker((prev) => !prev)}
                    >
                      <Text style={styles.pickerButtonText}>
                        {rescheduleActions.pickerTime.toLocaleTimeString('es-419', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                    {rescheduleActions.showTimePicker && (
                      <DateTimePicker
                        value={rescheduleActions.pickerTime}
                        mode="time"
                        display="spinner"
                        onChange={rescheduleActions.handleTimeChange}
                      />
                    )}
                    <View style={styles.circleActionsRow}>
                      <CircleActionButton icon="close" label="Cancelar" color={colors.textMuted} variant="outline" onPress={rescheduleActions.cancelRescheduling} />
                      <CircleActionButton
                        icon="checkmark"
                        label="Confirmar fecha"
                        color={colors.primary}
                        loading={rescheduleActions.saving}
                        onPress={() => rescheduleActions.confirmReschedule(apt.id)}
                      />
                    </View>
                  </View>
                ) : apt.status === 'pending' ? (
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton icon="close" label="Rechazar" color={colors.danger} onPress={() => handleRejectAppointment(apt.id)} />
                    <CircleActionButton icon="calendar-outline" label="Proponer fecha" color={colors.primary} onPress={() => rescheduleActions.startRescheduling(apt.id)} />
                  </View>
                ) : clientProposed ? (
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton icon="close" label="Rechazar" color={colors.danger} onPress={() => handleRejectAppointment(apt.id)} />
                    <CircleActionButton icon="calendar-outline" label="Proponer otra" color={colors.primary} variant="outline" onPress={() => rescheduleActions.startRescheduling(apt.id)} />
                    <CircleActionButton
                      icon="checkmark"
                      label="Aceptar"
                      color={colors.primary}
                      onPress={() => rescheduleActions.approve(apt.id)}
                      loading={rescheduleActions.approvingId === apt.id}
                    />
                  </View>
                ) : businessProposed ? (
                  <View style={styles.waitingRow}>
                    <Text style={styles.waitingText}>Esperando respuesta del cliente.</Text>
                    <View style={styles.circleActionsRow}>
                      <CircleActionButton icon="calendar-outline" label="Cambiar fecha" color={colors.primary} variant="outline" onPress={() => rescheduleActions.startRescheduling(apt.id)} />
                    </View>
                  </View>
                ) : (
                  <View style={styles.circleActionsRow}>
                    <CircleActionButton icon="close" label="Cancelar" color={colors.danger} onPress={() => handleCancelAppointment(apt.id)} />
                    <CircleActionButton icon="calendar-outline" label="Reagendar" color={colors.primary} variant="outline" onPress={() => rescheduleActions.startRescheduling(apt.id)} />
                    <CircleActionButton icon="checkmark" label="Completar" color={colors.primary} onPress={() => handleCompleteAppointment(apt.id)} />
                  </View>
                )}

                <Pressable onPress={() => router.push('/(business)/agenda-negocio')}>
                  <Text style={styles.aptLink}>Ver en agenda →</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      )}

        </>
      ))}

      {/* Pestaña Informes: informes de servicio standalone (sin cita ni
          auxilio vinculado) -- los que sí están ligados a una cita/auxilio
          se ven desde su tarjeta en la pestaña Historial. */}
      {activeTab === 'informes' && !isStore && (standaloneReports.length === 0 ? (
        <Text style={styles.placeholder}>Sin informes registrados.</Text>
      ) : (
          <>
            <Text style={styles.sectionTitle}>Informes de servicio</Text>
            {standaloneReports.map((report) => {
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
      ))}

      {/* Pestaña Pedidos: solo apartados abiertos (pendiente/confirmado) --
          los cerrados (vendido/no disponible/cancelado) viven en Historial. */}
      {activeTab === 'pedidos' && (
          <>
            <Text style={styles.sectionTitle}>Apartados pendientes</Text>
            {openProductIntents.length === 0 ? (
              <Text style={styles.placeholder}>Sin apartados activos.</Text>
            ) : (
              openProductIntents.map((intent) => (
                <View
                  key={intent.id}
                  style={[styles.historyCard, intent.id === highlightIntentId && styles.historyCardHighlight]}
                >
                  <View style={styles.historyHeader}>
                    <View style={[styles.badge, styles.badgeAppt]}>
                      <Text style={styles.badgeText}>
                        {intent.status === 'confirmed' ? 'Apartado' : 'Pendiente'}
                      </Text>
                    </View>
                    <Text style={styles.historyDate}>{formatDate(intent.created_at)}</Text>
                  </View>
                  <Text style={styles.historyDesc}>
                    {intent.quantity > 1 ? `${intent.quantity} × ` : ''}{intent.product_name}
                    {intent.product_price != null ? ` · $${(intent.product_price * intent.quantity).toFixed(2)}` : ''}
                  </Text>
                  {intent.status === 'pending' && (
                    <View style={styles.circleActionsRow}>
                      <CircleActionButton
                        icon="close"
                        label="No disponible"
                        color={colors.danger}
                        onPress={() => handleIntentAction(intent.id, 'unavailable')}
                        loading={processingIntentId === intent.id}
                      />
                      <CircleActionButton
                        icon="checkmark"
                        label="Confirmar"
                        color={colors.primary}
                        onPress={() => handleIntentAction(intent.id, 'confirmed')}
                        loading={processingIntentId === intent.id}
                      />
                    </View>
                  )}
                  {intent.status === 'confirmed' && (
                    <View style={styles.circleActionsRow}>
                      <CircleActionButton
                        icon="close"
                        label="Cancelar venta"
                        color={colors.danger}
                        variant="outline"
                        onPress={() => handleIntentAction(intent.id, 'cancelled_no_show')}
                        loading={processingIntentId === intent.id}
                      />
                      <CircleActionButton
                        icon="checkmark"
                        label="Vendido"
                        color={colors.primary}
                        onPress={() => handleIntentAction(intent.id, 'sold')}
                        loading={processingIntentId === intent.id}
                      />
                    </View>
                  )}
                </View>
              ))
            )}

          </>
      )}

      {/* Pestaña Historial: interacciones completadas (citas + auxilio, ya
          vienen mezcladas y ordenadas desde getBusinessHistory) y compras
          cerradas de producto, todo en una sola lista cronológica. */}
      {activeTab === 'historial' && (historialEntries.length === 0 ? (
        <Text style={styles.placeholder}>Sin historial registrado.</Text>
      ) : (
        historialEntries.map((entry) => {
          if (entry.kind === 'purchase') {
            const intent = entry.data;
            return (
              <View
                key={`purchase:${intent.id}`}
                style={[styles.historyCard, intent.id === highlightIntentId && styles.historyCardHighlight]}
              >
                <View style={styles.historyHeader}>
                  <View style={[styles.badge, intent.status === 'sold' ? styles.badgeAppt : styles.badgeAid]}>
                    <Text style={styles.badgeText}>
                      {intent.status === 'sold' ? 'Vendido' :
                        intent.status === 'unavailable' ? 'No disponible' :
                        intent.status === 'cancelled_no_show' ? 'No retirado' : 'Cancelado'}
                    </Text>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(intent.updated_at)}</Text>
                </View>
                <Text style={styles.historyDesc}>
                  {intent.quantity > 1 ? `${intent.quantity} × ` : ''}{intent.product_name}
                  {intent.product_price != null ? ` · $${(intent.product_price * intent.quantity).toFixed(2)}` : ''}
                </Text>
              </View>
            );
          }

          const item = entry.data;
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
      ))}
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

function aptTone(apt: ActiveClientAppointment): StatusBadgeTone {
  if (apt.status === 'confirmed') return 'success';
  if (apt.status === 'scheduled' && apt.proposed_by === 'client') return 'pending';
  return 'neutral';
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
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
      backgroundColor: colors.warningLight,
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
      flexGrow: 1,
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
    historyCardHighlight: {
      borderWidth: 2,
      borderColor: colors.primary,
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
      backgroundColor: colors.warningLight,
    },
    badgeAppt: {
      backgroundColor: colors.infoLight,
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
      backgroundColor: colors.infoLight,
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
    vehiclesCardMuted: {
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 14, marginBottom: 16, gap: 8,
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

    notesCard: {
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, marginBottom: 16,
    },
    notesHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
    },
    notesTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    notesText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    notesPlaceholder: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    notesInput: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
      backgroundColor: colors.background, minHeight: 80, textAlignVertical: 'top',
    },
    notesActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    notesBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
    notesBtnCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    notesBtnCancelText: { fontSize: 14, fontWeight: '600', color: colors.text },
    notesBtnSave: { backgroundColor: colors.primary },
    notesBtnSaveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    notesBtnDisabled: { opacity: 0.6 },

    circleActionsRow: {
      flexDirection: 'row', marginTop: 10,
    },
    waitingRow: { marginTop: 8, gap: 8 },
    waitingText: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    proposeBox: {
      marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10,
    },
    proposeTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
    pickerButton: {
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, marginBottom: 10,
    },
    pickerButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  });
}
