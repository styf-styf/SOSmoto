import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getBusinessById } from '../../../services/businesses';
import { getClientConversations, subscribeToThreadChanges } from '../../../services/messages';
import type { Business } from '../../../types/database';
import { formatConversationTimestamp } from '../../../utils/chatFormat';

interface ConversationRow {
  business: Business;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export default function MensajesScreen() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const summaries = await getClientConversations(profile.id);
    const businesses = await Promise.all(summaries.map((s) => getBusinessById(s.otherId)));
    const rows: ConversationRow[] = summaries
      .map((s, i) => {
        const business = businesses[i];
        if (!business) return null;
        return {
          business,
          lastMessage: s.lastMessage,
          lastMessageAt: s.lastMessageAt,
          unread: s.lastSenderId !== profile.id && s.lastReadAt === null,
        };
      })
      .filter((r): r is ConversationRow => r !== null);
    setConversations(rows);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load conversations error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToThreadChanges('client_id', profile.id, () => {
      load().catch((err) => console.error('reload conversations error', err));
    });
    return unsubscribe;
  }, [profile, load]);

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
        <Text style={styles.placeholder}>Tus chats con talleres aparecerán aquí.</Text>
      ) : (
        conversations.map((row) => (
          <Pressable
            key={row.business.id}
            style={styles.row}
            onPress={() => router.push(`/(client)/chat/${row.business.id}`)}
          >
            <View style={styles.avatar}>
              {row.business.logo_url ? (
                <Image source={{ uri: row.business.logo_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="storefront" size={20} color={colors.primary} />
              )}
            </View>
            <View style={styles.rowContent}>
              <View style={styles.rowTopLine}>
                <Text style={[styles.rowName, row.unread && styles.rowNameUnread]} numberOfLines={1}>
                  {row.business.name}
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
