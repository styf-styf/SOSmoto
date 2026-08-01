import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { signOutEverywhere } from '../../services/auth';

export default function EstadoCuentaScreen() {
  const { profile } = useAuth();
  const isLimited = profile?.is_limited ?? false;
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
          <Text style={styles.reasonText}>{profile?.limitation_reason || 'No se especificó un motivo.'}</Text>

          <Text style={styles.sectionTitle}>Mientras tu cuenta esté limitada no puedes:</Text>
          <View style={styles.list}>
            <ListItem text="Crear publicaciones" />
            <ListItem text="Subir historias" />
            <ListItem text="Buscar talleres" />
          </View>
          <Text style={styles.helperText}>
            El resto de la app sigue funcionando con normalidad, incluido el botón SOS para pedir auxilio en
            carretera.
          </Text>
        </>
      ) : (
        <Text style={styles.helperText}>Tu cuenta está activa, sin restricciones.</Text>
      )}

      <Text style={styles.legalText}>
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sosmoto.net/terminos')}>
          Términos y Condiciones
        </Text>{' '}
        ·{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL('https://sosmoto.net/privacidad')}>
          Política de Privacidad
        </Text>
      </Text>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
        onPress={handleSignOutEverywhere}
        disabled={signingOutEverywhere}
      >
        {signingOutEverywhere ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="shield-outline" size={18} color={colors.danger} />
        )}
        <Text style={styles.dangerLabel}>
          {signingOutEverywhere ? 'Cerrando sesión en todos lados…' : 'Cerrar sesión en todos los dispositivos'}
        </Text>
      </Pressable>
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
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 24,
    marginBottom: 20,
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
  rowPressed: {
    opacity: 0.55,
  },
  dangerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },
});
