import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from '../../../components/ChatHeader';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getBusinessById, getMyBusiness } from '../../../services/businesses';
import { getMessages, markThreadRead, sendMessage, subscribeToMessages } from '../../../services/messages';
import type { Business, Message } from '../../../types/database';
import { formatMessageDateLabel, formatMessageTime, shouldShowDateSeparator } from '../../../utils/chatFormat';

export default function ChatScreen() {
  const { id, prefill, autoSend } = useLocalSearchParams<{ id: string; prefill?: string; autoSend?: string }>();
  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const autoSentRef = useRef(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(prefill ?? '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const resolveThread = useCallback(async () => {
    if (!profile || !id) return null;
    if (profile.role === 'client') {
      return { clientId: profile.id, businessId: id };
    }
    const myBusiness = await getMyBusiness(profile.id);
    if (!myBusiness) return null;
    return { clientId: id, businessId: myBusiness.id };
  }, [profile, id]);

  useEffect(() => {
    setLoading(true);
    resolveThread()
      .then(async (thread) => {
        if (!thread) return;
        setClientId(thread.clientId);
        setBusinessId(thread.businessId);
        const [history] = await Promise.all([
          getMessages(thread.clientId, thread.businessId),
          getBusinessById(thread.businessId).then(setBusiness),
        ]);
        setMessages(history);
        if (profile) {
          await markThreadRead(thread.clientId, thread.businessId, profile.id);
        }
      })
      .catch((err) => console.error('load chat error', err))
      .finally(() => setLoading(false));
  }, [resolveThread]);

  useEffect(() => {
    if (loading || !autoSend || autoSentRef.current) return;
    if (!clientId || !businessId || !profile || !prefill?.trim()) return;
    autoSentRef.current = true;
    const body = prefill.trim();
    setText('');
    setSending(true);
    sendMessage({ clientId, businessId, senderId: profile.id, body })
      .then((message) => {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      })
      .catch((err) => {
        console.error('auto send error', err);
        setText(body);
      })
      .finally(() => setSending(false));
  }, [loading, clientId, businessId, autoSend, profile, prefill]);

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

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return sub.remove;
  }, []);

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
    <View style={styles.container}>
      <ChatHeader
        name={business?.name ?? 'Negocio'}
        avatarUrl={business?.logo_url}
        fallbackIcon="storefront"
        onPressName={businessId ? () => router.push(`/(client)/business/${businessId}`) : undefined}
      />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages}>
          {messages.length === 0 ? (
            <Text style={styles.placeholder}>Aún no hay mensajes. Escribe el primero.</Text>
          ) : (
            messages.map((message, index) => (
              <View key={message.id}>
                {shouldShowDateSeparator(messages, index) && (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>{formatMessageDateLabel(message.created_at)}</Text>
                  </View>
                )}
                <View
                  style={[styles.bubble, message.sender_id === profile?.id ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text style={message.sender_id === profile?.id ? styles.bubbleTextMine : styles.bubbleText}>
                    {message.body}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.messageTime,
                    message.sender_id === profile?.id ? styles.messageTimeMine : styles.messageTimeTheirs,
                  ]}
                >
                  {formatMessageTime(message.created_at)}
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
    </View>
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
  flex: {
    flex: 1,
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
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 4,
  },
  messageTimeMine: {
    alignSelf: 'flex-end',
  },
  messageTimeTheirs: {
    alignSelf: 'flex-start',
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
