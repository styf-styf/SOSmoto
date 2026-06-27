import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { registerStoryClick, registerStoryView } from '../services/stories';
import type { Story } from '../types/database';

const DURATION_MS = 5000;

const actionLabel: Record<string, string> = {
  service: 'Ver servicio',
  product: 'Ver producto',
  contact: 'Contactar',
  business_tag: 'Ver negocio',
};

function getActionHref(story: Story, contactBusinessId?: string): string | null {
  switch (story.action_type) {
    case 'service':
      return `/(client)/servicio/${story.action_target_id}`;
    case 'product':
      return `/(client)/producto/${story.action_target_id}`;
    case 'contact':
      return contactBusinessId ? `/(client)/chat/${contactBusinessId}` : null;
    case 'business_tag':
      return `/(client)/business/${story.action_target_id}`;
    default:
      return null;
  }
}

export interface StoryViewerProps {
  loadStories: () => Promise<Story[]>;
  homeHref: string;
  contactBusinessId?: string;
}

// Visor full-screen reutilizado tanto por (client)/historia/[businessId] y
// (client)/historia-cliente/[clientId] como por sus equivalentes en
// (business)/ -- la única diferencia entre esos 4 wrappers es de dónde
// cargan las historias y a qué pantalla "Inicio" vuelven si no hay stack.
export function StoryViewer({ loadStories, homeHref, contactBusinessId }: StoryViewerProps) {
  const { profile } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadStories()
      .then(setStories)
      .catch((err) => console.error('load story viewer error', err))
      .finally(() => setLoading(false));
  }, [loadStories]);

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
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, profile, goNext]);

  function handleAction() {
    if (!current) return;
    const href = getActionHref(current, contactBusinessId);
    if (!href) return;
    registerStoryClick(current.id).catch((err) => console.error('register story click error', err));
    router.push(href);
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

  const actionHref = getActionHref(current, contactBusinessId);

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
            <View style={[styles.progressFill, { width: i <= index ? '100%' : '0%' }]} />
          </View>
        ))}
      </View>

      <Pressable style={styles.closeButton} onPress={closeViewer}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>

      {current.caption && (
        <View style={styles.captionBox}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      )}

      {actionHref && (
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
