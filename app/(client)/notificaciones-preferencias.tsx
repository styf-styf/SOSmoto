import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { NotificationPrefsList, type NotificationCategoryOption } from '../../components/NotificationPrefsList';
import { getNotificationPrefs, updateNotificationPrefs } from '../../services/notifications';
import type { NotificationCategory, NotificationPrefs } from '../../types/database';

const OPTIONS: NotificationCategoryOption[] = [
  { key: 'auxilio', label: 'Auxilio en carretera', hint: 'Cuando un taller acepta, cancela o completa tu solicitud.' },
  { key: 'mensajes', label: 'Mensajes', hint: 'Cuando un taller o tienda te escribe.' },
  { key: 'mantenimiento', label: 'Mantenimiento', hint: 'Recordatorios de kilometraje y mantenimiento próximo o vencido.' },
];

export default function ClientNotificationPrefsScreen() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [loading, setLoading] = useState(true);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setPrefs(await getNotificationPrefs(profile.id));
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
      <NotificationPrefsList options={OPTIONS} prefs={prefs} onToggle={handleToggle} />
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
