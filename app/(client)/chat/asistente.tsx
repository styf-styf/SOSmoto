import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from '../../../components/ChatHeader';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getAiChatHistory, resolveAiChatAction, sendAiChatMessage } from '../../../services/aiAssistant';
import type { AiChatMessage } from '../../../types/database';
import { formatMessageDateLabel, formatMessageTime, shouldShowDateSeparator } from '../../../utils/chatFormat';

export default function ClientAiAssistantScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setMessages(await getAiChatHistory(profile.id));
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load ai chat history error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function handleSend() {
    if (!profile || sending) return;
    const body = text.trim();
    if (!body) return;

    setText('');
    setSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimistic: AiChatMessage = {
      id: tempId,
      user_id: profile.id,
      role: 'user',
      content: body,
      action: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { userMessage, assistantMessage } = await sendAiChatMessage(body);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempId), userMessage, assistantMessage]);
    } catch (err) {
      console.error('send ai chat message error', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  function handleAction(message: AiChatMessage) {
    if (!message.action) return;
    resolveAiChatAction(message.action, { router, role: 'client' });
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
      <ChatHeader name="Asistente SOSmoto" fallbackIcon="sparkles" />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={styles.placeholder}>
              Hola, soy el asistente de SOSmoto. Pregúntame sobre tu moto, mantenimiento, o cómo funciona la app.
            </Text>
          ) : (
            messages.map((message, index) => {
              const isMine = message.role === 'user';
              return (
                <View key={message.id}>
                  {shouldShowDateSeparator(messages, index) && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>{formatMessageDateLabel(message.created_at)}</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={isMine ? styles.bubbleTextMine : styles.bubbleText}>{message.content}</Text>
                  </View>
                  {!isMine && message.action && (
                    <Pressable style={styles.actionChip} onPress={() => handleAction(message)}>
                      <Ionicons name="arrow-forward-circle-outline" size={16} color={colors.primary} />
                      <Text style={styles.actionChipText}>{message.action.label}</Text>
                    </Pressable>
                  )}
                  <View style={[styles.messageTimeRow, isMine ? styles.messageTimeMine : styles.messageTimeTheirs]}>
                    {message.id.startsWith('temp_') ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <Text style={styles.messageTime}>{formatMessageTime(message.created_at)}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
          {sending && (
            <View style={[styles.bubble, styles.bubbleTheirs]}>
              <ActivityIndicator size="small" color={colors.textMuted} />
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: 8 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe tu pregunta…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            blurOnSubmit={false}
          />
          <Pressable style={styles.sendButton} onPress={handleSend} disabled={!text.trim() || sending}>
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 8 },
  placeholder: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 8,
  },
  dateSeparatorText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: colors.surface, alignSelf: 'flex-start' },
  bubbleText: { color: colors.text, fontSize: 14 },
  bubbleTextMine: { color: '#fff', fontSize: 14 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#FFF8F0',
  },
  actionChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  messageTimeRow: { marginTop: 2, marginBottom: 4, minHeight: 16, justifyContent: 'center' },
  messageTime: { fontSize: 11, color: colors.textMuted },
  messageTimeMine: { alignSelf: 'flex-end' },
  messageTimeTheirs: { alignSelf: 'flex-start' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
