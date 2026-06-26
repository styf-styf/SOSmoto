import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getBusinessById } from '../../services/businesses';
import { getClientConversations } from '../../services/messages';
import type { Business } from '../../types/database';

interface ConversationRow {
  business: Business;
  lastMessage: string;
  lastMessageAt: string;
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
        return business ? { business, lastMessage: s.lastMessage, lastMessageAt: s.lastMessageAt } : null;
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mensajes</Text>
      {conversations.length === 0 ? (
        <Text style={styles.placeholder}>Tus chats con talleres aparecerán aquí.</Text>
      ) : (
        conversations.map((row) => (
          <Pressable
            key={row.business.id}
            style={styles.row}
            onPress={() => router.push(`/(client)/chat/${row.business.id}`)}
          >
            <Text style={styles.rowName}>{row.business.name}</Text>
            <Text style={styles.rowMessage}>{row.lastMessage}</Text>
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
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowMessage: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
