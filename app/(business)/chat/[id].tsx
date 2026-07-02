import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from '../../../components/ChatHeader';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getMyBusiness } from '../../../services/businesses';
import { getMessages, markThreadRead, sendMessage, subscribeToMessages } from '../../../services/messages';
import { getPendingIntentsForBusinessClient, updateIntentStatus } from '../../../services/productIntents';
import { getPendingServiceIntentsForBusinessClient, updateServiceIntentStatus } from '../../../services/serviceIntents';
import { getUserById } from '../../../services/users';
import type { Message, ProductIntentWithProduct, ServiceIntentWithService, User } from '../../../types/database';
import { formatMessageDateLabel, formatMessageTime, shouldShowDateSeparator } from '../../../utils/chatFormat';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isLimited, setIsLimited] = useState(false);
  const [client, setClient] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [intents, setIntents] = useState<ProductIntentWithProduct[]>([]);
  const [serviceIntents, setServiceIntents] = useState<ServiceIntentWithService[]>([]);
  const [processingIntent, setProcessingIntent] = useState<string | null>(null);

  const resolveThread = useCallback(async () => {
    if (!profile || !id) return null;
    if (profile.role === 'client') {
      return { clientId: profile.id, businessId: id, isLimited: false };
    }
    const business = await getMyBusiness(profile.id);
    if (!business) return null;
    return { clientId: id, businessId: business.id, isLimited: business.is_limited };
  }, [profile, id]);

  useEffect(() => {
    setLoading(true);
    resolveThread()
      .then(async (thread) => {
        if (!thread) return;
        setClientId(thread.clientId);
        setBusinessId(thread.businessId);
        setIsLimited(thread.isLimited);
        const [history] = await Promise.all([
          getMessages(thread.clientId, thread.businessId),
          getUserById(thread.clientId).then(setClient),
          getPendingIntentsForBusinessClient(thread.businessId, thread.clientId).then(setIntents),
          getPendingServiceIntentsForBusinessClient(thread.businessId, thread.clientId).then(setServiceIntents),
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

  async function handleIntentAction(intentId: string, status: 'confirmed' | 'unavailable') {
    setProcessingIntent(intentId);
    try {
      await updateIntentStatus(intentId, status);
      setIntents((prev) => prev.filter((i) => i.id !== intentId));
    } catch (err) {
      console.error('update intent error', err);
      Alert.alert('Error', 'No se pudo actualizar el estado. Intenta de nuevo.');
    } finally {
      setProcessingIntent(null);
    }
  }

  async function handleServiceIntentAction(intentId: string, status: 'confirmed' | 'unavailable') {
    setProcessingIntent(intentId);
    try {
      await updateServiceIntentStatus(intentId, status);
      setServiceIntents((prev) => prev.filter((i) => i.id !== intentId));
    } catch (err) {
      console.error('update service intent error', err);
      Alert.alert('Error', 'No se pudo actualizar el estado. Intenta de nuevo.');
    } finally {
      setProcessingIntent(null);
    }
  }

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
      <ChatHeader name={client?.full_name ?? 'Cliente'} avatarUrl={client?.avatar_url} fallbackIcon="person" />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {(intents.length > 0 || serviceIntents.length > 0) && (
          <View style={styles.intentsBanner}>
            {intents.map((intent) => (
              <View key={intent.id} style={styles.intentCard}>
                <View style={styles.intentInfo}>
                  <Ionicons name="cube-outline" size={16} color={colors.primary} />
                  <Text style={styles.intentText} numberOfLines={1}>
                    Quiere apartar: <Text style={styles.intentName}>{intent.product_name}</Text>
                    {intent.product_price != null ? ` · $${intent.product_price.toFixed(2)}` : ''}
                  </Text>
                </View>
                <View style={styles.intentActions}>
                  <Pressable
                    style={[styles.intentBtn, styles.intentBtnConfirm]}
                    onPress={() => handleIntentAction(intent.id, 'confirmed')}
                    disabled={processingIntent === intent.id}
                  >
                    {processingIntent === intent.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.intentBtnText}>Confirmar venta</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.intentBtn, styles.intentBtnReject]}
                    onPress={() => handleIntentAction(intent.id, 'unavailable')}
                    disabled={processingIntent === intent.id}
                  >
                    <Text style={[styles.intentBtnText, styles.intentBtnTextReject]}>No disponible</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {serviceIntents.map((intent) => (
              <View key={intent.id} style={styles.intentCard}>
                <View style={styles.intentInfo}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.intentText} numberOfLines={1}>
                    Quiere agendar: <Text style={styles.intentName}>{intent.service_name}</Text>
                    {intent.service_price != null ? ` · $${intent.service_price.toFixed(2)}` : ''}
                  </Text>
                </View>
                <View style={styles.intentActions}>
                  <Pressable
                    style={[styles.intentBtn, styles.intentBtnConfirm]}
                    onPress={() => handleServiceIntentAction(intent.id, 'confirmed')}
                    disabled={processingIntent === intent.id}
                  >
                    {processingIntent === intent.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.intentBtnText}>Confirmar cita</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.intentBtn, styles.intentBtnReject]}
                    onPress={() => handleServiceIntentAction(intent.id, 'unavailable')}
                    disabled={processingIntent === intent.id}
                  >
                    <Text style={[styles.intentBtnText, styles.intentBtnTextReject]}>No disponible</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
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

        {isLimited ? (
          <View style={styles.limitedNotice}>
            <Text style={styles.limitedNoticeText}>Tu negocio está limitado: no puedes enviar mensajes.</Text>
          </View>
        ) : (
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
        )}
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
  intentsBanner: {
    backgroundColor: '#EEF4FF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  intentCard: {
    gap: 6,
  },
  intentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intentText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  intentName: {
    fontWeight: '700',
  },
  intentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  intentBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  intentBtnConfirm: {
    backgroundColor: colors.primary,
  },
  intentBtnReject: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  intentBtnTextReject: {
    color: colors.text,
  },
  limitedNotice: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FBE8E8',
  },
  limitedNoticeText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
});
