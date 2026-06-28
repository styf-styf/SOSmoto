import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import type { Business } from '../../types/database';

export default function EstadoCuentaScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    setBusiness(work?.business ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.error('load estado cuenta error', err))
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

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.helperText}>Primero crea tu negocio.</Text>
      </View>
    );
  }

  const isLimited = business.is_limited;

  return (
    <View style={styles.container}>
      <View style={[styles.badge, isLimited ? styles.badgeLimited : styles.badgeActive]}>
        <Ionicons
          name={isLimited ? 'alert-circle' : 'checkmark-circle'}
          size={20}
          color={isLimited ? colors.danger : colors.success}
        />
        <Text style={[styles.badgeText, { color: isLimited ? colors.danger : colors.success }]}>
          {isLimited ? 'Limitado' : 'Activo'}
        </Text>
      </View>

      {isLimited ? (
        <>
          <Text style={styles.reasonLabel}>Motivo</Text>
          <Text style={styles.reasonText}>{business.limitation_reason || 'No se especificó un motivo.'}</Text>

          <Text style={styles.sectionTitle}>Mientras tu negocio esté limitado no puedes:</Text>
          <View style={styles.list}>
            <ListItem text="Crear campañas de publicidad nuevas" />
            <ListItem text="Subir historias" />
            <ListItem text="Crear publicaciones" />
            <ListItem text="Editar el catálogo (servicios/productos)" />
            <ListItem text="Gestionar empleados" />
            <ListItem text="Usar el chat con clientes" />
          </View>
          <Text style={styles.helperText}>
            Tu perfil sigue siendo visible en búsquedas y tus campañas de publicidad activas siguen circulando con
            normalidad. La agenda de citas y la recepción/aceptación de solicitudes de auxilio tampoco se ven
            afectadas.
          </Text>
        </>
      ) : (
        <Text style={styles.helperText}>Tu negocio está activo, sin restricciones.</Text>
      )}
    </View>
  );
}

function ListItem({ text }: { text: string }) {
  return (
    <View style={styles.listItem}>
      <Ionicons name="close-circle" size={16} color={colors.danger} />
      <Text style={styles.listItemText}>{text}</Text>
    </View>
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
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  badgeActive: {
    backgroundColor: '#E6F4EA',
  },
  badgeLimited: {
    backgroundColor: '#FBE8E8',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  list: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
