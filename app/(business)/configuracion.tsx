import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { signOut } from '../../services/auth';
import { getMyWorkBusiness, updateBusiness } from '../../services/businesses';
import { getPlanLimits, type PlanLimits } from '../../services/catalog';
import { getPendingRequests } from '../../services/helpRequests';
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

const planLabel: Record<string, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

export default function BusinessConfiguracionScreen() {
  const { profile } = useAuth();
  const { getCoords } = useLocation();

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [plan, setPlan] = useState<PlanLimits | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [radius, setRadius] = useState('');
  const [is24h, setIs24h] = useState(false);
  const [schedule, setSchedule] = useState<BusinessSchedule>({});

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    setBusiness(myBusiness);
    setIsOwner(work?.isOwner ?? false);
    if (!myBusiness) return;

    setName(myBusiness.name);
    setDescription(myBusiness.description ?? '');
    setAddress(myBusiness.address);
    setCity(myBusiness.city);
    setPhone(myBusiness.phone ?? '');
    setWhatsapp(myBusiness.whatsapp ?? '');
    setRadius(myBusiness.aid_radius_km !== null ? String(myBusiness.aid_radius_km) : '');
    setIs24h(myBusiness.is_24h);
    setSchedule(myBusiness.schedule ?? {});

    const [planLimits, pending] = await Promise.all([
      getPlanLimits(myBusiness.id),
      getPendingRequests(myBusiness.id),
    ]);
    setPlan(planLimits);
    setPendingCount(pending.length);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load business config error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh business config error', err));
    }, [load])
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('sign out error', err);
      setSigningOut(false);
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

  async function handleUpdateLocation() {
    setLocating(true);
    try {
      await getCoords();
      Alert.alert('Listo', 'Se obtuvo tu ubicación actual. Guarda los cambios para aplicarla.');
    } catch (err) {
      Alert.alert('No se pudo obtener tu ubicación', 'Activa el GPS y el permiso de ubicación.');
    } finally {
      setLocating(false);
    }
  }

  function isValidTime(t: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  }

  async function handleSave() {
    if (!business) return;
    if (!name.trim() || !address.trim() || !city.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, dirección y ciudad.');
      return;
    }

    for (const [key, value] of Object.entries(schedule)) {
      if (!value) continue;
      if (!isValidTime(value.open) || !isValidTime(value.close)) {
        const dayLabel = days.find((d) => d.key === key)?.label ?? key;
        Alert.alert('Horario inválido', `El horario de ${dayLabel} debe usar formato HH:MM (ej. 08:00, 18:30).`);
        return;
      }
    }

    let parsedRadius: number | null = null;
    if (business.business_type === 'workshop') {
      parsedRadius = radius.trim() ? Number(radius) : null;
      if (parsedRadius !== null && (Number.isNaN(parsedRadius) || parsedRadius <= 0)) {
        Alert.alert('Radio inválido', 'Ingresa un número de km válido.');
        return;
      }
    }

    setSaving(true);
    try {
      let coordsUpdate = {};
      try {
        const coords = await getCoords();
        coordsUpdate = { latitude: coords.latitude, longitude: coords.longitude };
      } catch {
        // mantiene la ubicación anterior si no se pudo obtener una nueva
      }

      const updated = await updateBusiness(business.id, {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        schedule,
        aid_radius_km: parsedRadius,
        is_24h: is24h,
        ...coordsUpdate,
      });
      setBusiness(updated);
      Alert.alert('Guardado', 'Los datos de tu negocio se actualizaron.');
    } catch (err) {
      console.error('update business error', err);
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
        <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} loading={signingOut} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.planBadge}>
        <Text style={styles.planBadgeText}>
          Plan {plan ? planLabel[plan.planName] ?? plan.planName : '...'}
          {business.is_verified ? ' · Verificado' : ''}
        </Text>
      </View>

      <Pressable style={styles.statCard} onPress={() => router.push('/(business)/solicitudes')}>
        <Text style={styles.statLabel}>Solicitudes de auxilio pendientes</Text>
        <Text style={[styles.statValue, pendingCount > 0 && styles.statValueAlert]}>{pendingCount}</Text>
      </Pressable>

      {!isOwner && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>Solo el dueño del negocio puede editar estos datos.</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Datos del negocio</Text>
      <TextField label="Nombre" value={name} onChangeText={setName} editable={isOwner} />
      <TextField label="Descripción" value={description} onChangeText={setDescription} multiline editable={isOwner} />
      <TextField label="Dirección" value={address} onChangeText={setAddress} editable={isOwner} />
      <TextField label="Ciudad" value={city} onChangeText={setCity} editable={isOwner} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={isOwner} />
      <TextField label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" editable={isOwner} />

      <Text style={styles.sectionTitle}>Ubicación</Text>
      <Text style={styles.helperText}>
        Lat: {business.latitude.toFixed(5)}, Lng: {business.longitude.toFixed(5)}
      </Text>
      {isOwner && (
        <Button
          title={locating ? 'Obteniendo ubicación…' : 'Actualizar con mi ubicación actual'}
          variant="secondary"
          onPress={handleUpdateLocation}
          loading={locating}
          style={styles.locationButton}
        />
      )}

      {business.business_type === 'workshop' && (
        <>
          <Text style={styles.sectionTitle}>Auxilio en carretera</Text>
          <TextField
            label="Radio de cobertura (km)"
            placeholder="5"
            keyboardType="numeric"
            value={radius}
            onChangeText={setRadius}
            editable={isOwner}
          />
        </>
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Atención 24/7</Text>
        <Switch value={is24h} onValueChange={setIs24h} disabled={!isOwner} />
      </View>

      <Text style={styles.sectionTitle}>Horario</Text>
      {days.map((day) => {
        const value = schedule[day.key];
        const isOpen = value !== null && value !== undefined;
        return (
          <View key={day.key} style={styles.dayRow}>
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

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Gestión</Text>
      <Button title="Estadísticas" variant="secondary" onPress={() => router.push('/(business)/estadisticas')} />
      <Button
        title="Crece tu negocio"
        variant="secondary"
        onPress={() => router.push('/(business)/crece-tu-negocio')}
        style={styles.spacedButton}
      />
      <Button
        title="Agenda"
        variant="secondary"
        onPress={() => router.push('/(business)/agenda-negocio')}
        style={styles.spacedButton}
      />

<Button
        title="Recordatorios de mantenimiento"
        variant="secondary"
        onPress={() => router.push('/(business)/mantenimiento-proactivo')}
        style={styles.spacedButton}
      />
      <Button
        title="Plan y suscripción"
        variant="secondary"
        onPress={() => router.push('/(business)/suscripcion')}
        style={styles.spacedButton}
      />
      <Button
        title="Equipo (empleados/mecánicos)"
        variant="secondary"
        onPress={() => router.push('/(business)/empleados')}
        style={styles.spacedButton}
      />
      <Button
        title="Publicidad"
        variant="secondary"
        onPress={() => router.push('/(business)/publicidad')}
        style={styles.spacedButton}
      />
      <Button
        title="Historias"
        variant="secondary"
        onPress={() => router.push('/(business)/historias')}
        style={styles.spacedButton}
      />
      <Button
        title="Gestionar publicaciones"
        variant="secondary"
        onPress={() => router.push('/(business)/publicaciones')}
        style={styles.spacedButton}
      />
      <Button
        title={business.is_verified ? 'Verificación ✓' : 'Verificación (KYC)'}
        variant="secondary"
        onPress={() => router.push('/(business)/verificacion')}
        style={styles.spacedButton}
      />
      <Button
        title={business.is_limited ? 'Estado de cuenta · Limitado' : 'Estado de cuenta'}
        variant="secondary"
        onPress={() => router.push('/(business)/estado-cuenta')}
        style={styles.spacedButton}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>General</Text>
      <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} loading={signingOut} />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  planBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  statValueAlert: {
    color: colors.danger,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
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
  locationButton: {
    marginBottom: 12,
  },
  dayRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 10,
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
    marginTop: 8,
  },
  timeInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  spacedButton: {
    marginTop: 12,
  },
});
