import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { createBusiness, getMyWorkBusiness } from '../../services/businesses';
import { getAllProducts, getAllServices, getPlanLimits, type PlanLimits } from '../../services/catalog';
import { getPendingRequests } from '../../services/helpRequests';
import { getPublicFeed, type PostWithAuthor } from '../../services/posts';
import {
  getBusinessStories,
  getSeenStoryIds,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  isStoryVisible,
  type StoryFeedItem,
} from '../../services/stories';
import { PostCard } from '../../components/PostCard';
import { StoriesRow } from '../../components/StoriesRow';
import type { Business, BusinessType } from '../../types/database';

export default function BusinessHomeScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeServices, setActiveServices] = useState(0);
  const [activeProducts, setActiveProducts] = useState(0);
  const [activeStories, setActiveStories] = useState(0);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const work = await getMyWorkBusiness(profile.id);
      const result = work?.business ?? null;
      setBusiness(result);
      if (!result) return;

      const [pending, services, products, planLimits, stories, businessStoriesGlobal, clientStoriesGlobal] =
        await Promise.all([
          getPendingRequests(result.id),
          getAllServices(result.id),
          getAllProducts(result.id),
          getPlanLimits(result.id),
          getBusinessStories(result.id),
          getVisibleBusinessStoriesGlobal(),
          getVisibleClientStories(),
        ]);
      setPendingCount(pending.length);
      setActiveServices(services.filter((s) => s.is_active).length);
      setActiveProducts(products.filter((p) => p.is_active).length);
      const visibleOwnStories = stories.filter(isStoryVisible);
      setActiveStories(visibleOwnStories.length);
      setOwnPreviewImageUrl(visibleOwnStories[0]?.image_url ?? null);
      setLimits(planLimits);

      const allStoryIds = [...businessStoriesGlobal.map((s) => s.id), ...clientStoriesGlobal.map((s) => s.id)];
      const seenIds = await getSeenStoryIds(profile.id, allStoryIds);
      setFeedItems(
        groupStoriesByAuthor({
          businessStories: businessStoriesGlobal,
          clientStories: clientStoriesGlobal,
          seenStoryIds: seenIds,
          excludeBusinessId: result.id,
        })
      );

      setPosts(await getPublicFeed());
    } catch (err) {
      console.error('load business error', err);
    }
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh business dashboard error', err));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return <BusinessOnboarding onCreated={setBusiness} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{business.name}</Text>
      <Text style={styles.subtitle}>
        {business.address}, {business.city}
      </Text>

      <Text style={styles.sectionTitle}>Historias</Text>
      <StoriesRow
        own={{
          hasStory: activeStories > 0,
          avatarUrl: business.logo_url,
          previewImageUrl: ownPreviewImageUrl,
          onPress: () =>
            router.push(activeStories > 0 ? `/(business)/historia/${business.id}` : '/(business)/historias'),
        }}
        items={feedItems.map((item) => ({
          ...item,
          onPress: () =>
            router.push(
              item.kind === 'business' ? `/(business)/historia/${item.id}` : `/(business)/historia-cliente/${item.id}`
            ),
        }))}
      />

      <View style={styles.postsHeader}>
        <Text style={styles.sectionTitle}>Publicaciones</Text>
        <Pressable onPress={() => router.push('/(business)/publicaciones')}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>
      {posts.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no hay publicaciones.</Text>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} detailHref={`/(business)/publicacion/${post.id}`} />
        ))
      )}

      <Pressable
        style={styles.card}
        onPress={() => router.push('/(business)/solicitudes')}
      >
        <Text style={styles.cardLabel}>Solicitudes de auxilio pendientes</Text>
        <Text style={[styles.cardValue, pendingCount > 0 && styles.cardValueAlert]}>{pendingCount}</Text>
      </Pressable>

      <View style={styles.row}>
        <View style={[styles.card, styles.flexCard]}>
          <Text style={styles.cardLabel}>Calificación</Text>
          <Text style={styles.cardValue}>
            {business.rating_avg > 0 ? business.rating_avg.toFixed(1) : '—'}
          </Text>
        </View>
        <View style={[styles.card, styles.flexCard]}>
          <Text style={styles.cardLabel}>Seguidores</Text>
          <Text style={styles.cardValue}>{business.followers_count}</Text>
        </View>
      </View>

      <Pressable style={styles.card} onPress={() => router.push('/(business)/historias')}>
        <Text style={styles.cardLabel}>Historias activas</Text>
        <Text style={styles.cardValueSmall}>
          {activeStories} historia{activeStories === 1 ? '' : 's'} visible{activeStories === 1 ? '' : 's'} para tus clientes ahora.
        </Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push('/(business)/catalogo')}>
        <Text style={styles.cardLabel}>Catálogo (plan {limits?.planName ?? '...'})</Text>
        <Text style={styles.cardValueSmall}>
          {activeServices}{limits?.maxServices !== null ? `/${limits?.maxServices}` : ''} servicios ·{' '}
          {activeProducts}{limits?.maxProducts !== null ? `/${limits?.maxProducts}` : ''} productos
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function BusinessOnboarding({ onCreated }: { onCreated: (business: Business) => void }) {
  const { profile } = useAuth();
  const { coords } = useLocation();
  const [businessType, setBusinessType] = useState<BusinessType>('workshop');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!profile) return;
    if (!name.trim() || !address.trim() || !city.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, dirección y ciudad.');
      return;
    }
    if (!coords) {
      Alert.alert('Ubicación requerida', 'Activa el permiso de ubicación para registrar tu negocio.');
      return;
    }

    setSaving(true);
    try {
      const business = await createBusiness({
        ownerId: profile.id,
        businessType,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        phone: phone.trim() || undefined,
      });
      onCreated(business);
    } catch (err) {
      console.error('create business error', err);
      const message = err instanceof Error ? err.message : 'No se pudo crear el negocio.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crea tu negocio</Text>
      <Text style={styles.subtitle}>Completa estos datos para empezar a recibir clientes.</Text>

      <View style={styles.typeSelector}>
        <TypeOption
          label="Taller"
          selected={businessType === 'workshop'}
          onPress={() => setBusinessType('workshop')}
        />
        <TypeOption
          label="Tienda"
          selected={businessType === 'store'}
          onPress={() => setBusinessType('store')}
        />
        <TypeOption
          label="Marca"
          selected={businessType === 'brand_advertiser'}
          onPress={() => setBusinessType('brand_advertiser')}
        />
      </View>

      <TextField label="Nombre del negocio" placeholder="Taller Mecánico XYZ" value={name} onChangeText={setName} />
      <TextField label="Dirección" placeholder="Av. Principal 123" value={address} onChangeText={setAddress} />
      <TextField label="Ciudad" placeholder="Quito" value={city} onChangeText={setCity} />
      <TextField
        label="Teléfono (opcional)"
        placeholder="09xxxxxxxx"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text style={styles.locationNote}>
        {coords ? 'Ubicación detectada ✓ (usaremos tu ubicación actual)' : 'Esperando permiso de ubicación…'}
      </Text>

      <Button title="Crear negocio" onPress={handleCreate} loading={saving} />
    </ScrollView>
  );
}

function TypeOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.typeOption, selected && styles.typeOptionSelected]}>
      <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>{label}</Text>
    </Pressable>
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
    padding: 20,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flexCard: {
    flex: 1,
  },
  cardValueAlert: {
    color: colors.danger,
  },
  cardValueSmall: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  cardValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  typeOptionText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  typeOptionTextSelected: {
    color: colors.primary,
  },
  locationNote: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
    marginTop: -4,
  },
});
