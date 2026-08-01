import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOutEverywhere } from '../../services/auth';
import { getMyWorkBusiness } from '../../services/businesses';
import type { Business } from '../../types/database';

export default function EstadoCuentaScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const didInitialLoadRef = useRef(false);

  function handleSignOutEverywhere() {
    if (!profile) return;
    Alert.alert(
      'Cerrar sesión en todos los dispositivos',
      'Vas a cerrar tu sesión aquí Y en cualquier otro dispositivo donde hayas iniciado sesión, incluido el acceso rápido guardado. Vas a necesitar tu contraseña para volver a entrar en cualquiera de ellos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar en todos lados',
          style: 'destructive',
          onPress: async () => {
            setSigningOutEverywhere(true);
            try {
              await signOutEverywhere(profile.id);
              router.replace('/(auth)/login');
            } catch (err) {
              console.error('sign out everywhere error', err);
              Alert.alert('Error', 'No se pudo cerrar sesión en todos los dispositivos. Intenta de nuevo.');
              setSigningOutEverywhere(false);
            }
          },
        },
      ]
    );
  }

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    setBusiness(work?.business ?? null);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load estado cuenta error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('load estado cuenta error', err));
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

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.helperText}>Primero crea tu negocio.</Text>
      </View>
    );
  }

  const isLimited = business.is_limited;

  const businessTypeLabel: Record<string, string> = {
    workshop: 'Taller',
    store: 'Tienda',
  };
  const businessTypeIcon: Record<string, 'construct' | 'storefront'> = {
    workshop: 'construct',
    store: 'storefront',
  };
  const typeLabel = businessTypeLabel[business.business_type] ?? business.business_type;
  const typeIcon = businessTypeIcon[business.business_type] ?? 'business';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.typeRow}>
        <View style={styles.typeLeftGroup}>
          <Ionicons name={typeIcon} size={18} color={colors.textMuted} />
          <Text style={styles.typeLabel}>Tipo de cuenta</Text>
        </View>
        <View style={styles.typeRightGroup}>
          <Text style={styles.typeValue}>{typeLabel}</Text>
          <View style={[styles.badge, isLimited ? styles.badgeLimited : styles.badgeActive]}>
            <Ionicons
              name={isLimited ? 'alert-circle' : 'checkmark-circle'}
              size={14}
              color={isLimited ? colors.danger : colors.success}
            />
            <Text style={[styles.badgeText, { color: isLimited ? colors.danger : colors.success }]}>
              {isLimited ? 'Limitado' : 'Activo'}
            </Text>
          </View>
        </View>
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

      <Pressable
        style={({ pressed }) => [styles.actionRow, styles.actionRowSpacing, pressed && styles.rowPressed]}
        onPress={() => router.push('/(business)/historial-pagos')}
      >
        <Ionicons name="receipt-outline" size={18} color={colors.text} />
        <Text style={styles.actionLabel}>Historial de pagos</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
        onPress={handleSignOutEverywhere}
        disabled={signingOutEverywhere}
      >
        {signingOutEverywhere ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="shield-outline" size={18} color={colors.danger} />
        )}
        <Text style={[styles.actionLabel, styles.dangerLabel]}>
          {signingOutEverywhere ? 'Cerrando sesión en todos lados…' : 'Cerrar sesión en todos los dispositivos'}
        </Text>
      </Pressable>

      <Text style={styles.legalText}>
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sosmoto.net/terminos')}>
          Términos y Condiciones
        </Text>{' '}
        ·{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sosmoto.net/privacidad')}>
          Política de Privacidad
        </Text>
      </Text>
    </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive: {
    backgroundColor: '#E6F4EA',
  },
  badgeLimited: {
    backgroundColor: '#FBE8E8',
  },
  badgeText: {
    fontSize: 12,
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
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  typeLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  typeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  legalText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  actionRowSpacing: {
    marginTop: 20,
    marginBottom: 10,
  },
  rowPressed: {
    opacity: 0.55,
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  dangerLabel: {
    color: colors.danger,
  },
});
