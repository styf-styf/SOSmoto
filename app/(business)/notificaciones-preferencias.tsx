import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { NotificationPrefsList, type NotificationCategoryOption } from '../../components/NotificationPrefsList';
import { getMyWorkBusiness } from '../../services/businesses';
import { getNotificationPrefs, updateNotificationPrefs } from '../../services/notifications';
import type { NotificationCategory, NotificationPrefs } from '../../types/database';

const ALL_OPTIONS: NotificationCategoryOption[] = [
  { key: 'auxilio', label: 'Solicitudes de auxilio', hint: 'Nuevas solicitudes cercanas y cambios en las que ya aceptaste.' },
  { key: 'mensajes', label: 'Mensajes', hint: 'Cuando un cliente u otro negocio te escribe.' },
  { key: 'pagos', label: 'Pagos y suscripción', hint: 'Vencimiento próximo o caída de tu plan pago.' },
  { key: 'upselling', label: 'Recomendaciones para crecer', hint: 'Sugerencias de plan o publicidad según el uso de tu negocio.' },
];

export default function BusinessNotificationPrefsScreen() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  // Auxilio en carretera es exclusivo de taller -- tienda nunca recibe
  // solicitudes de auxilio, así que ese toggle no debe mostrarse (antes se
  // mostraba igual para todos, aunque no hiciera nada para tienda).
  const [options, setOptions] = useState<NotificationCategoryOption[]>(ALL_OPTIONS);
  const [loading, setLoading] = useState(true);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [businessPrefs, work] = await Promise.all([
      getNotificationPrefs(profile.id),
      getMyWorkBusiness(profile.id),
    ]);
    setPrefs(businessPrefs);
    setOptions(
      work?.business.business_type === 'workshop'
        ? ALL_OPTIONS
        : ALL_OPTIONS.filter((opt) => opt.key !== 'auxilio')
    );
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load notification prefs error', err))
          .finally(() => setLoading(false));
      }
    }, [load])
  );

  async function handleToggle(key: NotificationCategory, value: boolean) {
    if (!profile) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await updateNotificationPrefs(profile.id, next);
    } catch (err) {
      console.error('update notification prefs error', err);
      setPrefs(previous);
      Alert.alert('Error', 'No se pudo guardar el cambio. Intenta de nuevo.');
    }
  }

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.error('open settings error', err);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.systemRow} onPress={handleOpenSettings}>
        <Ionicons name="settings-outline" size={18} color={colors.textMuted} />
        <Text style={styles.systemRowText}>Permiso de notificaciones del sistema</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      <Text style={styles.hint}>
        Elige qué tipo de notificaciones quieres recibir por push. Siempre quedan guardadas en tu bandeja de
        notificaciones aunque las apagues aquí.
      </Text>
      <NotificationPrefsList options={options} prefs={prefs} onToggle={handleToggle} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: colors.background },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  systemRowText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
});
