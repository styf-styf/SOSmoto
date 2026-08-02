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
import { QuantityStepper } from '../../../components/QuantityStepper';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useChatMessaging } from '../../../hooks/useChatMessaging';
import { useProductIntentAction } from '../../../hooks/useProductIntentAction';
import { getMyWorkBusiness } from '../../../services/businesses';
import { getActiveProducts, getActiveServices, getProductVariants } from '../../../services/catalog';
import { getMyEmployeeRecord } from '../../../services/employees';
import { supabase } from '../../../services/supabase';
import { getMessages, markThreadRead } from '../../../services/messages';
import {
  createProductIntentByBusiness,
  getActionableIntentsForBusinessClient,
  subscribeToProductIntentCancelled,
} from '../../../services/productIntents';
import {
  getActiveAppointmentRequests,
  subscribeToAppointmentRequest,
  type AppointmentRequest,
} from '../../../services/appointmentRequests';
import { useBusinessAppointmentRequestActions } from '../../../hooks/useBusinessAppointmentRequestActions';
import { getUserById } from '../../../services/users';
import type {
  BusinessType,
  Product,
  ProductIntentWithProduct,
  ProductVariant,
  Service,
  User,
} from '../../../types/database';
import {
  encodeQuote,
  formatMessageDateLabel,
  formatMessageTime,
  parseQuote,
  shouldShowDateSeparator,
} from '../../../utils/chatFormat';

const QUICK_REPLIES_WORKSHOP = [
  'En camino',
  '¿Cuál es tu dirección exacta?',
  '¿Cuál es el problema específico?',
  'Llegamos en 15 minutos',
  'Ya estamos disponibles',
  'El presupuesto es $',
];

// Tienda no hace auxilio en carretera ni recibe citas -- respuestas propias
// de venta de producto en vez de las de un taller yendo hacia el cliente.
const QUICK_REPLIES_STORE = [
  'Sí, tenemos stock',
  '¿Qué cantidad necesitas?',
  'Está disponible para retiro',
  'Podemos enviarlo a tu dirección',
  'El precio es $',
  'Gracias por tu compra',
];

export default function ChatScreen() {
  const { id, initialMessage, prefill, sellerBusinessId } =
    useLocalSearchParams<{
      id: string;
      initialMessage?: string;
      prefill?: string;
      sellerBusinessId?: string;
    }>();
  const isBuyerMode = !!sellerBusinessId;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [clientId, setClientId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const isStore = businessType === 'store';
  const quickReplies = isStore ? QUICK_REPLIES_STORE : QUICK_REPLIES_WORKSHOP;
  const [isLimited, setIsLimited] = useState(false);
  const [canReplyChat, setCanReplyChat] = useState(true);
  const [client, setClient] = useState<User | null>(null);
  const [otherBusiness, setOtherBusiness] = useState<{
    name: string;
    logo_url: string | null;
    is_verified: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  // Cotización = el negocio "eligiendo" un producto/servicio como si fuera
  // el cliente, pero del lado del negocio -- por eso sale del catálogo ya
  // publicado (getActiveServices/getActiveProducts), nunca texto libre.
  const [quoteCatalogKind, setQuoteCatalogKind] = useState<'service' | 'product'>('service');
  const [quoteServices, setQuoteServices] = useState<Service[]>([]);
  const [quoteProducts, setQuoteProducts] = useState<Product[]>([]);
  const [quoteCatalogLoaded, setQuoteCatalogLoaded] = useState(false);
  const [loadingQuoteCatalog, setLoadingQuoteCatalog] = useState(false);
  const [selectedQuoteService, setSelectedQuoteService] = useState<Service | null>(null);
  const [selectedQuoteProduct, setSelectedQuoteProduct] = useState<Product | null>(null);
  const [quoteVariants, setQuoteVariants] = useState<ProductVariant[]>([]);
  const [selectedQuoteVariantId, setSelectedQuoteVariantId] = useState<string | null>(null);
  const [quoteQuantity, setQuoteQuantity] = useState(1);
  const [quoteTime, setQuoteTime] = useState('');
  // Prompt "¿Ya lo hacemos?" que aparece justo después de mandar una
  // cotización -- solo del lado del negocio, el cliente nunca lo ve (no es
  // un mensaje de chat, vive únicamente en este estado local). Se pierde si
  // se cierra y reabre el chat sin actuarlo -- aceptable, es un atajo, la
  // cotización sigue en el historial de mensajes para apartar/agendar
  // manualmente después si hace falta.
  const [pendingQuoteAction, setPendingQuoteAction] = useState<
    | { kind: 'product'; label: string; productId: string; variantId: string | null; quantity: number; unitPrice: number | null }
    | { kind: 'service'; label: string; serviceId: string }
    | null
  >(null);
  const [creatingQuoteIntent, setCreatingQuoteIntent] = useState(false);
  const [intents, setIntents] = useState<ProductIntentWithProduct[]>([]);
  const { processingId: processingIntent, handleAction: handleIntentAction } = useProductIntentAction(setIntents);

  // Avisos de cancelación (apartado o cita cancelados por el cliente en
  // vivo) -- reemplazan el mensaje automático que antes se mandaba al chat;
  // solo viven en memoria mientras el chat está abierto, con su propia (X).
  const [cancelledBanners, setCancelledBanners] = useState<
    { key: string; label: string }[]
  >([]);

  // Solicitudes de cita pendientes -- lista, no un solo valor: el cliente
  // puede tener más de una solicitud pendiente a la vez con este negocio
  // (ej. pidió cita para 2 servicios distintos antes de que el negocio
  // respondiera). Antes con un solo valor la segunda sobrescribía a la
  // primera en la suscripción en tiempo real, y al aceptar/rechazar se
  // perdía por completo hasta cerrar y volver a abrir el chat.
  const [appointmentRequests, setAppointmentRequests] = useState<
    AppointmentRequest[]
  >([]);
  const requestActions = useBusinessAppointmentRequestActions<AppointmentRequest>(setAppointmentRequests);
  const approvingRequest =
    appointmentRequests.find((r) => r.id === requestActions.approvingRequestId) ?? null;

  const chat = useChatMessaging({
    role: 'business',
    clientId,
    businessId,
    profileId: profile?.id,
    initialText: prefill,
    onImagePicked: () => {
      setShowQuickReplies(false);
      closeQuoteForm();
      requestActions.cancelApproveForm();
    },
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

  // IDs de banners que el negocio cerró con la (X) -- solo oculta la tarjeta
  // de la vista, no confirma ni cancela nada; se resetea si se recarga el chat.
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(
    new Set(),
  );
  function dismissBanner(key: string) {
    setDismissedBanners((prev) => new Set(prev).add(key));
  }

  const resolveThread = useCallback(async () => {
    if (!profile || !id) return null;
    if (profile.role === 'client') {
      return {
        clientId: profile.id,
        businessId: id,
        businessType: null as BusinessType | null,
        isLimited: false,
        canReplyChat: true,
      };
    }
    if (sellerBusinessId) {
      // Estoy comprando como negocio (ej. taller apartando un producto de
      // otra tienda) -- yo soy el lado "cliente" de este hilo específico,
      // no el dueño del negocio destino.
      return {
        clientId: profile.id,
        businessId: sellerBusinessId,
        businessType: null as BusinessType | null,
        isLimited: false,
        canReplyChat: true,
      };
    }
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return null;
    const employeeRecord = work.isOwner
      ? null
      : await getMyEmployeeRecord(work.business.id, profile.id);
    return {
      clientId: id,
      businessId: work.business.id,
      businessType: work.business.business_type,
      isLimited: work.business.is_limited,
      canReplyChat: work.isOwner || (employeeRecord?.can_reply_chat ?? false),
    };
  }, [profile, id, sellerBusinessId]);

  useEffect(() => {
    setLoading(true);
    resolveThread()
      .then(async (thread) => {
        if (!thread) return;
        setClientId(thread.clientId);
        setBusinessId(thread.businessId);
        setBusinessType(thread.businessType);
        setIsLimited(thread.isLimited);
        setCanReplyChat(thread.canReplyChat);

        if (isBuyerMode) {
          // Estoy comprando como negocio: no hay acciones de vendedor (confirmar
          // apartado, aprobar cita) que mostrar en este hilo, y el "otro lado"
          // es directamente el negocio destino, no un cliente mío.
          const [history] = await Promise.all([
            getMessages(thread.clientId, thread.businessId),
            supabase
              .from('businesses_public')
              .select('name, logo_url, is_verified')
              .eq('id', thread.businessId)
              .maybeSingle()
              .then(
                ({
                  data,
                }: {
                  data: {
                    name: string;
                    logo_url: string | null;
                    is_verified: boolean;
                  } | null;
                }) => {
                  if (data) setOtherBusiness(data);
                },
                () => {},
              ),
          ]);
          setMessages(history);
          if (profile) {
            await markThreadRead(
              thread.clientId,
              thread.businessId,
              profile.id,
            );
          }
          return;
        }

        const [history, , , activeRequests] = await Promise.all([
          getMessages(thread.clientId, thread.businessId),
          getUserById(thread.clientId).then(setClient),
          getActionableIntentsForBusinessClient(
            thread.businessId,
            thread.clientId,
          ).then(setIntents),
          getActiveAppointmentRequests(thread.clientId, thread.businessId),
        ]);
        // Si el interlocutor es propietario de un negocio (chat B2B), cargamos
        // el negocio para mostrar su nombre y logo en el header en lugar de los
        // datos personales del usuario.
        supabase
          .rpc('resolve_owned_businesses', { target_ids: [thread.clientId] })
          .then(
            ({ data }) => {
              const business = data?.[0];
              if (business) {
                setOtherBusiness({
                  name: business.name,
                  logo_url: business.logo_url,
                  is_verified: business.is_verified,
                });
              }
            },
            () => {},
          );
        setMessages(history);
        setAppointmentRequests(activeRequests);
        if (profile) {
          await markThreadRead(thread.clientId, thread.businessId, profile.id);
        }
      })
      .catch((err) => console.error('load chat error', err))
      .finally(() => setLoading(false));
  }, [resolveThread]);

  // Auto-envío del mensaje inicial -- solo para "Reservar producto" (initialMessage).
  // El botón "Chatear" usa `prefill` en cambio: solo llena el input de texto,
  // el usuario decide si lo envía.
  const initialSentRef = useRef(false);
  useEffect(() => {
    if (!clientId || !businessId || !initialMessage || initialSentRef.current)
      return;
    if (messages.length > 0) return; // hilo existente: no duplicar
    initialSentRef.current = true;
    handleSend(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, businessId, messages.length]);

  // Suscripción a cambios en la solicitud de cita (no aplica cuando compro como negocio)
  useEffect(() => {
    if (!clientId || !businessId || isBuyerMode) return;
    const unsubscribe = subscribeToAppointmentRequest(
      clientId,
      businessId,
      'business',
      (req) => {
        if (req.status === 'pending') {
          setAppointmentRequests((prev) =>
            prev.some((r) => r.id === req.id)
              ? prev.map((r) => (r.id === req.id ? req : r))
              : [...prev, req],
          );
        } else {
          setAppointmentRequests((prev) => prev.filter((r) => r.id !== req.id));
          requestActions.resetIfApproving(req.id);
          if (req.status === 'cancelled') {
            const key = `cancelledreq:${req.id}`;
            setCancelledBanners((prev) =>
              prev.some((b) => b.key === key)
                ? prev
                : [...prev, { key, label: req.service_name ?? 'la cita' }],
            );
          }
        }
      },
    );
    return unsubscribe;
  }, [clientId, businessId]);

  // Suscripción a cancelaciones de apartados de producto (no aplica cuando
  // compro como negocio, mismo motivo que la suscripción de citas de arriba).
  useEffect(() => {
    if (!clientId || !businessId || isBuyerMode) return;
    const unsubscribe = subscribeToProductIntentCancelled(
      businessId,
      clientId,
      (intentId, label) => {
        setIntents((prev) => prev.filter((i) => i.id !== intentId));
        const key = `cancelledintent:${intentId}`;
        setCancelledBanners((prev) =>
          prev.some((b) => b.key === key) ? prev : [...prev, { key, label }],
        );
      },
    );
    return unsubscribe;
  }, [clientId, businessId, isBuyerMode]);

  // Tienda no tiene servicios -- nunca ofrece la pestaña "Servicio" del
  // buscador de cotización, siempre busca en productos.
  const effectiveQuoteKind = isStore ? 'product' : quoteCatalogKind;
  const selectedQuoteVariant = quoteVariants.find((v) => v.id === selectedQuoteVariantId) ?? null;
  const quoteUnitPrice = selectedQuoteProduct
    ? selectedQuoteVariant?.reference_price ?? selectedQuoteProduct.reference_price
    : selectedQuoteService?.reference_price ?? null;
  const quoteTotalPrice = quoteUnitPrice != null ? quoteUnitPrice * (selectedQuoteProduct ? quoteQuantity : 1) : null;
  const quotePriceLabel = quoteTotalPrice != null ? `$${quoteTotalPrice.toFixed(2)}` : 'A convenir';
  const quoteNeedsVariant = !!selectedQuoteProduct && quoteVariants.length > 0 && !selectedQuoteVariantId;

  function resetQuoteSelection() {
    setSelectedQuoteService(null);
    setSelectedQuoteProduct(null);
    setSelectedQuoteVariantId(null);
    setQuoteVariants([]);
    setQuoteQuantity(1);
    setQuoteTime('');
  }

  function closeQuoteForm() {
    setShowQuoteForm(false);
    resetQuoteSelection();
  }

  // Cierra los paneles que flotan sobre el campo de texto (sugerencias de
  // mensajes, cotización) al tocar fuera de ellos -- no toca el formulario
  // de aprobar cita (approvingRequest), que tiene su propio botón "Volver".
  function dismissFloatingPanels() {
    setShowQuickReplies(false);
    if (showQuoteForm) closeQuoteForm();
  }

  function openApproveForm(request: AppointmentRequest) {
    closeQuoteForm();
    setShowQuickReplies(false);
    requestActions.openApproveForm(request);
  }

  async function openQuoteForm() {
    if (showQuoteForm) {
      closeQuoteForm();
      return;
    }
    setShowAttach(false);
    setShowQuickReplies(false);
    requestActions.cancelApproveForm();
    setShowQuoteForm(true);
    if (quoteCatalogLoaded || !businessId) return;
    setLoadingQuoteCatalog(true);
    try {
      const [services, products] = await Promise.all([
        isStore ? Promise.resolve([]) : getActiveServices(businessId),
        getActiveProducts(businessId),
      ]);
      setQuoteServices(services);
      setQuoteProducts(products);
      setQuoteCatalogLoaded(true);
    } catch (err) {
      console.error('load quote catalog error', err);
    } finally {
      setLoadingQuoteCatalog(false);
    }
  }

  function selectQuoteService(service: Service) {
    setSelectedQuoteService(service);
  }

  async function selectQuoteProduct(product: Product) {
    setSelectedQuoteProduct(product);
    setSelectedQuoteVariantId(null);
    setQuoteQuantity(1);
    try {
      const variants = await getProductVariants(product.id);
      setQuoteVariants(variants);
      if (variants.length > 0) setSelectedQuoteVariantId(variants[0].id);
    } catch (err) {
      console.error('load quote product variants error', err);
    }
  }

  function handleSendQuote() {
    if (quoteNeedsVariant) {
      Alert.alert('Falta la variante', 'Elige una variante del producto.');
      return;
    }
    if (selectedQuoteProduct) {
      const label = selectedQuoteVariant
        ? `${selectedQuoteProduct.name} - ${selectedQuoteVariant.label}`
        : selectedQuoteProduct.name;
      const encoded = encodeQuote({
        kind: 'product',
        service: label,
        price: quotePriceLabel,
        time: String(quoteQuantity),
      });
      handleSend(encoded);
      setPendingQuoteAction({
        kind: 'product',
        label,
        productId: selectedQuoteProduct.id,
        variantId: selectedQuoteVariant?.id ?? null,
        quantity: quoteQuantity,
        unitPrice: quoteUnitPrice,
      });
      closeQuoteForm();
    } else if (selectedQuoteService) {
      const encoded = encodeQuote({
        kind: 'service',
        service: selectedQuoteService.name,
        price: quotePriceLabel,
        time: quoteTime.trim() || 'A definir',
      });
      handleSend(encoded);
      setPendingQuoteAction({
        kind: 'service',
        label: selectedQuoteService.name,
        serviceId: selectedQuoteService.id,
      });
      closeQuoteForm();
    }
  }

  async function handleApartarFromQuote() {
    if (!pendingQuoteAction || pendingQuoteAction.kind !== 'product' || !clientId) return;
    setCreatingQuoteIntent(true);
    try {
      const intent = await createProductIntentByBusiness(
        clientId,
        pendingQuoteAction.productId,
        pendingQuoteAction.variantId,
        pendingQuoteAction.quantity,
      );
      setIntents((prev) => [
        {
          ...intent,
          product_name: pendingQuoteAction.label,
          product_price: pendingQuoteAction.unitPrice,
        },
        ...prev,
      ]);
      setPendingQuoteAction(null);
    } catch (err) {
      console.error('apartar from quote error', err);
      Alert.alert('Error', 'No se pudo apartar el producto. Intenta de nuevo.');
    } finally {
      setCreatingQuoteIntent(false);
    }
  }

  function handleAgendarFromQuote() {
    if (!pendingQuoteAction || pendingQuoteAction.kind !== 'service' || !clientId) return;
    setPendingQuoteAction(null);
    router.push(`/(business)/nueva-cita?clientId=${clientId}&serviceId=${pendingQuoteAction.serviceId}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const hasBanner =
    intents.some((i) => !dismissedBanners.has(`intent:${i.id}`)) ||
    appointmentRequests.some((r) => !dismissedBanners.has(`req:${r.id}`)) ||
    cancelledBanners.length > 0 ||
    !!pendingQuoteAction;
  const approveDateTime = (() => {
    const dt = new Date(requestActions.approvePickerDate);
    dt.setHours(
      requestActions.approvePickerTime.getHours(),
      requestActions.approvePickerTime.getMinutes(),
      0,
      0,
    );
    return dt;
  })();

  return (
    <View style={styles.container}>
      <ImageViewerModal
        uri={viewingImage}
        onClose={() => setViewingImage(null)}
      />
      <ChatHeader
        name={otherBusiness?.name || client?.full_name || 'Cliente'}
        avatarUrl={otherBusiness ? otherBusiness.logo_url : client?.avatar_url}
        fallbackIcon={otherBusiness ? 'storefront' : 'person'}
        isVerified={otherBusiness?.is_verified ?? false}
      />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {hasBanner && (
          <View style={styles.intentsBanner}>
            {/* Banners de solicitudes de cita (lado taller) -- puede haber
                más de una a la vez del mismo cliente. */}
            {appointmentRequests
              .filter((request) => !dismissedBanners.has(`req:${request.id}`))
              .map((request) => (
                <View key={request.id} style={styles.intentCard}>
                  <View style={styles.intentCardTopRow}>
                    <Pressable
                      style={styles.dismissBannerBtn}
                      onPress={() => dismissBanner(`req:${request.id}`)}
                    >
                      <Ionicons
                        name="close"
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    <View style={styles.intentInfo}>
                      <Ionicons
                        name="calendar-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <View style={styles.requestInfo}>
                        <Text style={styles.intentText} numberOfLines={1}>
                          Solicitud de cita:{' '}
                          <Text style={styles.intentName}>
                            {request.service_name ??
                              'Sin servicio especificado'}
                          </Text>
                        </Text>
                        {request.suggested_at ? (
                          <Text style={styles.requestSub}>
                            Fecha sugerida:{' '}
                            {new Date(request.suggested_at).toLocaleString(
                              'es-EC',
                              { dateStyle: 'medium', timeStyle: 'short' },
                            )}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  {requestActions.approvingRequestId !== request.id && (
                    <View style={styles.intentActions}>
                      <Pressable
                        style={[styles.intentBtn, styles.intentBtnConfirm]}
                        onPress={() => openApproveForm(request)}
                        disabled={requestActions.processingRequestId !== null}
                      >
                        <Text style={styles.intentBtnText}>Aceptar</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.intentBtn, styles.intentBtnReject]}
                        onPress={() => requestActions.handleRejectRequest(request)}
                        disabled={requestActions.processingRequestId !== null}
                      >
                        {requestActions.processingRequestId === request.id ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.danger}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.intentBtnText,
                              styles.intentBtnTextReject,
                            ]}
                          >
                            Rechazar
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

            {/* Intents de producto -- 'pending' pide Confirmar/No disponible;
                'confirmed' (ya apartado) pasa a Vendido/Cancelar venta, lo
                mismo que ya hacía el tab Pedidos, ahora también acá para no
                obligar a salir del chat para cerrar la venta. */}
            {intents
              .filter((intent) => !dismissedBanners.has(`intent:${intent.id}`))
              .map((intent) => {
                const isPending = intent.status === 'pending';
                return (
                  <View key={intent.id} style={styles.intentCard}>
                    <View style={styles.intentCardTopRow}>
                      <Pressable
                        style={styles.dismissBannerBtn}
                        onPress={() => dismissBanner(`intent:${intent.id}`)}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={colors.textMuted}
                        />
                      </Pressable>
                      <View style={styles.intentInfo}>
                        <Ionicons
                          name="cube-outline"
                          size={16}
                          color={colors.primary}
                        />
                        <Text style={styles.intentText} numberOfLines={1}>
                          {isPending ? 'Quiere apartar:' : 'Apartado:'}{' '}
                          <Text style={styles.intentName}>
                            {intent.quantity > 1 ? `${intent.quantity} × ` : ''}
                            {intent.product_name}
                          </Text>
                          {intent.product_price != null
                            ? ` · $${(intent.product_price * intent.quantity).toFixed(2)}`
                            : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.intentActions}>
                      {isPending ? (
                        <>
                          <Pressable
                            style={[styles.intentBtn, styles.intentBtnConfirm]}
                            onPress={() => handleIntentAction(intent.id, 'confirmed')}
                            disabled={processingIntent === intent.id}
                          >
                            {processingIntent === intent.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.intentBtnText}>
                                Confirmar apartado
                              </Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={[styles.intentBtn, styles.intentBtnReject]}
                            onPress={() =>
                              handleIntentAction(intent.id, 'unavailable')
                            }
                            disabled={processingIntent === intent.id}
                          >
                            <Text
                              style={[
                                styles.intentBtnText,
                                styles.intentBtnTextReject,
                              ]}
                            >
                              No disponible
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <Pressable
                            style={[styles.intentBtn, styles.intentBtnConfirm]}
                            onPress={() => handleIntentAction(intent.id, 'sold')}
                            disabled={processingIntent === intent.id}
                          >
                            {processingIntent === intent.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.intentBtnText}>Vendido</Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={[styles.intentBtn, styles.intentBtnReject]}
                            onPress={() =>
                              handleIntentAction(intent.id, 'cancelled_no_show')
                            }
                            disabled={processingIntent === intent.id}
                          >
                            <Text
                              style={[
                                styles.intentBtnText,
                                styles.intentBtnTextReject,
                              ]}
                            >
                              Cancelar venta
                            </Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}

            {/* Cotización recién enviada -- solo el negocio ve este banner,
                el cliente nunca lo recibe (no es un mensaje). "Apartar" crea
                de una vez un product_intent 'confirmed' (el negocio decide,
                no hace falta que el cliente conteste primero); "Agendar"
                abre Nueva Cita precargada con cliente + servicio. */}
            {pendingQuoteAction && (
              <View style={styles.intentCard}>
                <View style={styles.intentCardTopRow}>
                  <Pressable
                    style={styles.dismissBannerBtn}
                    onPress={() => setPendingQuoteAction(null)}
                  >
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                  <View style={styles.intentInfo}>
                    <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                    <Text style={styles.intentText} numberOfLines={1}>
                      Cotización enviada:{' '}
                      <Text style={styles.intentName}>{pendingQuoteAction.label}</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.intentActions}>
                  {pendingQuoteAction.kind === 'product' ? (
                    <Pressable
                      style={[styles.intentBtn, styles.intentBtnConfirm]}
                      onPress={handleApartarFromQuote}
                      disabled={creatingQuoteIntent}
                    >
                      {creatingQuoteIntent ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.intentBtnText}>Apartar</Text>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.intentBtn, styles.intentBtnConfirm]}
                      onPress={handleAgendarFromQuote}
                    >
                      <Text style={styles.intentBtnText}>Agendar</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.intentBtn, styles.intentBtnReject]}
                    onPress={() => setPendingQuoteAction(null)}
                    disabled={creatingQuoteIntent}
                  >
                    <Text style={[styles.intentBtnText, styles.intentBtnTextReject]}>
                      Cancelar
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Apartados/citas que el cliente canceló en vivo */}
            {cancelledBanners.map((banner) => (
              <View key={banner.key} style={styles.intentCard}>
                <View style={styles.intentCardTopRow}>
                  <Pressable
                    style={styles.dismissBannerBtn}
                    onPress={() =>
                      setCancelledBanners((prev) =>
                        prev.filter((b) => b.key !== banner.key),
                      )
                    }
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  <View style={styles.intentInfo}>
                    <Ionicons
                      name="close-circle-outline"
                      size={16}
                      color={colors.danger}
                    />
                    <Text style={styles.intentText} numberOfLines={1}>
                      Cancelado:{' '}
                      <Text style={styles.intentName}>{banner.label}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.flex} onPress={dismissFloatingPanels}>
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
                          {quote.kind === 'product' ? 'Cotización de producto' : 'Cotización'}
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
        </Pressable>

        {isLimited || !canReplyChat ? (
          <View style={styles.limitedNotice}>
            <Text style={styles.limitedNoticeText}>
              {isLimited
                ? 'Tu negocio está limitado: no puedes enviar mensajes.'
                : 'No tienes permiso para responder chats en este negocio.'}
            </Text>
          </View>
        ) : (
          <>
            {showQuickReplies && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickRepliesRow}
              >
                {quickReplies.map((reply) => (
                  <Pressable
                    key={reply}
                    style={styles.quickReplyChip}
                    onPress={() => {
                      setText(reply);
                      setShowQuickReplies(false);
                    }}
                  >
                    <Text style={styles.quickReplyText}>{reply}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {showQuoteForm && (
              <View style={styles.quoteForm}>
                <View style={styles.quoteFormHeaderRow}>
                  <Text style={styles.quoteFormTitle}>
                    {selectedQuoteProduct || selectedQuoteService ? 'Nueva cotización' : 'Elige qué cotizar'}
                  </Text>
                  <Pressable onPress={closeQuoteForm} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>

                {!selectedQuoteProduct && !selectedQuoteService ? (
                  <>
                    {!isStore && (
                      <View style={styles.quoteKindToggleRow}>
                        <Pressable
                          style={[styles.quoteKindToggle, effectiveQuoteKind === 'service' && styles.quoteKindToggleSelected]}
                          onPress={() => setQuoteCatalogKind('service')}
                        >
                          <Text
                            style={[
                              styles.quoteKindToggleText,
                              effectiveQuoteKind === 'service' && styles.quoteKindToggleTextSelected,
                            ]}
                          >
                            Servicio
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.quoteKindToggle, effectiveQuoteKind === 'product' && styles.quoteKindToggleSelected]}
                          onPress={() => setQuoteCatalogKind('product')}
                        >
                          <Text
                            style={[
                              styles.quoteKindToggleText,
                              effectiveQuoteKind === 'product' && styles.quoteKindToggleTextSelected,
                            ]}
                          >
                            Producto
                          </Text>
                        </Pressable>
                      </View>
                    )}
                    {loadingQuoteCatalog ? (
                      <ActivityIndicator color={colors.primary} style={styles.quoteCatalogSpinner} />
                    ) : (
                      <ScrollView style={styles.quoteCatalogList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {(effectiveQuoteKind === 'product' ? quoteProducts : quoteServices).length === 0 ? (
                          <Text style={styles.quoteEmptyText}>
                            No tienes {effectiveQuoteKind === 'product' ? 'productos' : 'servicios'} activos en tu catálogo.
                          </Text>
                        ) : effectiveQuoteKind === 'product' ? (
                          quoteProducts.map((product) => (
                            <Pressable
                              key={product.id}
                              style={styles.quoteCatalogItem}
                              onPress={() => selectQuoteProduct(product)}
                            >
                              <Text style={styles.quoteCatalogItemText} numberOfLines={1}>
                                {product.name}
                              </Text>
                              {product.reference_price != null && (
                                <Text style={styles.quoteCatalogItemPrice}>${product.reference_price.toFixed(2)}</Text>
                              )}
                            </Pressable>
                          ))
                        ) : (
                          quoteServices.map((service) => (
                            <Pressable
                              key={service.id}
                              style={styles.quoteCatalogItem}
                              onPress={() => selectQuoteService(service)}
                            >
                              <Text style={styles.quoteCatalogItemText} numberOfLines={1}>
                                {service.name}
                              </Text>
                              {service.reference_price != null && (
                                <Text style={styles.quoteCatalogItemPrice}>${service.reference_price.toFixed(2)}</Text>
                              )}
                            </Pressable>
                          ))
                        )}
                      </ScrollView>
                    )}
                  </>
                ) : (
                  <>
                    <Pressable style={styles.quoteBackLink} onPress={resetQuoteSelection}>
                      <Ionicons name="chevron-back" size={14} color={colors.primary} />
                      <Text style={styles.quoteBackLinkText}>Elegir otro</Text>
                    </Pressable>

                    <Text style={styles.quoteSelectedName}>
                      {selectedQuoteProduct?.name ?? selectedQuoteService?.name}
                    </Text>

                    {selectedQuoteProduct && quoteVariants.length > 0 && (
                      <View style={styles.variantRow}>
                        {quoteVariants.map((variant) => {
                          const selected = variant.id === selectedQuoteVariantId;
                          return (
                            <Pressable
                              key={variant.id}
                              onPress={() => setSelectedQuoteVariantId(variant.id)}
                              style={[styles.variantChip, selected && styles.variantChipSelected]}
                            >
                              <Text style={[styles.variantChipText, selected && styles.variantChipTextSelected]}>
                                {variant.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}

                    {selectedQuoteProduct ? (
                      <View style={styles.quoteQuantityRow}>
                        <Text style={styles.quoteFieldLabel}>Cantidad</Text>
                        <QuantityStepper value={quoteQuantity} onChange={setQuoteQuantity} />
                      </View>
                    ) : (
                      <TextInput
                        style={styles.quoteInput}
                        placeholder="Tiempo estimado (ej. 2 horas)"
                        placeholderTextColor={colors.textMuted}
                        value={quoteTime}
                        onChangeText={setQuoteTime}
                      />
                    )}

                    <Text style={styles.quotePricePreview}>Precio: {quotePriceLabel}</Text>

                    <View style={styles.quoteFormActions}>
                      <Pressable
                        style={[styles.quoteFormBtn, quoteNeedsVariant && styles.quoteFormBtnDisabled]}
                        onPress={handleSendQuote}
                        disabled={quoteNeedsVariant}
                      >
                        <Text style={styles.quoteFormBtnText}>
                          Enviar cotización
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.quoteFormBtnSecondary}
                        onPress={closeQuoteForm}
                      >
                        <Text style={styles.quoteFormBtnSecondaryText}>
                          Cancelar
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Formulario de confirmación de fecha al aceptar solicitud */}
            {approvingRequest && (
              <View style={styles.approveForm}>
                <Text style={styles.approveFormTitle}>
                  Confirmar fecha de cita
                </Text>
                {approvingRequest.vehicle_label ? (
                  <Text style={styles.approveFormSub}>
                    Moto: {approvingRequest.vehicle_label}
                  </Text>
                ) : null}

                <Text style={styles.approveFieldLabel}>Fecha</Text>
                <Pressable
                  style={styles.approvePickerBtn}
                  onPress={() => {
                    requestActions.setShowApproveDatePicker((v) => !v);
                    requestActions.setShowApproveTimePicker(false);
                  }}
                >
                  <Text style={styles.approvePickerBtnText}>
                    {requestActions.approvePickerDate.toLocaleDateString('es-EC', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </Pressable>
                {requestActions.showApproveDatePicker && (
                  <DateTimePicker
                    value={requestActions.approvePickerDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                    minimumDate={new Date()}
                    onChange={requestActions.handleApproveDateChange}
                  />
                )}

                <Text style={styles.approveFieldLabel}>Hora</Text>
                <Pressable
                  style={styles.approvePickerBtn}
                  onPress={() => {
                    requestActions.setShowApproveTimePicker((v) => !v);
                    requestActions.setShowApproveDatePicker(false);
                  }}
                >
                  <Text style={styles.approvePickerBtnText}>
                    {requestActions.approvePickerTime.toLocaleTimeString('es-EC', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Pressable>
                {requestActions.showApproveTimePicker && (
                  <DateTimePicker
                    value={requestActions.approvePickerTime}
                    mode="time"
                    display="spinner"
                    onChange={requestActions.handleApproveTimeChange}
                  />
                )}

                <Text style={styles.approveHint}>
                  Cita para:{' '}
                  {approveDateTime.toLocaleString('es-EC', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>

                <View style={styles.approveFormActions}>
                  <Pressable
                    style={[
                      styles.approveFormBtn,
                      requestActions.processingRequestId !== null &&
                        styles.approveFormBtnDisabled,
                    ]}
                    onPress={() => requestActions.handleAcceptRequest(approvingRequest, client?.full_name ?? 'Cliente')}
                    disabled={requestActions.processingRequestId !== null}
                  >
                    {requestActions.processingRequestId === approvingRequest.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.approveFormBtnText}>
                        Confirmar cita
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.approveFormBtnSecondary}
                    onPress={requestActions.cancelApproveForm}
                    disabled={requestActions.processingRequestId !== null}
                  >
                    <Text style={styles.approveFormBtnSecondaryText}>
                      Volver
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

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
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.danger}
                  />
                </Pressable>
              </View>
            )}
            <View
              style={[styles.inputRow, { paddingBottom: 8 + insets.bottom }]}
            >
              <View style={{ position: 'relative' }}>
                {showAttach && (
                  <View style={styles.attachBar}>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => {
                        setShowAttach(false);
                        setShowQuickReplies((v) => !v);
                        closeQuoteForm();
                        requestActions.cancelApproveForm();
                      }}
                    >
                      <Ionicons
                        name="flash-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => {
                        setShowAttach(false);
                        setShowQuickReplies(false);
                        requestActions.cancelApproveForm();
                        openQuoteForm();
                      }}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {clientId && !isStore && (
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => {
                          setShowAttach(false);
                          router.push(
                            `/(business)/nueva-cita?clientId=${clientId}`,
                          );
                        }}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    )}
                    <Pressable style={styles.iconButton} onPress={handleCamera}>
                      <Ionicons
                        name="camera-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      style={styles.iconButton}
                      onPress={handleGallery}
                    >
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
                onFocus={dismissFloatingPanels}
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
          </>
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
    gap: 6,
    paddingHorizontal: 10,
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
  quickRepliesRow: {
    flexDirection: 'row',
    // Sin esto los chips se estiran al alto del ScrollView (fila completa)
    // en vez de quedarse en su alto natural (padding + texto) -- mismo
    // síntoma clásico de un ScrollView horizontal sin alignItems propio.
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickReplyChip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickReplyText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  quoteForm: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  quoteFormHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  quoteKindToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quoteKindToggle: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  quoteKindToggleSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  quoteKindToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  quoteKindToggleTextSelected: {
    color: colors.primary,
  },
  quoteCatalogSpinner: {
    marginVertical: 12,
  },
  // Limita el alto para que un catálogo largo no empuje el resto del chat
  // fuera de pantalla -- scrollea internamente, no la pantalla completa.
  quoteCatalogList: {
    maxHeight: 180,
  },
  quoteEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    paddingVertical: 8,
  },
  quoteCatalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quoteCatalogItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  quoteCatalogItemPrice: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  quoteBackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  quoteBackLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  quoteSelectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  variantChipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  variantChipTextSelected: {
    color: colors.primary,
  },
  quoteQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  quotePricePreview: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  quoteInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  quoteFormActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quoteFormBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quoteFormBtnDisabled: {
    opacity: 0.5,
  },
  quoteFormBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  quoteFormBtnSecondary: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quoteFormBtnSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  approveForm: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#F0F7FF',
    gap: 4,
  },
  approveFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  approveFormSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  approveFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 4,
  },
  approvePickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  approvePickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  approveHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4,
  },
  approveFormActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  approveFormBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveFormBtnDisabled: {
    opacity: 0.6,
  },
  approveFormBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  approveFormBtnSecondary: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  approveFormBtnSecondaryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
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
  intentCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  dismissBannerBtn: {
    padding: 2,
  },
  intentInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestSub: {
    fontSize: 11,
    color: colors.textMuted,
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
    borderColor: colors.danger,
  },
  intentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  intentBtnTextReject: {
    color: colors.danger,
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
