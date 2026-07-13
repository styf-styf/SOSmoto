import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness, updateBusiness } from '../../services/businesses';
import type { Business, BusinessSchedule } from '../../types/database';

const days: { key: string; label: string }[] = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
];

interface HorarioData {
  business: Business | null;
  isOwner: boolean;
}

export default function HorarioScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `horario-${profile.id}` : null;
  const { data, loading, reload: reloadCache, setData } = useCachedLoad<HorarioData>(cacheKey, async () => {
    if (!profile) return { business: null, isOwner: false };
    const work = await getMyWorkBusiness(profile.id);
    return { business: work?.business ?? null, isOwner: work?.isOwner ?? false };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;

  const [is24h, setIs24h] = useState(() => data?.business?.is_24h ?? false);
  const [schedule, setSchedule] = useState<BusinessSchedule>(() => data?.business?.schedule ?? {});
  const [saving, setSaving] = useState(false);
  const didPopulateRef = useRef(!!data?.business);

  function populateForm(b: Business | null) {
    if (!b) return;
    setIs24h(b.is_24h);
    setSchedule(b.schedule ?? {});
  }

  useEffect(() => {
    if (didPopulateRef.current || !business) return;
    didPopulateRef.current = true;
    populateForm(business);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await reloadCache();
      populateForm(result.business);
    } catch (err) {
      console.error('refresh horario error', err);
    } finally {
      setRefreshing(false);
    }
  }

  function handleToggleDay(key: string, open: boolean) {
    setSchedule((prev) => ({
      ...prev,
      [key]: open ? prev[key] ?? { open: '08:00', close: '18:00' } : null,
    }));
  }

  function handleScheduleTime(key: string, field: 'open' | 'close', value: string) {
    setSchedule((prev) => {
      const current = prev[key] ?? { open: '08:00', close: '18:00' };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
  }

  function isValidTime(t: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  }

  async function handleSave() {
    if (!business) return;
    for (const [key, value] of Object.entries(schedule)) {
      if (!value) continue;
      if (!isValidTime(value.open) || !isValidTime(value.close)) {
        const dayLabel = days.find((d) => d.key === key)?.label ?? key;
        Alert.alert('Horario inválido', `El horario de ${dayLabel} debe usar formato HH:MM (ej. 08:00, 18:30).`);
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await updateBusiness(business.id, { is_24h: is24h, schedule });
      setData((prev) => (prev ? { ...prev, business: updated } : prev));
      Alert.alert('Guardado', 'El horario se actualizó.');
    } catch (err) {
      console.error('update horario error', err);
      Alert.alert('Error', 'No se pudo guardar los cambios.');
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

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>No tienes un negocio registrado.</Text>
      </View>
    );
  }

  if (business.business_type === 'brand_advertiser') {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>
          Las Marcas no tienen horario de atención al público: venden al por mayor a talleres y tiendas, no directo al cliente final.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
    >
      {!isOwner && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>Solo el dueño del negocio puede editar estos datos.</Text>
        </View>
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Atención 24/7</Text>
        <Switch value={is24h} onValueChange={setIs24h} disabled={!isOwner} />
      </View>

      {days.map((day, index) => {
        const value = schedule[day.key];
        const isOpen = value !== null && value !== undefined;
        const isLast = index === days.length - 1;
        return (
          <View key={day.key} style={[styles.dayRow, !isLast && styles.dayRowBorder]}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <Switch value={isOpen} onValueChange={(v) => handleToggleDay(day.key, v)} disabled={!isOwner} />
            </View>
            {isOpen && (
              <View style={styles.dayTimes}>
                <TextField
                  label="Apertura"
                  placeholder="08:00"
                  value={value?.open ?? ''}
                  onChangeText={(t) => handleScheduleTime(day.key, 'open', t)}
                  style={styles.timeInput}
                  editable={isOwner}
                />
                <TextField
                  label="Cierre"
                  placeholder="18:00"
                  value={value?.close ?? ''}
                  onChangeText={(t) => handleScheduleTime(day.key, 'close', t)}
                  style={styles.timeInput}
                  editable={isOwner}
                />
              </View>
            )}
          </View>
        );
      })}

      {isOwner && <Button title="Guardar cambios" onPress={handleSave} loading={saving} style={styles.saveButton} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  readOnlyBanner: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  readOnlyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  dayRow: {
    paddingVertical: 12,
  },
  dayRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dayTimes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  timeInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: 24,
  },
});
