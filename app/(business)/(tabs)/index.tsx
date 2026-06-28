import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { createBusiness, getMyWorkBusiness } from '../../../services/businesses';
import {
  getBusinessStories,
  getSeenStoryIds,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  isStoryVisible,
  type StoryFeedItem,
} from '../../../services/stories';
import { CreateBusinessPostBox } from '../../../components/CreateBusinessPostBox';
import { HomeFeed, type HomeFeedHandle } from '../../../components/HomeFeed';
import { StoriesRow } from '../../../components/StoriesRow';
import type { Business, BusinessType } from '../../../types/database';

export default function BusinessHomeScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeStories, setActiveStories] = useState(0);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const homeFeedRef = useRef<HomeFeedHandle>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const work = await getMyWorkBusiness(profile.id);
      const result = work?.business ?? null;
      setBusiness(result);
      setIsOwner(work?.isOwner ?? false);
      if (!result) return;

      const [stories, businessStoriesGlobal, clientStoriesGlobal] = await Promise.all([
        getBusinessStories(result.id),
        getVisibleBusinessStoriesGlobal(),
        getVisibleClientStories(),
      ]);
      const visibleOwnStories = stories.filter(isStoryVisible);
      setActiveStories(visibleOwnStories.length);
      setOwnPreviewImageUrl(visibleOwnStories[0]?.image_url ?? null);

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
      load().catch((err) => console.error('refresh business home error', err));
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
    <HomeFeed
      ref={homeFeedRef}
      role="business"
      city={business.city}
      onRefresh={load}
      ListHeaderComponent={
        <View>
          <View style={styles.headerWrap}>
            <Text style={styles.title}>{business.name}</Text>
            <Text style={styles.subtitle}>
              {business.address}, {business.city}
            </Text>
            <Text style={styles.sectionTitle}>Historias</Text>
          </View>
          <View style={styles.storiesWrap}>
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
          </View>
          {isOwner && (
            <View style={styles.createPostWrap}>
              <CreateBusinessPostBox businessId={business.id} onCreated={() => homeFeedRef.current?.refresh()} />
            </View>
          )}
        </View>
      }
    />
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
    <ScrollView contentContainerStyle={styles.onboardingContainer}>
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
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  storiesWrap: {
    paddingBottom: 16,
  },
  createPostWrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  onboardingContainer: {
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
