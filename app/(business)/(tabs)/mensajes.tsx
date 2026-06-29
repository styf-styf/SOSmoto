import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyBusiness } from '../../../services/businesses';
import { getBusinessConversations, subscribeToThreadChanges } from '../../../services/messages';
import { supabase } from '../../../services/supabase';
import { formatConversationTimestamp } from '../../../utils/chatFormat';

interface ConversationRow {
  clientId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export default function BusinessMensajesScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const business = await getMyBusiness(profile.id);
    if (!business) return;
    setBusinessId(business.id);

    const summaries = await getBusinessConversations(business.id);
    if (summaries.length === 0) {
      setConversations([]);
      return;
    }

    const { data: clients, error } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .in('id', summaries.map((s) => s.otherId));
    if (error) throw error;

    const clientById = new Map((clients ?? []).map((c) => [c.id, c]));
    setConversations(
      summaries.map((s) => {
        const client = clientById.get(s.otherId);
        return {
          clientId: s.otherId,
          clientName: client?.full_name ?? 'Cliente',
          clientAvatarUrl: client?.avatar_url ?? null,
          lastMessage: s.lastMessage,
          lastMessageAt: s.lastMessageAt,
          unread: s.lastSenderId === s.otherId && s.lastReadAt === null,
        };
      })
    );
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load business conversations error', err))
      .finally(() => setLoading(false));
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
    <ScrollView contentContainerStyle={styles.container}>
      {conversations.length === 0 ? (
        <Text style={styles.placeholder}>Tus chats con clientes aparecerán aquí.</Text>
      ) : (
        conversations.map((row) => (
          <Pressable
            key={row.clientId}
            style={styles.row}
            onPress={() => router.push(`/(business)/chat/${row.clientId}`)}
          >
            <View style={styles.avatar}>
              {row.clientAvatarUrl ? (
                <Image source={{ uri: row.clientAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={colors.primary} />
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
                <Text
                  style={[styles.rowMessage, row.unread && styles.rowMessageUnread]}
                  numberOfLines={1}
                >
                  {row.lastMessage}
                </Text>
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
