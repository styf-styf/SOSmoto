import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getCRMClients, getCRMClientsForStore, type CRMClient } from '../../services/history';

const PADDING = 16;
const GAP = 10;
const CARD_WIDTH = (Dimensions.get('window').width - PADDING * 2 - GAP) / 2;

function formatLastVisit(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem.`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientesScreen() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isStore, setIsStore] = useState(false);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    const storeType = work.business.business_type === 'store';
    setIsStore(storeType);
    const result = storeType
      ? await getCRMClientsForStore(work.business.id)
      : await getCRMClients(work.business.id);
    setClients(result);
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load crm clients error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('load crm clients error', err));
      }
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [clients, search]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TextInput
          style={[styles.searchInput, { flex: 1, margin: 0 }]}
          placeholder="Buscar por nombre o teléfono…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        <Pressable
          style={styles.newBtn}
          onPress={() => router.push('/(business)/nuevo-cliente')}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          <Text style={styles.newBtnText}>Nuevo</Text>
        </Pressable>
      </View>

      {clients.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin clientes aún</Text>
          <Text style={styles.emptyHint}>
            Aquí aparecerán los clientes que hayan completado una cita o auxilio contigo.
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyHint}>Sin resultados para "{search}".</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
          <Text style={styles.countLabel}>
            {filtered.length} {filtered.length === 1 ? 'cliente' : 'clientes'}
          </Text>
          <View style={styles.gridRow}>
            {filtered.map((client) => {
              const isPending = client.status === 'pending';
              return (
                <Pressable
                  key={client.id}
                  style={[styles.card, isPending && styles.cardPending]}
                  onPress={() => {
                    if (isPending) return;
                    client.is_external
                      ? router.push(
                          `/(business)/cliente-externo?name=${encodeURIComponent(client.full_name)}` +
                          (client.phone ? `&phone=${encodeURIComponent(client.phone)}` : '')
                        )
                      : router.push(`/(business)/cliente/${client.id}`);
                  }}
                >
                  {/* Avatar */}
                  <View style={[styles.avatar, isPending && styles.avatarPending]}>
                    {client.avatar_url && !isPending ? (
                      <Image source={{ uri: client.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons
                        name={client.is_external ? 'person-outline' : 'person'}
                        size={28}
                        color={isPending ? '#BDBDBD' : colors.textMuted}
                      />
                    )}
                  </View>

                  {/* Nombre */}
                  <Text style={[styles.name, isPending && styles.namePending]} numberOfLines={1}>
                    {client.full_name}
                  </Text>

                  {/* Badge */}
                  {isPending ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pendiente</Text>
                    </View>
                  ) : client.is_external ? (
                    <View style={styles.extBadge}>
                      <Text style={styles.extBadgeText}>Externo</Text>
                    </View>
                  ) : (
                    <View style={styles.badgePlaceholder} />
                  )}

                  {/* Info inferior */}
                  {isPending ? (
                    <Text style={styles.pendingHint} numberOfLines={2}>Esperando aceptación</Text>
                  ) : (
                    <>
                      <View style={styles.visitBadge}>
                        <Text style={styles.visitCount}>{client.total_visits}</Text>
                        <Text style={styles.visitLabel}>
                          {isStore
                            ? (client.total_visits === 1 ? 'compra' : 'compras')
                            : (client.total_visits === 1 ? 'visita' : 'visitas')}
                        </Text>
                      </View>
                      <Text style={styles.lastVisit} numberOfLines={1}>
                        {formatLastVisit(client.last_visit)}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, margin: PADDING, marginBottom: 8,
  },
  searchInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: 12, paddingHorizontal: 12, height: 44,
    backgroundColor: colors.surface,
  },
  newBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  grid: {
    paddingHorizontal: PADDING,
    paddingBottom: 24,
  },
  countLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  cardPending: {
    opacity: 0.75,
    backgroundColor: '#FAFAFA',
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 2,
  },
  avatarPending: { backgroundColor: '#F5F5F5' },
  avatarImage: { width: 64, height: 64 },

  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  namePending: { color: '#9E9E9E' },

  extBadge: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  extBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  badgePlaceholder: { height: 20 },

  pendingBadge: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: '#F57F17' },
  pendingHint: {
    fontSize: 11,
    color: '#BDBDBD',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 15,
  },

  visitBadge: {
    backgroundColor: '#FFF1E6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 52,
  },
  visitCount: { fontSize: 16, fontWeight: '700', color: colors.primary },
  visitLabel: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  lastVisit: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyHint: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
