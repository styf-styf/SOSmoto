import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from '../../../components/ChatHeader';
import { ImageViewerModal } from '../../../components/ImageViewerModal';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useChatMessaging } from '../../../hooks/useChatMessaging';
import { getBusinessById, getMyBusiness } from '../../../services/businesses';
import { getMessages, markThreadRead, sendMessage } from '../../../services/messages';
import {
  getActiveAppointmentRequests,
  subscribeToAppointmentRequest,
  type AppointmentRequest,
} from '../../../services/appointmentRequests';
import { useClientAppointmentRequestCancel } from '../../../hooks/useClientAppointmentRequestCancel';
import {
  cancelAppointment,
  getActiveClientAppointments,
  type ActiveClientAppointment,
} from '../../../services/appointments';
import { useAppointmentRescheduleActions } from '../../../hooks/useAppointmentRescheduleActions';
import { getHiddenBannerKeys, hideChatBanner } from '../../../services/chatBanners';
import {
  cancelProductIntent,
  getClientProductIntents,
  subscribeToClientProductIntentsForBusiness,
} from '../../../services/productIntents';
import type {
  Business,
  ProductIntentWithProduct,
} from '../../../types/database';
import {
  formatMessageDateLabel,
  formatMessageTime,
  isCatalogShare,
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
  const autoSentRef = useRef(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const chat = useChatMessaging({
    role: 'client',
    clientId,
    businessId,
    profileId: profile?.id,
    initialText: prefill,
  });
  const {
    scrollRef,
    messages,
    setMessages,
    text,
    setText,
    sending,
    pendingImage,
    setPendingImage,
    viewingImage,
    setViewingImage,
    showAttach,
    setShowAttach,
    handleCamera,
    handleGallery,
    handleSend,
  } = chat;

  // Banner de solicitud de cita -- lista, no un solo valor: el cliente
  // puede tener más de una solicitud pendiente a la vez con el mismo
  // negocio (ej. pidió cita para 2 servicios distintos).
  const [appointmentRequests, setAppointmentRequests] = useState<
    AppointmentRequest[]
  >([]);
  const { cancellingRequestId, cancelRequest } = useClientAppointmentRequestCancel<AppointmentRequest>(setAppointmentRequests);

  // Citas ya con fecha (confirmed/scheduled) -- a diferencia de
  // appointmentRequests (solicitudes sin resolver), esto es la cita real,
  // creada cuando el negocio acepta o agenda desde una cotización. Antes de
  // esto desaparecía del chat en cuanto se confirmaba, sin forma de
  // reagendar sin salir a "Mis citas".
  const [appointments, setAppointments] = useState<ActiveClientAppointment[]>([]);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const rescheduleActions = useAppointmentRescheduleActions('client', (id, patch) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  });

  // Banner de apartados de producto pendientes/confirmados
  const [productIntents, setProductIntents] = useState<
    ProductIntentWithProduct[]
  >([]);
  const [cancellingIntentId, setCancellingIntentId] = useState<string | null>(
    null,
  );

  // IDs de banners que el usuario cerró con la (X) -- solo oculta la tarjeta
  // de la vista, no cancela nada. Respaldado por hidden_chat_banners (ver
  // services/chatBanners.ts): antes era estado local puro y volvía a
  // mostrar todo al reabrir el chat.
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
    new Set(),
  );
  function dismissBanner(key: string) {
    setDismissedBanners((prev) => new Set(prev).add(key));
    if (businessId && clientId) {
      hideChatBanner(businessId, clientId, key, 'client').catch((err) =>
        console.error('hide chat banner error', err),
      );
    }
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
          getActiveAppointmentRequests(
            thread.clientId,
            thread.businessId,
          ).then(setAppointmentRequests),
          getActiveClientAppointments(thread.businessId, thread.clientId).then(setAppointments),
          loadProductIntents(thread.clientId, thread.businessId),
          getHiddenBannerKeys(thread.businessId, thread.clientId, 'client').then(setDismissedBanners),
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
        setAppointmentRequests((prev) => {
          if (req.status === 'pending') {
            return prev.some((r) => r.id === req.id)
              ? prev.map((r) => (r.id === req.id ? req : r))
              : [...prev, req];
          }
          return prev.filter((r) => r.id !== req.id);
        });
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

  function handleCancelAppointment(appointmentId: string) {
    if (cancellingAppointmentId) return;
    Alert.alert('Cancelar cita', '¿Seguro que quieres cancelar esta cita?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingAppointmentId(appointmentId);
          try {
            await cancelAppointment(appointmentId, 'client');
            setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
            rescheduleActions.cancelRescheduling();
          } catch (err) {
            console.error('cancel appointment error', err);
            Alert.alert('Error', 'No se pudo cancelar la cita.');
          } finally {
            setCancellingAppointmentId(null);
          }
        },
      },
    ]);
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

  const hasBanner =
    appointmentRequests.some((r) => !dismissedBanners.has(`req:${r.id}`)) ||
    appointments.some((a) => !dismissedBanners.has(`appt:${a.id}`)) ||
    productIntents.some((i) => !dismissedBanners.has(`intent:${i.id}`));

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
        {hasBanner && (
        <View style={[styles.bannerScroll, styles.bannerScrollContent]}>
        {/* Banner: solicitudes de cita pendientes (lado cliente) -- puede haber
            más de una a la vez con el mismo negocio. */}
        {appointmentRequests
          .filter((request) => !dismissedBanners.has(`req:${request.id}`))
          .map((request) => (
            <View key={request.id} style={styles.requestBanner}>
              <Pressable
                style={styles.dismissBannerBtn}
                onPress={() => dismissBanner(`req:${request.id}`)}
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
                  {request.service_name ? (
                    <Text style={styles.requestBannerSub} numberOfLines={1}>
                      {request.service_name}
                      {request.suggested_at
                        ? ` · ${new Date(request.suggested_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}`
                        : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={styles.cancelRequestBtn}
                onPress={() => cancelRequest(request)}
                disabled={cancellingRequestId !== null}
              >
                {cancellingRequestId === request.id ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.cancelRequestBtnText}>Cancelar</Text>
                )}
              </Pressable>
            </View>
          ))}

        {/* Banner: citas ya con fecha (confirmed/scheduled) -- 'confirmed':
            dar la posibilidad de reagendar/cancelar sin salir del chat.
            'scheduled': si propuso el taller, le toca al cliente aprobar/
            contraproponer/cancelar; si propuso el cliente, solo queda
            esperar o cancelar. */}
        {appointments
          .filter((appt) => !dismissedBanners.has(`appt:${appt.id}`))
          .map((appt) => {
            const isRescheduling = rescheduleActions.reschedulingId === appt.id;
            const businessProposed = appt.status === 'scheduled' && appt.proposed_by === 'business';
            const clientProposed = appt.status === 'scheduled' && appt.proposed_by === 'client';
            return (
              <View key={appt.id} style={styles.apptCard}>
                <View style={styles.apptCardTopRow}>
                  <Pressable
                    style={styles.dismissBannerBtn}
                    onPress={() => dismissBanner(`appt:${appt.id}`)}
                  >
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                  <View style={styles.requestBannerInfo}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <View style={styles.requestBannerText}>
                      <Text style={styles.requestBannerTitle}>
                        {appt.status === 'confirmed' ? 'Cita confirmada' : businessProposed ? 'El taller propone reagendar' : 'Propusiste reagendar'}
                      </Text>
                      <Text style={styles.requestBannerSub} numberOfLines={1}>
                        {appt.service_name ? `${appt.service_name} · ` : ''}
                        {appt.requested_at
                          ? new Date(appt.requested_at).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
                          : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                {!isRescheduling && (
                  <View style={styles.apptActions}>
                    {appt.status === 'confirmed' && (
                      <>
                        <Pressable
                          style={[styles.apptBtn, styles.apptBtnDanger]}
                          onPress={() => handleCancelAppointment(appt.id)}
                          disabled={cancellingAppointmentId === appt.id}
                        >
                          <Text style={[styles.apptBtnText, styles.apptBtnTextDanger]}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.apptBtn, styles.apptBtnNeutral]}
                          onPress={() => rescheduleActions.startRescheduling(appt.id)}
                        >
                          <Text style={[styles.apptBtnText, styles.apptBtnTextNeutral]}>Proponer otro horario</Text>
                        </Pressable>
                      </>
                    )}
                    {businessProposed && (
                      <>
                        <Pressable
                          style={[styles.apptBtn, styles.apptBtnDanger]}
                          onPress={() => handleCancelAppointment(appt.id)}
                          disabled={cancellingAppointmentId === appt.id}
                        >
                          <Text style={[styles.apptBtnText, styles.apptBtnTextDanger]}>Cancelar</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.apptBtn, styles.apptBtnNeutral]}
                          onPress={() => rescheduleActions.startRescheduling(appt.id)}
                        >
                          <Text style={[styles.apptBtnText, styles.apptBtnTextNeutral]}>Proponer otra</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.apptBtn, styles.apptBtnPrimary]}
                          onPress={() => rescheduleActions.approve(appt.id)}
                          disabled={rescheduleActions.approvingId === appt.id}
                        >
                          {rescheduleActions.approvingId === appt.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.apptBtnText}>Aprobar</Text>
                          )}
                        </Pressable>
                      </>
                    )}
                    {clientProposed && (
                      <Pressable
                        style={[styles.apptBtn, styles.apptBtnDanger]}
                        onPress={() => handleCancelAppointment(appt.id)}
                        disabled={cancellingAppointmentId === appt.id}
                      >
                        <Text style={[styles.apptBtnText, styles.apptBtnTextDanger]}>Cancelar cita</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {isRescheduling && (
                  <View style={styles.apptRescheduleForm}>
                    <Text style={styles.apptFieldLabel}>Fecha</Text>
                    <Pressable
                      style={styles.apptPickerBtn}
                      onPress={() => {
                        rescheduleActions.setShowDatePicker((v) => !v);
                        rescheduleActions.setShowTimePicker(false);
                      }}
                    >
                      <Text style={styles.apptPickerBtnText}>
                        {rescheduleActions.pickerDate.toLocaleDateString('es-EC', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </Pressable>
                    {rescheduleActions.showDatePicker && (
                      <DateTimePicker
                        value={rescheduleActions.pickerDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                        minimumDate={new Date()}
                        onChange={rescheduleActions.handleDateChange}
                      />
                    )}

                    <Text style={styles.apptFieldLabel}>Hora</Text>
                    <Pressable
                      style={styles.apptPickerBtn}
                      onPress={() => {
                        rescheduleActions.setShowTimePicker((v) => !v);
                        rescheduleActions.setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.apptPickerBtnText}>
                        {rescheduleActions.pickerTime.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                    {rescheduleActions.showTimePicker && (
                      <DateTimePicker
                        value={rescheduleActions.pickerTime}
                        mode="time"
                        display="spinner"
                        onChange={rescheduleActions.handleTimeChange}
                      />
                    )}

                    <View style={styles.apptActions}>
                      <Pressable
                        style={[styles.apptBtn, styles.apptBtnNeutral]}
                        onPress={rescheduleActions.cancelRescheduling}
                        disabled={rescheduleActions.saving}
                      >
                        <Text style={[styles.apptBtnText, styles.apptBtnTextNeutral]}>Volver</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.apptBtn, styles.apptBtnPrimary]}
                        onPress={() => rescheduleActions.confirmReschedule(appt.id)}
                        disabled={rescheduleActions.saving}
                      >
                        {rescheduleActions.saving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.apptBtnText}>Enviar propuesta</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

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
        </View>
        )}

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
                          {quote.kind === 'product' ? 'Cotización de producto' : 'Cotización del taller'}
                        </Text>
                      </View>
                      <Text style={styles.quoteService}>{quote.service}</Text>
                      <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>Precio:</Text>
                        <Text style={styles.quoteValue}>{quote.price}</Text>
                      </View>
                      <View style={styles.quoteRow}>
                        <Text style={styles.quoteLabel}>
                          {quote.kind === 'product' ? 'Cantidad:' : 'Tiempo est.:'}
                        </Text>
                        <Text style={styles.quoteValue}>{quote.time}</Text>
                      </View>
                    </View>
                  ) : isCatalogShare(message.body) ? (
                    <Pressable
                      style={[
                        styles.quoteCard,
                        isMine ? styles.quoteCardMine : styles.quoteCardTheirs,
                      ]}
                      onPress={() => businessId && router.push(`/(client)/negocio-catalogo/${businessId}`)}
                    >
                      <View style={styles.quoteHeader}>
                        <Ionicons name="grid-outline" size={14} color={colors.primary} />
                        <Text style={styles.quoteTitle}>Catálogo del negocio</Text>
                      </View>
                      <Text style={styles.quoteService}>Toca para ver todos los productos y servicios</Text>
                    </Pressable>
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
              <>
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
                <View style={styles.attachLabels} pointerEvents="none">
                  <Text style={styles.attachLabelText}>Cámara</Text>
                  <Text style={styles.attachLabelText}>Galería</Text>
                </View>
              </>
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
            maxLength={4000}
          />
          <Pressable
            style={styles.sendButton}
            onPress={() => handleSend()}
            disabled={(!text.trim() && !pendingImage) || sending}
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
  // Sin tope de alto a propósito -- si hay varios banners a la vez crece
  // natural y puede tapar el resto del chat, el usuario los cierra con la X.
  bannerScroll: {},
  bannerScrollContent: {},
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
  // Citas confirmed/scheduled necesitan hasta 3 botones (Cancelar/Proponer
  // otra/Aprobar) + un formulario de fecha -- no entran en la fila de una
  // sola línea que usa requestBanner, por eso usan un layout de tarjeta
  // (info arriba, acciones debajo) en vez del banner angosto.
  apptCard: {
    backgroundColor: '#EEF4FF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  apptCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  apptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  apptBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  apptBtnPrimary: {
    backgroundColor: colors.primary,
  },
  apptBtnNeutral: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  apptBtnDanger: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  apptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  apptBtnTextNeutral: {
    color: colors.text,
  },
  apptBtnTextDanger: {
    color: colors.danger,
  },
  apptRescheduleForm: {
    gap: 4,
  },
  apptFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 2,
  },
  apptPickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  apptPickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
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
    marginTop: 3,
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
  attachLabels: {
    position: 'absolute',
    bottom: 38,
    left: 44,
    paddingVertical: 2,
    zIndex: 10,
  },
  attachLabelText: {
    height: 36,
    lineHeight: 36,
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
