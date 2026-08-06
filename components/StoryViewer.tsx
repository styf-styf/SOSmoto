import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { getBusinessOwnerForChat } from '../services/businesses';
import { registerStoryClick, registerStoryView } from '../services/stories';
import type { Story } from '../types/database';

const DURATION_MS = 15000;

const actionLabel: Record<string, string> = {
  service: 'Ver servicio',
  product: 'Ver producto',
  contact: 'Contactar',
  business_tag: 'Ver negocio',
};

// Solo decide si el botón se muestra -- la ruta real se arma en
// resolveActionHref, que necesita saber el rol de quien está viendo (una
// historia de negocio la puede ver tanto un cliente como otro negocio, ej.
// un taller navegando la de una tienda) y, para "contact", resolver el
// user id del dueño de forma async.
function hasAction(story: Story, contactBusinessId?: string): boolean {
  // Las historias de cliente nunca tienen botón de acción (no tienen
  // catálogo ni perfil de negocio que mostrar).
  if (story.client_id) return false;
  switch (story.action_type) {
    case 'service':
    case 'product':
    case 'business_tag':
      return true;
    case 'contact':
      return !!contactBusinessId;
    default:
      return false;
  }
}

// "producto"/"servicio"/"business" viven bajo un prefijo distinto según el
// rol de quien ve la historia -- antes esto estaba fijo a "/(client)" sin
// importar quién miraba, lo que rompía el botón para negocios (ruta
// inexistente bajo su propio grupo) y además le faltaba el segmento
// "(tabs)" incluso para clientes.
async function resolveActionHref(
  story: Story,
  contactBusinessId: string | undefined,
  isBusiness: boolean
): Promise<string | null> {
  const prefix = isBusiness ? '/(business)' : '/(client)';
  switch (story.action_type) {
    case 'service':
      return `${prefix}/(tabs)/servicio/${story.action_target_id}`;
    case 'product':
      return `${prefix}/(tabs)/producto/${story.action_target_id}`;
    case 'business_tag':
      return `${prefix}/business/${story.action_target_id}`;
    case 'contact': {
      if (!contactBusinessId) return null;
      if (isBusiness) {
        const ownerId = await getBusinessOwnerForChat(contactBusinessId).catch((err) => {
          console.error('get business owner for chat error', err);
          return null;
        });
        return ownerId ? `/(business)/chat/${ownerId}?sellerBusinessId=${contactBusinessId}` : null;
      }
      return `/(client)/chat/${contactBusinessId}`;
    }
    default:
      return null;
  }
}

export interface StoryViewerProps {
  loadStories: () => Promise<Story[]>;
  homeHref: string;
  contactBusinessId?: string;
  // Solo lo pasan los dos wrappers que pueden estar viendo la propia historia
  // (cliente viendo la suya, negocio viendo la suya) -- ver nota junto a
  // los 4 wrappers en app/(client|business)/historia(-cliente)/[id].tsx.
  // Eliminar ya no vive en una pantalla de gestión aparte: se hace desde
  // acá, en la propia historia abierta.
  canDelete?: boolean;
  onDelete?: (storyId: string) => Promise<void>;
}

// Visor full-screen reutilizado tanto por (client)/historia/[businessId] y
// (client)/historia-cliente/[clientId] como por sus equivalentes en
// (business)/ -- la única diferencia entre esos 4 wrappers es de dónde
// cargan las historias y a qué pantalla "Inicio" vuelven si no hay stack.
export function StoryViewer({ loadStories, homeHref, contactBusinessId, canDelete, onDelete }: StoryViewerProps) {
  const { profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStories()
      .then(setStories)
      .catch((err) => console.error('load story viewer error', err))
      .finally(() => setLoading(false));
  }, [loadStories]);

  // Al recuperar el foco (ej. volver de "Ver servicio"/"Ver producto") se
  // refresca la lista en segundo plano -- se acota el índice al nuevo tamaño
  // para no quedar apuntando a una historia que ya no existe.
  useFocusEffect(
    useCallback(() => {
      loadStories()
        .then((fresh) => {
          setStories(fresh);
          setIndex((i) => Math.min(i, Math.max(0, fresh.length - 1)));
        })
        .catch((err) => console.error('refresh story viewer on focus error', err));
    }, [loadStories])
  );

  const current = stories[index];

  const closeViewer = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(homeHref);
  }, [homeHref]);

  const goNext = useCallback(() => {
    if (index + 1 >= stories.length) {
      closeViewer();
      return;
    }
    setIndex(index + 1);
  }, [index, stories.length, closeViewer]);

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  useEffect(() => {
    if (!current) return;
    if (profile) {
      registerStoryView(current.id, profile.id).catch((err) => console.error('register story view error', err));
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(goNext, DURATION_MS);

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      animation.stop();
    };
  }, [current, profile, goNext, progressAnim]);

  async function handleAction() {
    if (!current) return;
    const href = await resolveActionHref(current, contactBusinessId, profile?.role === 'business');
    if (!href) return;
    registerStoryClick(current.id).catch((err) => console.error('register story click error', err));
    router.push(href);
  }

  function handleDeletePress() {
    if (!current || !onDelete) return;
    const storyId = current.id;
    Alert.alert('Eliminar historia', '¿Eliminar esta historia? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete(storyId);
            setStories((prev) => {
              const next = prev.filter((s) => s.id !== storyId);
              setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
              return next;
            });
          } catch (err) {
            console.error('delete story error', err);
            Alert.alert('Error', 'No se pudo eliminar la historia.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No hay historias disponibles.</Text>
        <Pressable onPress={closeViewer} style={styles.closeFallback}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
    );
  }

  const showAction = hasAction(current, contactBusinessId);

  return (
    <View style={styles.container}>
      <Image source={{ uri: current.image_url }} style={styles.image} resizeMode="contain" />

      <View style={styles.tapZones}>
        <Pressable style={styles.tapLeft} onPress={goPrev} />
        <Pressable style={styles.tapRight} onPress={goNext} />
      </View>

      <View style={styles.progressRow}>
        {stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            {i < index ? (
              <View style={[styles.progressFill, { width: '100%' }]} />
            ) : i === index ? (
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            ) : null}
          </View>
        ))}
      </View>

      {canDelete && (
        <Pressable style={styles.deleteButton} onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </Pressable>
      )}

      <Pressable style={styles.closeButton} onPress={closeViewer}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>

      {current.caption && (
        <View style={styles.captionBox}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      )}

      {showAction && (
        <Pressable style={styles.actionButton} onPress={handleAction}>
          <Text style={styles.actionText}>{actionLabel[current.action_type]}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 14,
  },
  closeFallback: {
    padding: 8,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
  progressRow: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  closeButton: {
    position: 'absolute',
    top: 62,
    right: 12,
    padding: 6,
  },
  deleteButton: {
    position: 'absolute',
    top: 62,
    right: 56,
    padding: 6,
  },
  captionBox: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
  },
  caption: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  actionButton: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});
