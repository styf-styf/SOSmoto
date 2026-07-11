import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import {
  addExternalClient,
  getBusinessClientByName,
  updateExternalClient,
  type BusinessClientRecord,
  type ExternalVehicle,
} from '../../services/businessClients';
import { getExternalClientData, type ExternalClientData } from '../../services/history';

const ACTIVE_STATUSES = new Set(['pending', 'scheduled', 'confirmed']);

const APT_STATUS_LABEL: Record<string, string> = {
  pending: 'Sin fecha aún',
  scheduled: 'Fecha propuesta',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  rejected: 'Rechazada',
};

function aptBadgeColor(status: string): string {
  if (status === 'confirmed') return '#E7F6EC';
  if (status === 'scheduled') return '#FFF1E6';
  if (status === 'cancelled' || status === 'rejected') return '#FBE8E8';
  return colors.surface;
}

function aptTextColor(status: string): string {
  if (status === 'confirmed') return colors.success;
  if (status === 'scheduled') return colors.primary;
  if (status === 'cancelled' || status === 'rejected') return colors.danger;
  return colors.textMuted;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface VehicleForm { brand: string; model: string; year: string; plate: string }

export default function ClienteExternoScreen() {
  const { profile } = useAuth();
  const { name, phone } = useLocalSearchParams<{ name: string; phone?: string }>();
  const decodedName = decodeURIComponent(name ?? '');
  const decodedPhone = phone ? decodeURIComponent(phone) : null;

  const [data, setData] = useState<ExternalClientData | null>(null);
  const [record, setRecord] = useState<BusinessClientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editVehicles, setEditVehicles] = useState<VehicleForm[]>([]);
  const [saving, setSaving] = useState(false);
  const didInitialLoadRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile || !decodedName) return;
      const isInitial = !didInitialLoadRef.current;
      didInitialLoadRef.current = true;
      if (isInitial) setLoading(true);
      getMyWorkBusiness(profile.id)
        .then(async (work) => {
          if (!work) return;
          setBusinessId(work.business.id);
          const [extData, bcRecord] = await Promise.all([
            getExternalClientData(work.business.id, decodedName),
            getBusinessClientByName(work.business.id, decodedName),
          ]);
          setData(extData);
          setRecord(bcRecord);
        })
        .catch((err) => console.error('load ext client error', err))
        .finally(() => { if (isInitial) setLoading(false); });
    }, [profile, decodedName])
  );

  function enterEdit() {
    setEditName(record?.external_name ?? decodedName);
    setEditPhone(record?.external_phone ?? decodedPhone ?? '');
    setEditEmail(record?.external_email ?? '');
    setEditVehicles(
      (record?.vehicles ?? []).map((v) => ({
        brand: v.brand,
        model: v.model,
        year: String(v.year),
        plate: v.plate ?? '',
      }))
    );
    setEditing(true);
  }

  function addVehicle() {
    setEditVehicles((prev) => [...prev, { brand: '', model: '', year: '', plate: '' }]);
  }

  function updateVehicle(i: number, field: keyof VehicleForm, val: string) {
    setEditVehicles((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  }

  function removeVehicle(i: number) {
    setEditVehicles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!editName.trim()) {
      Alert.alert('Nombre requerido', 'El nombre del cliente no puede estar vacío.');
      return;
    }
    if (!businessId) return;
    const parsedVehicles: ExternalVehicle[] = editVehicles
      .filter((v) => v.brand.trim() || v.model.trim())
      .map((v) => ({
        brand: v.brand.trim(),
        model: v.model.trim(),
        year: parseInt(v.year, 10) || new Date().getFullYear(),
        plate: v.plate.trim() || undefined,
      }));

    setSaving(true);
    try {
      let updated: BusinessClientRecord;
      if (record) {
        updated = await updateExternalClient(record.id, {
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          vehicles: parsedVehicles,
        });
      } else {
        updated = await addExternalClient({
          businessId,
          name: editName.trim(),
          phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined,
          vehicles: parsedVehicles,
        });
      }
      setRecord(updated);
      setEditing(false);
      if (editName.trim() !== decodedName) {
        router.replace(
          `/(business)/cliente-externo?name=${encodeURIComponent(editName.trim())}` +
          (editPhone.trim() ? `&phone=${encodeURIComponent(editPhone.trim())}` : '')
        );
      }
    } catch (err) {
      console.error('update ext client error', err);
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const displayPhone = record?.external_phone ?? decodedPhone;
  const displayEmail = record?.external_email ?? null;
  const displayVehicles = record?.vehicles ?? [];

  const encodedName = encodeURIComponent(decodedName);
  const informeBase = `/(business)/nuevo-informe?clientName=${encodedName}` +
    (displayPhone ? `&clientPhone=${encodeURIComponent(displayPhone)}` : '');

  const activeApts = (data?.appointments ?? []).filter((a) => ACTIVE_STATUSES.has(a.status));
  const pastApts = (data?.appointments ?? []).filter((a) => !ACTIVE_STATUSES.has(a.status));

  // ── EDIT MODE ──
  if (editing) {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          style={styles.input}
          value={editName}
          onChangeText={setEditName}
          placeholder="Nombre completo"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={editPhone}
          onChangeText={setEditPhone}
          placeholder="0987654321"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={editEmail}
          onChangeText={setEditEmail}
          placeholder="correo@ejemplo.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <View style={styles.vehiclesHeader}>
          <Text style={styles.label}>Vehículos</Text>
          <Pressable style={styles.addVehicleBtn} onPress={addVehicle}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.addVehicleBtnText}>Agregar</Text>
          </Pressable>
        </View>

        {editVehicles.map((v, i) => (
          <View key={i} style={styles.vehicleForm}>
            <View style={styles.vehicleFormHeader}>
              <Text style={styles.vehicleFormTitle}>Vehículo {i + 1}</Text>
              <Pressable onPress={() => removeVehicle(i)}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </View>
            <View style={styles.vehicleRow}>
              <TextInput
                style={[styles.input, { flex: 3 }]}
                placeholder="Marca"
                placeholderTextColor={colors.textMuted}
                value={v.brand}
                onChangeText={(val) => updateVehicle(i, 'brand', val)}
              />
              <TextInput
                style={[styles.input, { flex: 3 }]}
                placeholder="Modelo"
                placeholderTextColor={colors.textMuted}
                value={v.model}
                onChangeText={(val) => updateVehicle(i, 'model', val)}
              />
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Año"
                placeholderTextColor={colors.textMuted}
                value={v.year}
                onChangeText={(val) => updateVehicle(i, 'year', val)}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Placa (ej. ABC-1234)"
              placeholderTextColor={colors.textMuted}
              value={v.plate}
              onChangeText={(val) => updateVehicle(i, 'plate', val.toUpperCase())}
              autoCapitalize="characters"
            />
          </View>
        ))}

        <View style={styles.editActions}>
          <Pressable style={[styles.editBtn, styles.cancelBtn]} onPress={() => setEditing(false)} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </Pressable>
          <Pressable style={[styles.editBtn, styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Guardar cambios</Text>
            }
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── VIEW MODE ──
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person-outline" size={32} color={colors.textMuted} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.clientName}>{decodedName}</Text>
          {displayPhone && <Text style={styles.clientPhone}>{displayPhone}</Text>}
          {displayEmail && <Text style={styles.clientPhone}>{displayEmail}</Text>}
        </View>
        <Pressable onPress={enterEdit} style={styles.editIconBtn} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Vehículos */}
      {displayVehicles.length > 0 && (
        <View style={styles.vehiclesCard}>
          <Text style={styles.vehiclesLabel}>Vehículos</Text>
          {displayVehicles.map((v, i) => (
            <View key={i} style={styles.vehicleChip}>
              <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
              <Text style={styles.vehicleChipText}>
                {[v.brand, v.model, v.year, v.plate].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Acciones rápidas */}
      <View style={styles.actionsRow}>
        {displayPhone && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${displayPhone}`)}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>Llamar</Text>
          </Pressable>
        )}
        {displayPhone && (
          <Pressable
            style={styles.actionBtn}
            onPress={() => Linking.openURL(`https://wa.me/${displayPhone.replace(/\D/g, '')}`)}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </Pressable>
        )}
        <Pressable style={styles.actionBtn} onPress={() => router.push(informeBase as any)}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={styles.actionLabel}>Informe</Text>
        </Pressable>
      </View>

      {/* Próximas citas activas */}
      {activeApts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Próximas citas</Text>
          {activeApts.map((apt) => (
            <Pressable
              key={apt.id}
              style={styles.activeAptCard}
              onPress={() => router.push('/(business)/agenda-negocio')}
            >
              <View style={styles.activeAptHeader}>
                <View style={[styles.aptBadge, { backgroundColor: aptBadgeColor(apt.status) }]}>
                  <Text style={[styles.aptBadgeText, { color: aptTextColor(apt.status) }]}>
                    {APT_STATUS_LABEL[apt.status] ?? apt.status}
                  </Text>
                </View>
                {apt.requested_at && (
                  <Text style={styles.aptDate}>{formatDateTime(apt.requested_at)}</Text>
                )}
              </View>
              {apt.service_name && <Text style={styles.aptService}>{apt.service_name}</Text>}
              {apt.notes && <Text style={styles.aptNotes} numberOfLines={1}>{apt.notes}</Text>}
              <Text style={styles.aptLink}>Ver en agenda →</Text>
            </Pressable>
          ))}
        </>
      )}

      {/* Historial de citas (completadas/canceladas) */}
      <Text style={styles.sectionTitle}>Historial contigo</Text>
      {pastApts.length === 0 ? (
        <Text style={styles.placeholder}>Sin interacciones registradas.</Text>
      ) : (
        pastApts.map((apt) => {
          const existingReport = (data?.reports ?? []).find((r) => r.appointment_id === apt.id);
          const isDraft = existingReport?.status === 'draft';
          const editHref = `${informeBase}&appointmentId=${apt.id}&appointmentStatus=completed`;
          const cardPress = apt.status === 'completed'
            ? existingReport
              ? isDraft
                ? () => router.push(editHref as any)
                : () => router.push(`/(business)/informe/${existingReport.id}`)
              : () => router.push(editHref as any)
            : undefined;

          return (
            <Pressable key={apt.id} style={styles.historyCard} onPress={cardPress}>
              <View style={styles.historyHeader}>
                <View style={[styles.badge, apt.status === 'completed' ? styles.badgeAppt : styles.badgeCancelled]}>
                  <Text style={[styles.badgeText, apt.status !== 'completed' && styles.badgeTextCancelled]}>
                    {APT_STATUS_LABEL[apt.status] ?? apt.status}
                  </Text>
                </View>
                {apt.requested_at && (
                  <Text style={styles.historyDate}>{formatDate(apt.requested_at)}</Text>
                )}
              </View>
              {apt.service_name && (
                <Text style={styles.historyMeta}>{apt.service_name}</Text>
              )}
              {apt.notes && (
                <Text style={styles.historyDesc} numberOfLines={2}>{apt.notes}</Text>
              )}
              {apt.status === 'completed' && (
                <View style={styles.historyReportBtn}>
                  {existingReport ? (
                    isDraft ? (
                      <>
                        <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                        <Text style={styles.historyReportBtnText}>Continuar borrador</Text>
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

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: 20, backgroundColor: colors.background, paddingBottom: 40 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 16,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center',
  },
  profileInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '700', color: colors.text },
  clientPhone: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  editIconBtn: { padding: 6 },

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

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  actionLabel: { fontSize: 12, color: colors.text, fontWeight: '600' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 4 },

  activeAptCard: {
    backgroundColor: '#F0F7FF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  activeAptHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  aptBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  aptBadgeText: { fontSize: 11, fontWeight: '700' },
  aptDate: { fontSize: 13, fontWeight: '700', color: colors.text },
  aptService: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  aptNotes: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  aptLink: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 },

  historyCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeAppt: { backgroundColor: '#E8F0FF' },
  badgeCancelled: { backgroundColor: '#FBE8E8' },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  badgeTextCancelled: { color: colors.danger },
  historyDate: { fontSize: 12, color: colors.textMuted },
  historyMeta: { fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  historyDesc: { fontSize: 14, color: colors.text },
  historyReportBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  historyReportBtnText: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  placeholder: { fontSize: 14, color: colors.textMuted, marginBottom: 16 },

  // Edit mode
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.text, backgroundColor: colors.surface,
  },
  vehiclesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  addVehicleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addVehicleBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  vehicleForm: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 10, gap: 8 },
  vehicleFormHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  vehicleFormTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  vehicleRow: { flexDirection: 'row', gap: 8 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  editBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
