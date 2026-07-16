import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ImagePickerAsset } from 'expo-image-picker';
import { ChatHeader } from '../../../components/ChatHeader';
import { ImageViewerModal } from '../../../components/ImageViewerModal';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getBusinessById, getMyBusiness } from '../../../services/businesses';
import {
  getMessages,
  markThreadRead,
  sendMessage,
  subscribeToMessages,
} from '../../../services/messages';
import {
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadChatImage,
} from '../../../services/storage';
import {
  cancelAppointmentRequest,
  getActiveAppointmentRequest,
  subscribeToAppointmentRequest,
  type AppointmentRequest,
} from '../../../services/appointmentRequests';
import {
  cancelProductIntent,
  getClientProductIntents,
  subscribeToClientProductIntentsForBusiness,
} from '../../../services/productIntents';
import type {
  Business,
  Message,
  ProductIntentWithProduct,
} from '../../../types/database';
import {
  formatMessageDateLabel,
  formatMessageTime,
  parseQuote,
  shouldShowDateSeparator,
} from '../../../utils/chatFormat';

export default function ChatScreen() {
  const { id, prefill, autoSend } = useLocalSearchParams<{
    id: string;
    prefill?: string;
    autoSend?: string;
  }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const autoSentRef = useRef(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(prefill ?? '');
  const [loading, setLoading] = useState(true);
  const [pendingImage, setPendingImage] = useState<ImagePickerAsset | null>(
    null,
  );
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);

  // Banner de solicitud de cita
  const [appointmentRequest, setAppointmentRequest] =
    useState<AppointmentRequest | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  // Banner de apartados de producto pendientes/confirmados
  const [productIntents, setProductIntents] = useState<
    ProductIntentWithProduct[]
  >([]);
  const [cancellingIntentId, setCancellingIntentId] = useState<string | null>(
    null,
  );

  // IDs de banners que el usuario cerró con la (X) -- solo oculta la tarjeta
  // de la vista, no cancela nada; se resetea si se recarga el chat.
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
    new Set(),
  );
  function dismissBanner(key: string) {
    setDismissedBanners((prev) => new Set(prev).add(key));
  }

  const resolveThread = useCallback(async () => {
    if (!profile || !id) return null;
    if (profile.role === 'client') {
      return { clientId: profile.id, businessId: id };
    }
    const myBusiness = await getMyBusiness(profile.id);
    if (!myBusiness) return null;
    return { clientId: id, businessId: myBusiness.id };
  }, [profile, id]);

  const loadProductIntents = useCallback(async (cId: string, bId: string) => {
    const all = await getClientProductIntents(bId, cId);
    setProductIntents(
      all.filter((i) => i.status === 'pending' || i.status === 'confirmed'),
    );
  }, []);

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
          getActiveAppointmentRequest(thread.clientId, thread.businessId).then(
            setAppointmentRequest,
          ),
          loadProductIntents(thread.clientId, thread.businessId),
        ]);
        setMessages(history);
        if (profile) {
          await markThreadRead(thread.clientId, thread.businessId, profile.id);
        }
      })
      .catch((err) => console.error('load chat error', err))
      .finally(() => setLoading(false));
  }, [resolveThread, loadProductIntents]);

  // Suscripción a cambios en la solicitud de cita
  useEffect(() => {
    if (!clientId || !businessId) return;
    const unsubscribe = subscribeToAppointmentRequest(
      clientId,
      businessId,
      'client',
      (req) => {
        setAppointmentRequest(req.status === 'pending' ? req : null);
      },
    );
    return unsubscribe;
  }, [clientId, businessId]);

  // Suscripción a cambios en apartados de producto
  useEffect(() => {
    if (!clientId || !businessId) return;
    return subscribeToClientProductIntentsForBusiness(
      clientId,
      businessId,
      () => {
        loadProductIntents(clientId, businessId).catch((err) =>
          console.error('reload product intents error', err),
        );
      },
    );
  }, [clientId, businessId, loadProductIntents]);

  useEffect(() => {
    if (loading || !autoSend || autoSentRef.current) return;
    if (!clientId || !businessId || !profile || !prefill?.trim()) return;
    autoSentRef.current = true;
    const body = prefill.trim();
    setText('');
    sendMessage({ clientId, businessId, senderId: profile.id, body })
      .then((message) => {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      })
      .catch((err) => {
        console.error('auto send error', err);
        setText(body);
      });
  }, [loading, clientId, businessId, autoSend, profile, prefill]);

  useEffect(() => {
    if (!businessId || !clientId) return;
    const unsubscribe = subscribeToMessages(
      'client_id',
      clientId,
      (message) => {
        if (message.business_id !== businessId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          // mensajes propios se gestionan en handleSend (optimistic), el realtime los ignora
          if (message.sender_id === profile?.id) return prev;
          return [...prev, message];
        });
        if (profile && message.sender_id !== profile.id) {
          markThreadRead(clientId, businessId, profile.id).catch((err) =>
            console.error('mark thread read error', err),
          );
        }
      },
    );
    return unsubscribe;
  }, [businessId, clientId, profile]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return sub.remove;
  }, []);

  async function handleCamera() {
    setShowAttach(false);
    try {
      const asset = await pickImageFromCamera(null);
      if (asset) setPendingImage(asset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Error', msg || 'No se pudo acceder a la cámara.');
    }
  }

  async function handleGallery() {
    setShowAttach(false);
    try {
      const asset = await pickImageFromLibrary(null);
      if (asset) setPendingImage(asset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Error', msg || 'No se pudo acceder a la galería.');
    }
  }

  async function handleSend() {
    if (!profile || !clientId || !businessId) return;
    const body = text.trim();
    if (!body && !pendingImage) return;

    setText('');
    const imageToSend = pendingImage;
    setPendingImage(null);

    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      client_id: clientId,
      business_id: businessId,
      sender_id: profile.id,
      body,
      image_url: imageToSend ? imageToSend.uri : null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let imageUrl: string | undefined;
      if (imageToSend) {
        imageUrl = await uploadChatImage(imageToSend, profile.id);
      }
      const message = await sendMessage({
        clientId,
        businessId,
        senderId: profile.id,
        body,
        imageUrl,
      });
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === message.id)
          ? without
          : [...without, message];
      });
    } catch (err) {
      console.error('send message error', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
      if (imageToSend) setPendingImage(imageToSend);
    }
  }

  async function handleCancelRequest() {
    if (!appointmentRequest || cancellingRequest) return;
    Alert.alert(
      'Cancelar solicitud',
      '¿Seguro que quieres cancelar la solicitud de cita?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingRequest(true);
            try {
              await cancelAppointmentRequest(appointmentRequest);
              setAppointmentRequest(null);
            } catch (err) {
              console.error('cancel request error', err);
              Alert.alert('Error', 'No se pudo cancelar la solicitud.');
            } finally {
              setCancellingRequest(false);
            }
          },
        },
      ],
    );
  }

  async function handleCancelIntent(intentId: string) {
    if (cancellingIntentId) return;
    Alert.alert(
      'Cancelar apartado',
      '¿Seguro que quieres cancelar este apartado?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancellingIntentId(intentId);
            try {
              await cancelProductIntent(intentId);
              setProductIntents((prev) =>
                prev.filter((i) => i.id !== intentId),
              );
            } catch (err) {
              console.error('cancel intent error', err);
              Alert.alert('Error', 'No se pudo cancelar el apartado.');
            } finally {
              setCancellingIntentId(null);
            }
          },
        },
      ],
    );
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
      <ImageViewerModal
        uri={viewingImage}
        onClose={() => setViewingImage(null)}
      />
      <ChatHeader
        name={business?.name ?? 'Negocio'}
        avatarUrl={business?.logo_url}
        fallbackIcon="storefront"
        isVerified={business?.is_verified ?? false}
        onPressName={
          businessId
            ? () => router.push(`/(client)/business/${businessId}`)
            : undefined
        }
      />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Banner: solicitud de cita pendiente (lado cliente) */}
        {appointmentRequest &&
          !dismissedBanners.has(`req:${appointmentRequest.id}`) && (
            <View style={styles.requestBanner}>
              <Pressable
                style={styles.dismissBannerBtn}
                onPress={() => dismissBanner(`req:${appointmentRequest.id}`)}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
              <View style={styles.requestBannerInfo}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.primary}
                />
                <View style={styles.requestBannerText}>
                  <Text style={styles.requestBannerTitle}>
                    Solicitud de cita pendiente
                  </Text>
                  {appointmentRequest.service_name ? (
                    <Text style={styles.requestBannerSub} numberOfLines={1}>
                      {appointmentRequest.service_name}
                      {appointmentRequest.suggested_at
                        ? ` · ${new Date(appointmentRequest.suggested_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={styles.cancelRequestBtn}
                onPress={handleCancelRequest}
                disabled={cancellingRequest}
              >
                {cancellingRequest ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.cancelRequestBtnText}>Cancelar</Text>
                )}
              </Pressable>
            </View>
          )}

        {/* Banner: apartados de producto pendientes/confirmados (lado cliente) */}
        {productIntents
          .filter((intent) => !dismissedBanners.has(`intent:${intent.id}`))
          .map((intent) => (
            <View key={intent.id} style={styles.requestBanner}>
              <Pressable
                style={styles.dismissBannerBtn}
                onPress={() => dismissBanner(`intent:${intent.id}`)}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
              <View style={styles.requestBannerInfo}>
                <Ionicons
                  name="cube-outline"
                  size={16}
                  color={colors.primary}
                />
                <View style={styles.requestBannerText}>
                  <Text style={styles.requestBannerTitle}>
                    {intent.status === 'confirmed'
                      ? 'Apartado confirmado'
                      : 'Apartado pendiente'}
                  </Text>
                  <Text style={styles.requestBannerSub} numberOfLines={1}>
                    {intent.quantity > 1 ? `${intent.quantity} × ` : ''}
                    {intent.product_name}
                    {intent.product_price != null
                      ? ` · $${(intent.product_price * intent.quantity).toFixed(2)}`
                      : ''}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.cancelRequestBtn}
                onPress={() => handleCancelIntent(intent.id)}
                disabled={cancellingIntentId === intent.id}
              >
                {cancellingIntentId === intent.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.cancelRequestBtnText}>Cancelar</Text>
                )}
              </Pressable>
            </View>
          ))}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messages.length === 0 ? (
            <Text style={styles.placeholder}>
              Aún no hay mensajes. Escribe el primero.
            </Text>
          ) : (
            messages.map((message, index) => {
              const isMine = message.sender_id === profile?.id;
              const quote = parseQuote(message.body);
              return (
                <View key={message.id}>
                  {shouldShowDateSeparator(messages, index) && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorText}>
                        {formatMessageDateLabel(message.created_at)}
                      </Text>
                    </View>
                  )}
                  {quote ? (
                    <View
                      style={[
                        styles.quoteCard,
                        isMine ? styles.quoteCardMine : styles.quoteCardTheirs,
                      ]}
                    >
                      <View style={styles.quoteHeader}>
                        <Ionicons
                          name="receipt-outline"
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={styles.quoteTitle}>
                          Cotización del taller
                        </Text>
                      </View>
                      <Text style={styles.quoteService}>{quote.service}</Text>
                      <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>Precio:</Text>
                        <Text style={styles.quoteValue}>{quote.price}</Text>
                      </View>
                      <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>Tiempo est.:</Text>
                        <Text style={styles.quoteValue}>{quote.time}</Text>
                      </View>
                    </View>
                  ) : message.image_url ? (
                    <Pressable
                      style={[
                        styles.imageBubble,
                        isMine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                      onPress={() => setViewingImage(message.image_url!)}
                    >
                      <Image
                        source={{ uri: message.image_url }}
                        style={styles.chatImage}
                        resizeMode="cover"
                      />
                      {!!message.body && (
                        <Text
                          style={[
                            styles.imageBubbleCaption,
                            isMine ? styles.bubbleTextMine : styles.bubbleText,
                          ]}
                        >
                          {message.body}
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        isMine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      <Text
                        style={
                          isMine ? styles.bubbleTextMine : styles.bubbleText
                        }
                      >
                        {message.body}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageTimeRow,
                      isMine
                        ? styles.messageTimeMine
                        : styles.messageTimeTheirs,
                    ]}
                  >
                    {message.id.startsWith('temp_') ? (
                      <Ionicons
                        name="time-outline"
                        size={11}
                        color={colors.textMuted}
                      />
                    ) : (
                      <Text style={styles.messageTime}>
                        {formatMessageTime(message.created_at)}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {pendingImage && (
          <View style={styles.pendingImageRow}>
            <Image
              source={{ uri: pendingImage.uri }}
              style={styles.pendingImageThumb}
              resizeMode="cover"
            />
            <Pressable
              style={styles.pendingImageRemove}
              onPress={() => setPendingImage(null)}
            >
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
        <View style={[styles.inputRow, { paddingBottom: 8 + insets.bottom }]}>
          <View style={{ position: 'relative' }}>
            {showAttach && (
              <View style={styles.attachBar}>
                <Pressable style={styles.iconButton} onPress={handleCamera}>
                  <Ionicons
                    name="camera-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
                <Pressable style={styles.iconButton} onPress={handleGallery}>
                  <Ionicons
                    name="images-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            )}
            <Pressable
              style={styles.iconButton}
              onPress={() => setShowAttach((v) => !v)}
            >
              <Ionicons
                name={showAttach ? 'close' : 'add'}
                size={24}
                color={showAttach ? colors.primary : colors.textMuted}
              />
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            blurOnSubmit={false}
          />
          <Pressable
            style={styles.sendButton}
            onPress={handleSend}
            disabled={!text.trim() && !pendingImage}
          >
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
  requestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF4FF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dismissBannerBtn: {
    padding: 2,
  },
  requestBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  requestBannerText: {
    flex: 1,
  },
  requestBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  requestBannerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  cancelRequestBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelRequestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
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
  messageTimeRow: {
    marginTop: 2,
    marginBottom: 4,
    minHeight: 16,
    justifyContent: 'center',
  },
  messageTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  messageTimeMine: {
    alignSelf: 'flex-end',
  },
  messageTimeTheirs: {
    alignSelf: 'flex-start',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  attachBar: {
    position: 'absolute',
    bottom: 38,
    left: 0,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  pendingImageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  pendingImageThumb: {
    width: 80,
    aspectRatio: 3 / 4,
    borderRadius: 8,
  },
  pendingImageRemove: {
    position: 'absolute',
    top: 4,
    left: 80,
  },
  imageBubble: {
    maxWidth: '80%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  chatImage: {
    width: 200,
    aspectRatio: 3 / 4,
  },
  imageBubbleCaption: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quoteCard: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  quoteCardMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFF8F0',
    borderColor: colors.primary,
  },
  quoteCardTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  quoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quoteService: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  quoteRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  quoteLabel: {
    fontSize: 13,
    color: colors.textMuted,
    minWidth: 80,
  },
  quoteValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
});
