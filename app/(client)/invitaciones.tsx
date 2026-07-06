import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getPendingInvitations, respondToInvitation, type PendingInvitation } from '../../services/businessClients';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 7)} sem.`;
}

export default function InvitacionesScreen() {
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getPendingInvitations(profile.id);
    setInvitations(data);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load invitations error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handleRespond(invitation: PendingInvitation, accept: boolean) {
    setResponding(invitation.id);
    try {
      await respondToInvitation(invitation.id, accept);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      if (accept) {
        Alert.alert('¡Aceptado!', `Ahora eres cliente de ${invitation.businessName}.`);
      }
    } catch (err) {
      console.error('respond invitation error', err);
      Alert.alert('Error', 'No se pudo procesar tu respuesta. Intenta de nuevo.');
    } finally {
      setResponding(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (invitations.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-open-outline" size={56} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sin invitaciones</Text>
        <Text style={styles.emptyHint}>
          Cuando un taller te agregue como cliente, recibirás una notificación aquí para aceptar o rechazar.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.intro}>
        Los talleres que te quieren agregar como cliente:
      </Text>
      {invitations.map((inv) => {
        const isResponding = responding === inv.id;
        return (
          <View key={inv.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.logo}>
                {inv.businessLogo ? (
                  <Image source={{ uri: inv.businessLogo }} style={styles.logoImage} />
                ) : (
                  <Ionicons name="storefront" size={26} color={colors.primary} />
                )}
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.bizName}>{inv.businessName}</Text>
                {inv.businessCity && (
                  <Text style={styles.bizCity}>
                    <Ionicons name="location-outline" size={12} /> {inv.businessCity}
                  </Text>
                )}
                <Text style={styles.timeAgo}>{timeAgo(inv.createdAt)}</Text>
              </View>
            </View>

            <Text style={styles.cardBody}>
              {inv.businessName} quiere agregarte a su lista de clientes. Acepta para que puedan gestionar tu historial de servicios, o rechaza si no lo conoces.
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.rejectBtn, isResponding && styles.btnDisabled]}
                onPress={() => handleRespond(inv, false)}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <Text style={styles.rejectBtnText}>Rechazar</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.btn, styles.acceptBtn, isResponding && styles.btnDisabled]}
                onPress={() => handleRespond(inv, true)}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.acceptBtnText}>Aceptar</Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 16,
    gap: 14,
    backgroundColor: colors.background,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  bizName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  bizCity: {
    fontSize: 13,
    color: colors.textMuted,
  },
  timeAgo: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  rejectBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rejectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  acceptBtn: {
    backgroundColor: colors.primary,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
