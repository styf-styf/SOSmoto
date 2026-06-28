import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyBusiness } from '../../../services/businesses';
import { getBusinessConversations } from '../../../services/messages';
import { supabase } from '../../../services/supabase';

interface ConversationRow {
  clientId: string;
  clientName: string;
  lastMessage: string;
}

export default function BusinessMensajesScreen() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const business = await getMyBusiness(profile.id);
    if (!business) return;

    const summaries = await getBusinessConversations(business.id);
    if (summaries.length === 0) {
      setConversations([]);
      return;
    }

    const { data: clients, error } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', summaries.map((s) => s.otherId));
    if (error) throw error;

    const nameById = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
    setConversations(
      summaries.map((s) => ({
        clientId: s.otherId,
        clientName: nameById.get(s.otherId) ?? 'Cliente',
        lastMessage: s.lastMessage,
      }))
    );
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load business conversations error', err))
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
        <Text style={styles.placeholder}>Tus chats con clientes aparecerán aquí.</Text>
      ) : (
        conversations.map((row) => (
          <Pressable
            key={row.clientId}
            style={styles.row}
            onPress={() => router.push(`/(business)/chat/${row.clientId}`)}
          >
            <Text style={styles.rowName}>{row.clientName}</Text>
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
