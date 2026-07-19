import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getActiveServices } from '../../services/catalog';
import { createAppointmentByBusiness } from '../../services/appointments';
import { scheduleAppointmentReminder } from '../../services/appointmentReminders';
import { getMyWorkBusiness } from '../../services/businesses';
import { getCRMClients, searchUsers, type CRMClient, type UserSearchResult } from '../../services/history';
import type { Service } from '../../types/database';

interface SelectedClient {
  id: string | null;
  full_name: string;
  phone: string | null;
  isExternal: boolean;
}

function defaultDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

interface NuevaCitaData {
  businessId: string | null;
  crmClients: CRMClient[];
  services: Service[];
}

export default function NuevaCitaScreen() {
  const { profile } = useAuth();
  const { clientId: preselectedClientId } = useLocalSearchParams<{ clientId?: string }>();
  const [saving, setSaving] = useState(false);

  // Buscador unificado
  const [search, setSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Servicio
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Fecha y hora
  const [pickerDate, setPickerDate] = useState(() => defaultDate());
  const [pickerTime, setPickerTime] = useState(() => defaultDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Notas
  const [notes, setNotes] = useState('');

  const cacheKey = profile ? `nueva-cita-${profile.id}` : null;
  const { data, loading } = useCachedLoad<NuevaCitaData>(cacheKey, async () => {
    const empty: NuevaCitaData = { businessId: null, crmClients: [], services: [] };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    const [crm, svcList] = await Promise.all([
      getCRMClients(work.business.id),
      getActiveServices(work.business.id),
    ]);
    return { businessId: work.business.id, crmClients: crm, services: svcList };
  });
  const businessId = data?.businessId ?? null;
  const crmClients = data?.crmClients ?? [];
  const services = data?.services ?? [];

  const didPreselectRef = useRef(false);
  useEffect(() => {
    if (didPreselectRef.current || !preselectedClientId || crmClients.length === 0) return;
    const found = crmClients.find((c) => c.id === preselectedClientId);
    if (found) {
      didPreselectRef.current = true;
      setSelectedClient({
        id: found.id,
        full_name: found.full_name,
        phone: found.phone,
        isExternal: false,
      });
    }
  }, [preselectedClientId, crmClients]);

  function handleSearchChange(text: string) {
    setSearch(text);
    setGlobalResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!text.trim()) {
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true);

    // Búsqueda global con debounce 400ms, excluyendo app-clients ya en CRM
    const crmAppIds = crmClients.filter((c) => !c.is_external).map((c) => c.id);
    searchTimer.current = setTimeout(async () => {
      try {
        const global = await searchUsers(text, crmAppIds);
        setGlobalResults(global);
      } catch (err) {
        console.error('global search error', err);
      }
    }, 400);
  }

  function handleSelectCrm(client: CRMClient) {
    setSelectedClient({
      id: client.is_external ? null : client.id,
      full_name: client.full_name,
      phone: client.phone,
      isExternal: client.is_external ?? false,
    });
    setSearch('');
    setShowSuggestions(false);
    setGlobalResults([]);
  }

  function handleSelectGlobal(user: UserSearchResult) {
    setSelectedClient({
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      isExternal: false,
    });
    setSearch('');
    setShowSuggestions(false);
    setGlobalResults([]);
  }

  function clearClient() {
    setSelectedClient(null);
    setSearch('');
    setShowSuggestions(false);
    setGlobalResults([]);
  }

  function buildScheduledAt(): string {
    const dt = new Date(pickerDate);
    dt.setHours(pickerTime.getHours(), pickerTime.getMinutes(), 0, 0);
    return dt.toISOString();
  }

  async function handleSubmit() {
    if (!businessId) return;

    if (!selectedClient) {
      Alert.alert('Selecciona un cliente', 'Busca y elige el cliente de la lista.');
      return;
    }

    const scheduledAt = buildScheduledAt();
    if (new Date(scheduledAt).getTime() < Date.now()) {
      Alert.alert('Fecha en el pasado', 'Elige una fecha y hora futuras.');
      return;
    }

    const selectedService = services.find((s) => s.id === selectedServiceId);

    setSaving(true);
    try {
      const appointment = await createAppointmentByBusiness({
        businessId,
        scheduledAt,
        clientId: selectedClient.id ?? undefined,
        serviceId: selectedServiceId ?? undefined,
        serviceName: selectedService?.name,
        notes: notes.trim() || undefined,
        externalClientName: selectedClient.isExternal ? selectedClient.full_name : undefined,
        externalClientPhone: selectedClient.isExternal ? selectedClient.phone ?? undefined : undefined,
      });

      await scheduleAppointmentReminder({
        appointmentId: appointment.id,
        scheduledAt,
        clientLabel: selectedClient.full_name,
        serviceName: selectedService?.name,
      });

      const msg = selectedClient.isExternal
        ? 'La cita fue registrada. Recibirás un recordatorio 30 min antes.'
        : 'El cliente recibirá una notificación para aceptar o reagendar.';

      Alert.alert('Cita creada', msg, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('create appointment by business error', err);
      Alert.alert('Error', 'No se pudo crear la cita.');
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

  const scheduledAt = buildScheduledAt();
  const q = search.toLowerCase();
  const crmFiltered = search.trim().length >= 1
    ? crmClients.filter((c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(search))
      ).slice(0, 6)
    : [];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Buscador unificado */}
      <Text style={styles.fieldLabel}>Cliente *</Text>
      {selectedClient ? (
        <View style={styles.selectedClient}>
          <Ionicons
            name={selectedClient.isExternal ? 'person-outline' : 'person-circle-outline'}
            size={20}
            color={colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedClientName}>{selectedClient.full_name}</Text>
            {selectedClient.phone && (
              <Text style={styles.selectedClientPhone}>{selectedClient.phone}</Text>
            )}
          </View>
          {selectedClient.isExternal && (
            <View style={styles.extTag}>
              <Text style={styles.extTagText}>Externo</Text>
            </View>
          )}
          <Pressable onPress={clearClient} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar cliente por nombre o teléfono…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={handleSearchChange}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && (crmFiltered.length > 0 || globalResults.length > 0) && (
            <View style={styles.suggestionBox}>
              {crmFiltered.length > 0 && (
                <>
                  <Text style={styles.suggestionSection}>Mis clientes</Text>
                  {crmFiltered.map((c) => (
                    <Pressable key={c.id} style={styles.suggestionRow} onPress={() => handleSelectCrm(c)}>
                      <Ionicons
                        name={c.is_external ? 'person-outline' : 'person-circle-outline'}
                        size={16}
                        color={colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionName}>{c.full_name}</Text>
                        {c.phone && <Text style={styles.suggestionPhone}>{c.phone}</Text>}
                      </View>
                      {c.is_external && <Text style={styles.extBadge}>Externo</Text>}
                    </Pressable>
                  ))}
                </>
              )}
              {globalResults.length > 0 && (
                <>
                  <Text style={styles.suggestionSection}>En la app</Text>
                  {globalResults.map((u) => (
                    <Pressable key={u.id} style={styles.suggestionRow} onPress={() => handleSelectGlobal(u)}>
                      <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionName}>{u.full_name}</Text>
                        {u.phone && <Text style={styles.suggestionPhone}>{u.phone}</Text>}
                      </View>
                      <Text style={[styles.extBadge, { color: colors.primary }]}>App</Text>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          )}
          {showSuggestions && search.trim().length >= 1 && crmFiltered.length === 0 && globalResults.length === 0 && (
            <Text style={styles.hint}>Sin resultados.</Text>
          )}
        </View>
      )}

      {/* Servicio */}
      <Text style={styles.fieldLabel}>Servicio (opcional)</Text>
      <View style={styles.chipRow}>
        {services.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.chip, selectedServiceId === s.id && styles.chipSelected]}
            onPress={() => setSelectedServiceId((prev) => (prev === s.id ? null : s.id))}
          >
            <Text style={[styles.chipText, selectedServiceId === s.id && styles.chipTextSelected]}>
              {s.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Fecha */}
      <Text style={styles.fieldLabel}>Fecha *</Text>
      <Pressable
        style={styles.pickerBtn}
        onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}
      >
        <Text style={styles.pickerBtnText}>
          {pickerDate.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
        </Text>
      </Pressable>
      {showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          minimumDate={new Date()}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowDatePicker(false);
            if (date) setPickerDate(date);
          }}
        />
      )}

      {/* Hora */}
      <Text style={styles.fieldLabel}>Hora *</Text>
      <Pressable
        style={styles.pickerBtn}
        onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}
      >
        <Text style={styles.pickerBtnText}>
          {pickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Pressable>
      {showTimePicker && (
        <DateTimePicker
          value={pickerTime}
          mode="time"
          display="spinner"
          onChange={(_, time) => {
            if (Platform.OS === 'android') setShowTimePicker(false);
            if (time) setPickerTime(time);
          }}
        />
      )}

      <Text style={styles.dateHint}>
        Cita para: {new Date(scheduledAt).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
      </Text>

      {/* Notas */}
      <TextField
        label="Notas (opcional)"
        placeholder="Servicio a realizar, observaciones…"
        value={notes}
        onChangeText={setNotes}
        style={styles.notesInput}
      />

      <Button title="Crear cita" onPress={handleSubmit} loading={saving} style={styles.submitBtn} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, backgroundColor: colors.background,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8,
  },
  searchWrap: { marginBottom: 20, zIndex: 10 },
  searchInput: {
    height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, fontSize: 14, color: colors.text,
    backgroundColor: colors.surface,
  },
  suggestionBox: {
    marginTop: 4, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden',
  },
  suggestionSection: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  suggestionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggestionPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  extBadge: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },
  hint: {
    fontSize: 13, color: colors.textMuted, padding: 12,
  },
  selectedClient: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EEF4FF', borderRadius: 10, padding: 12, marginBottom: 20,
  },
  selectedClientName: {
    fontSize: 14, fontWeight: '700', color: colors.primary,
  },
  selectedClientPhone: {
    fontSize: 12, color: colors.textMuted, marginTop: 1,
  },
  extTag: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  extTagText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: '#FFF1E6' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextSelected: { color: colors.primary },
  pickerBtn: {
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, marginBottom: 16,
  },
  pickerBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  dateHint: {
    fontSize: 12, color: colors.textMuted, marginBottom: 20, marginTop: -8,
  },
  notesInput: { marginBottom: 8 },
  submitBtn: { marginTop: 8 },
});
