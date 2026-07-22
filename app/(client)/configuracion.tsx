import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOut } from '../../services/auth';

// Identifica qué actualización OTA corre de verdad en el dispositivo -- útil
// para diagnosticar "publiqué un fix pero el celular sigue mostrando el bug
// viejo" (las actualizaciones de eas update no se aplican al instante, ver
// https://docs.expo.dev/versions/latest/sdk/updates -- solo se descargan en
// segundo plano y se usan recién en la SIGUIENTE apertura de la app).
const buildInfo = Updates.isEmbeddedLaunch
  ? 'Build de fábrica (sin actualización OTA aplicada)'
  : `Update ${Updates.updateId?.slice(0, 8) ?? '?'} · ${Updates.createdAt?.toLocaleString('es-EC') ?? ''}`;

export default function ConfiguracionScreen() {
  const { profile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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

  function handleDeleteAccount() {
    Alert.alert(
      'Eliminar cuenta',
      'Para eliminar tu cuenta, escríbenos a soporte. Te confirmaremos por correo cuando se complete.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Escribir a soporte',
          onPress: () => {
            const subject = encodeURIComponent('Eliminar mi cuenta');
            const body = encodeURIComponent(`Hola, quiero eliminar mi cuenta (${profile?.email ?? ''}).`);
            Linking.openURL(`mailto:soporte@sosmoto.app?subject=${subject}&body=${body}`).catch((err) =>
              console.error('open mail error', err)
            );
          },
        },
      ]
    );
  }

  async function handleOpenSettings() {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.error('open settings error', err);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Mi cuenta</Text>
      <View style={styles.menuGroup}>
        <MenuRow icon="person-outline" label="Perfil personal" onPress={() => router.push('/(client)/datos-personales')} />
        <MenuRow icon="lock-closed-outline" label="Contraseña" onPress={() => router.push('/(client)/cambiar-password')} />
        <MenuRow
          icon="alert-circle-outline"
          label="Estado de cuenta"
          badge={profile?.is_limited ? 'Limitado' : undefined}
          badgeDanger={!!profile?.is_limited}
          onPress={() => router.push('/(client)/estado-cuenta')}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>Mi contenido</Text>
      <View style={styles.menuGroup}>
        <MenuRow icon="bicycle-outline" label="Mis motos" onPress={() => router.push('/(client)/vehiculos')} />
        <MenuRow icon="calendar-outline" label="Mis citas" onPress={() => router.push('/(client)/citas')} />
        <MenuRow icon="bag-handle-outline" label="Mis compras" onPress={() => router.push('/(client)/mis-compras')} />
        <MenuRow icon="time-outline" label="Historial de servicios" onPress={() => router.push('/(client)/historial')} last />
      </View>

      <Text style={styles.sectionTitle}>Sistema</Text>
      <View style={styles.menuGroup}>
        <MenuRow
          icon="location-outline"
          label="Permisos de ubicación"
          hint="Necesario para auxilio y búsqueda"
          onPress={handleOpenSettings}
          external
        />
        <MenuRow
          icon="notifications-outline"
          label="Notificaciones"
          onPress={() => router.push('/(client)/notificaciones-preferencias')}
          last
        />
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        )}
        <Text style={styles.dangerLabel}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
      </Pressable>

      {/* Eliminar cuenta — oculto temporalmente */}

      <Text style={styles.buildInfo}>{buildInfo}</Text>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  badge,
  badgeDanger,
  onPress,
  last,
  external,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  badge?: string;
  badgeDanger?: boolean;
  onPress: () => void;
  last?: boolean;
  external?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, !last && styles.menuRowBorder, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.menuRowIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.menuRowContent}>
        <Text style={styles.menuRowLabel}>{label}</Text>
        {hint && <Text style={styles.menuRowHint}>{hint}</Text>}
      </View>
      {badge && <Text style={[styles.menuRowBadge, badgeDanger && styles.menuRowBadgeDanger]}>{badge}</Text>}
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={15}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.55,
  },
  menuRowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowContent: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  menuRowHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  menuRowBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  menuRowBadgeDanger: {
    color: colors.danger,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },
  buildInfo: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
