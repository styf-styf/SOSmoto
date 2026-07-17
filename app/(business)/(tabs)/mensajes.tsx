import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getBusinessConversations, subscribeToThreadChanges } from '../../../services/messages';
import { supabase } from '../../../services/supabase';
import { getUsersByIds } from '../../../services/users';
import { formatConversationTimestamp } from '../../../utils/chatFormat';

interface ConversationRow {
  clientId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  isBusiness: boolean;
  isVerified: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export default function BusinessMensajesScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusinessId(work.business.id);

    const summaries = await getBusinessConversations(work.business.id);
    if (summaries.length === 0) {
      setConversations([]);
      return;
    }

    const clients = await getUsersByIds(summaries.map((s) => s.otherId));
    const clientById = new Map(clients.map((c) => [c.id, c]));

    // Para interlocutores B2B, buscamos si tienen un negocio como dueños.
    const otherIds = summaries.map((s) => s.otherId);
    const businessByOwnerId = new Map<string, { name: string; logo_url: string | null; is_verified: boolean }>();
    const { data: bizRows } = await supabase
      .from('businesses')
      .select('owner_id, name, logo_url, is_verified')
      .in('owner_id', otherIds);
    (bizRows ?? []).forEach((b: { owner_id: string; name: string; logo_url: string | null; is_verified: boolean }) => {
      businessByOwnerId.set(b.owner_id, { name: b.name, logo_url: b.logo_url, is_verified: b.is_verified });
    });

    setConversations(
      summaries.map((s) => {
        const client = clientById.get(s.otherId);
        const biz = businessByOwnerId.get(s.otherId);
        return {
          clientId: s.otherId,
          clientName: biz?.name ?? client?.full_name ?? 'Cliente',
          clientAvatarUrl: biz?.logo_url ?? client?.avatar_url ?? null,
          isBusiness: !!biz,
          isVerified: biz?.is_verified ?? false,
          lastMessage: s.lastMessage,
          lastMessageAt: s.lastMessageAt,
          unread: s.lastSenderId === s.otherId && s.lastReadAt === null,
        };
      })
    );
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useEffect(() => {
    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      setLoading(true);
      load()
        .catch((err) => console.error('load business conversations error', err))
        .finally(() => setLoading(false));
    } else {
      load().catch((err) => console.error('load business conversations background refresh error', err));
    }
  }, [load]);

  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToThreadChanges('business_id', businessId, () => {
      load().catch((err) => console.error('reload business conversations error', err));
    });
    return unsubscribe;
  }, [businessId, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Pressable style={styles.row} onPress={() => router.push('/(business)/chat/asistente')}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowName}>Asistente SOSmoto</Text>
          <Text style={styles.rowMessage} numberOfLines={1}>Pregúntame lo que necesites</Text>
        </View>
      </Pressable>

      {conversations.length === 0 ? (
        <Text style={styles.placeholder}>Tus chats con clientes aparecerán aquí.</Text>
      ) : (
        conversations.map((row) => (
          <Pressable
            key={row.clientId}
            style={styles.row}
            onPress={() => router.push(`/(business)/chat/${row.clientId}`)}
          >
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                {row.clientAvatarUrl ? (
                  <Image source={{ uri: row.clientAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name={row.isBusiness ? 'storefront' : 'person'} size={20} color={colors.primary} />
                )}
              </View>
              {row.isVerified && (
                <View style={styles.verifiedDot}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                </View>
              )}
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTopLine}>
                <Text style={[styles.rowName, row.unread && styles.rowNameUnread]} numberOfLines={1}>
                  {row.clientName}
                </Text>
                <Text style={[styles.rowTime, row.unread && styles.rowTimeUnread]}>
                  {formatConversationTimestamp(row.lastMessageAt)}
                </Text>
              </View>
              <View style={styles.rowBottomLine}>
                {row.lastMessage === '[Imagen]' ? (
                  <View style={styles.imagePreview}>
                    <Ionicons name="image-outline" size={14} color={row.unread ? colors.text : colors.textMuted} />
                    <Text style={[styles.rowMessage, row.unread && styles.rowMessageUnread]}>
                      Imagen
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.rowMessage, row.unread && styles.rowMessageUnread]} numberOfLines={1}>
                    {row.lastMessage}
                  </Text>
                )}
                {row.unread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  rowContent: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  rowNameUnread: {
    color: colors.text,
    fontWeight: '700',
  },
  rowTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowTimeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  rowMessage: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  rowMessageUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
