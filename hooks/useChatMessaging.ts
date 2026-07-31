import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, ScrollView } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { markThreadRead, sendMessage, subscribeToMessages } from '../services/messages';
import { pickImageFromCamera, pickImageFromLibrary, uploadChatImage } from '../services/storage';
import type { Message } from '../types/database';

// El motor de "enviar/recibir mensajes" (enviar con imagen opcional y
// reconciliación optimista, suscripción en tiempo real, auto-scroll,
// scroll al abrir el teclado) estaba reimplementado casi idéntico en
// chat/[id].tsx de cliente y de negocio -- cada pantalla conserva sus
// propios banners/permisos/cotizaciones, solo el núcleo de mensajería vive
// acá. role determina la columna de filtro de la suscripción realtime (el
// cliente escucha por client_id, el negocio por business_id) y a qué id
// del mensaje entrante comparar para saber si pertenece a este hilo.
export function useChatMessaging(params: {
  role: 'client' | 'business';
  clientId: string | null;
  businessId: string | null;
  profileId: string | undefined;
  initialText?: string;
  // El lado negocio cierra otros paneles (respuestas rápidas, cotización,
  // formulario de aprobar cita) cuando el usuario elige una foto -- el
  // cliente no tiene esos paneles, así que no pasa nada acá.
  onImagePicked?: () => void;
}) {
  const { role, clientId, businessId, profileId, initialText, onImagePicked } = params;
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState(initialText ?? '');
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<ImagePickerAsset | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);

  useEffect(() => {
    if (!businessId || !clientId) return;
    const filterColumn = role === 'client' ? 'client_id' : 'business_id';
    const filterValue = role === 'client' ? clientId : businessId;
    const unsubscribe = subscribeToMessages(filterColumn, filterValue, (message) => {
      const belongsToThread =
        role === 'client' ? message.business_id === businessId : message.client_id === clientId;
      if (!belongsToThread) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        // Los mensajes propios enviados por handleSend ya se agregaron optimistic
        // (con un id temp_*) y se reconcilian ahí mismo -- si el realtime los
        // agregara también, saldrían duplicados mientras dura esa reconciliación.
        // Pero mensajes propios generados por otro lado (aceptar/rechazar una
        // solicitud de cita, cancelar un apartado, que insertan directo en
        // `messages` sin pasar por handleSend) nunca tienen esa entrada temp --
        // filtrarlos siempre por sender_id hacía que ese mensaje no apareciera
        // hasta reabrir la app. Solo se ignora si hay un envío propio pendiente.
        const hasPendingOwnSend = message.sender_id === profileId && prev.some((m) => m.id.startsWith('temp_'));
        if (hasPendingOwnSend) return prev;
        return [...prev, message];
      });
      if (profileId && message.sender_id !== profileId) {
        markThreadRead(clientId, businessId, profileId).catch((err) =>
          console.error('mark thread read error', err)
        );
      }
    });
    return unsubscribe;
  }, [businessId, clientId, profileId, role]);

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
      if (asset) {
        setPendingImage(asset);
        onImagePicked?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Error', msg || 'No se pudo acceder a la cámara.');
    }
  }

  async function handleGallery() {
    setShowAttach(false);
    try {
      const asset = await pickImageFromLibrary(null);
      if (asset) {
        setPendingImage(asset);
        onImagePicked?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      Alert.alert('Error', msg || 'No se pudo acceder a la galería.');
    }
  }

  async function handleSend(overrideBody?: string) {
    const body = overrideBody ?? text.trim();
    if (!profileId || !clientId || !businessId || sending) return;
    if (!body && !pendingImage && !overrideBody) return;
    setSending(true);
    if (!overrideBody) setText('');
    const imageToSend = overrideBody ? null : pendingImage;
    if (imageToSend) setPendingImage(null);

    const tempId = `temp_${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      client_id: clientId,
      business_id: businessId,
      sender_id: profileId,
      body,
      image_url: imageToSend ? imageToSend.uri : null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      let imageUrl: string | undefined;
      if (imageToSend) {
        imageUrl = await uploadChatImage(imageToSend, profileId, businessId, clientId);
      }
      const message = await sendMessage({
        clientId,
        businessId,
        senderId: profileId,
        body,
        imageUrl,
      });
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === message.id) ? without : [...without, message];
      });
    } catch (err) {
      console.error('send message error', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!overrideBody) setText(body);
      if (imageToSend) setPendingImage(imageToSend);
    } finally {
      setSending(false);
    }
  }

  return {
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
  };
}
