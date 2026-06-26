import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyBusiness } from '../../../services/businesses';
import { getMessages, markThreadRead, sendMessage, subscribeToMessages } from '../../../services/messages';
import type { Message } from '../../../types/database';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const resolveThread = useCallback(async () => {
    if (!profile || !id) return null;
    if (profile.role === 'client') {
      return { clientId: profile.id, businessId: id };
    }
    const business = await getMyBusiness(profile.id);
    if (!business) return null;
    return { clientId: id, businessId: business.id };
  }, [profile, id]);

  useEffect(() => {
    setLoading(true);
    resolveThread()
      .then(async (thread) => {
        if (!thread) return;
        setClientId(thread.clientId);
        setBusinessId(thread.businessId);
        const history = await getMessages(thread.clientId, thread.businessId);
        setMessages(history);
        if (profile) {
          await markThreadRead(thread.clientId, thread.businessId, profile.id);
        }
      })
      .catch((err) => console.error('load chat error', err))
      .finally(() => setLoading(false));
  }, [resolveThread]);

  useEffect(() => {
    if (!businessId || !clientId) return;
    const unsubscribe = subscribeToMessages('business_id', businessId, (message) => {
      if (message.client_id !== clientId) return;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      if (profile && message.sender_id !== profile.id) {
        markThreadRead(clientId, businessId, profile.id).catch((err) =>
          console.error('mark thread read error', err)
        );
      }
    });
    return unsubscribe;
  }, [businessId, clientId, profile]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function handleSend() {
    if (!profile || !clientId || !businessId || !text.trim()) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const message = await sendMessage({
        clientId,
        businessId,
        senderId: profile.id,
        body,
      });
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err) {
      console.error('send message error', err);
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.messages}>
        {messages.length === 0 ? (
          <Text style={styles.placeholder}>Aún no hay mensajes. Escribe el primero.</Text>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[styles.bubble, message.sender_id === profile?.id ? styles.bubbleMine : styles.bubbleTheirs]}
            >
              <Text style={message.sender_id === profile?.id ? styles.bubbleTextMine : styles.bubbleText}>
                {message.body}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    flex: 1,
    backgroundColor: colors.background,
  },
  messages: {
    padding: 16,
    gap: 8,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  bubbleText: {
    color: colors.text,
    fontSize: 14,
  },
  bubbleTextMine: {
    color: '#fff',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
