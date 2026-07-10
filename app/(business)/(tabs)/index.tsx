import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { createBusiness, getMyWorkBusiness, getNewNearbyBusinesses, type BusinessWithDistance } from '../../../services/businesses';
import {
  acceptInvitation,
  getMyPendingInvitations,
  rejectInvitation,
  type EmployeeInvitationWithBusiness,
} from '../../../services/employeeInvitations';
import {
  dismissRemovalNotice,
  getMyRemovalNotice,
} from '../../../services/employees';
import { changeRoleToClient } from '../../../services/users';
import type { EmployeeRemovalNotice } from '../../../types/database';
import { dismissGrowthSuggestion, getActiveGrowthSuggestion } from '../../../services/growth';
import {
  getBusinessStories,
  getSeenStoryIds,
  getVisibleBusinessStoriesFollowed,
  getVisibleBusinessStoriesGlobal,
  getVisibleClientStories,
  groupStoriesByAuthor,
  isStoryVisible,
  type StoryFeedItem,
} from '../../../services/stories';
import { CreateBusinessPostBox } from '../../../components/CreateBusinessPostBox';
import { HomeFeed, type HomeFeedHandle } from '../../../components/HomeFeed';
import { StoriesRow } from '../../../components/StoriesRow';
import type { Business, BusinessType, GrowthSuggestion } from '../../../types/database';
import { clearLimitedMark, markLimited, wasPreviouslyLimited } from '../../../utils/accountLimit';
import { markProductoServicioStacksForReset } from '../../../utils/productoServicioStackReset';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function BusinessHomeScreen() {
  const { profile, refreshProfile } = useAuth();
  const { coords } = useLocation();
  const navigation = useNavigation();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingInvitations, setPendingInvitations] = useState<EmployeeInvitationWithBusiness[]>([]);
  const [removalNotice, setRemovalNotice] = useState<EmployeeRemovalNotice | null>(null);
  const [activeStories, setActiveStories] = useState(0);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [feedItemsFollowing, setFeedItemsFollowing] = useState<StoryFeedItem[]>([]);
  const [nearbyNewStores, setNearbyNewStores] = useState<BusinessWithDistance[]>([]);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [growthSuggestion, setGrowthSuggestion] = useState<GrowthSuggestion | null>(null);
  const homeFeedRef = useRef<HomeFeedHandle>(null);
  const limitCheckedRef = useRef(false);

  // Un taller puede seguir tiendas (relación B2B, ver BusinessProfileView) --
  // por eso solo el home de un taller gana el toggle Para ti/Siguiendo y el
  // descubrimiento "Nuevas tiendas cerca de ti", igual que el home del
  // cliente. Una tienda no puede seguir a nadie, así que su home se queda
  // como estaba.
  const isWorkshop = business?.business_type === 'workshop';
  const dragX = useRef(new Animated.Value(0)).current;
  const siguiendoTranslateX = useRef(Animated.add(dragX, new Animated.Value(SCREEN_WIDTH))).current;

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const work = await getMyWorkBusiness(profile.id);
      const result = work?.business ?? null;
      setBusiness(result);
      setIsOwner(work?.isOwner ?? false);
      if (!result) {
        const [invitations, notice] = await Promise.all([
          getMyPendingInvitations(profile.id),
          getMyRemovalNotice(profile.id),
        ]);
        setPendingInvitations(invitations);
        setRemovalNotice(notice);
        return;
      }
      setRemovalNotice(null);
      setPendingInvitations([]);

      if (!limitCheckedRef.current) {
        limitCheckedRef.current = true;
        const key = `business_limited:${result.id}`;
        const wasLimited = await wasPreviouslyLimited(key);
        if (result.is_limited) {
          await markLimited(key);
          Alert.alert(
            'Negocio limitado',
            result.limitation_reason
              ? `Tu negocio está limitado: ${result.limitation_reason}`
              : 'Tu negocio está limitado. No puedes crear anuncios nuevos, historias, publicaciones, editar catálogo, gestionar empleados ni usar el chat.'
          );
        } else if (wasLimited) {
          await clearLimitedMark(key);
          Alert.alert('Negocio restablecido', 'Se quitó el límite de tu negocio. Ya puedes usar la app con normalidad.');
        }
      }

      const [stories, businessStoriesGlobal, clientStoriesGlobal, suggestion, businessStoriesFollowed, newNearbyStores] =
        await Promise.all([
          getBusinessStories(result.id),
          getVisibleBusinessStoriesGlobal(),
          getVisibleClientStories(),
          getActiveGrowthSuggestion(result.id),
          result.business_type === 'workshop' ? getVisibleBusinessStoriesFollowed(profile.id) : Promise.resolve([]),
          result.business_type === 'workshop'
            ? getNewNearbyBusinesses(coords, 6, { onlyType: 'store', excludeBusinessId: result.id })
            : Promise.resolve([]),
        ]);
      setGrowthSuggestion(suggestion);
      setNearbyNewStores(newNearbyStores);
      const visibleOwnStories = stories.filter(isStoryVisible);
      setActiveStories(visibleOwnStories.length);
      setOwnPreviewImageUrl(visibleOwnStories[0]?.image_url ?? null);

      const allStoryIds = [
        ...businessStoriesGlobal.map((s) => s.id),
        ...clientStoriesGlobal.map((s) => s.id),
        ...businessStoriesFollowed.map((s) => s.id),
      ];
      const seenIds = await getSeenStoryIds(profile.id, allStoryIds);
      setFeedItems(
        groupStoriesByAuthor({
          businessStories: businessStoriesGlobal,
          clientStories: clientStoriesGlobal,
          seenStoryIds: seenIds,
          excludeBusinessId: result.id,
        })
      );
      setFeedItemsFollowing(
        groupStoriesByAuthor({
          businessStories: businessStoriesFollowed,
          clientStories: [],
          seenStoryIds: seenIds,
          excludeBusinessId: result.id,
        })
      );
    } catch (err) {
      console.error('load business error', err);
    }
  }, [profile, coords]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function switchTab(mode: 'all' | 'following') {
    Animated.spring(dragX, {
      toValue: mode === 'all' ? 0 : -SCREEN_WIDTH,
      useNativeDriver: true,
      tension: 250,
      friction: 28,
      overshootClamping: true,
    }).start();
  }

  useFocusEffect(
    useCallback(() => {
      // Reinicia la pila de producto/servicio cada vez que Inicio gana foco --
      // cubre volver con el botón "atrás" del header, no solo tocando el
      // ícono de la tab bar (ese caso ya lo maneja el listener de tabPress).
      dragX.setValue(0);
      markProductoServicioStacksForReset();
      load().catch((err) => console.error('refresh business home error', err));
    }, [load])
  );

  // Reinicia el toggle Para ti/Siguiendo y la pila de producto/servicio
  // (ver utils/productoServicioStackReset.ts) al presionar el tab "Inicio".
  useEffect(() => {
    return navigation.addListener('tabPress' as any, () => {
      Animated.spring(dragX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 250,
        friction: 28,
        overshootClamping: true,
      }).start();
      markProductoServicioStacksForReset();
    });
  }, [navigation]);

  async function handleDismissSuggestion() {
    if (!growthSuggestion) return;
    const id = growthSuggestion.id;
    setGrowthSuggestion(null);
    try {
      await dismissGrowthSuggestion(id);
    } catch (err) {
      console.error('dismiss growth suggestion error', err);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    if (removalNotice) {
      return (
        <RemovedNoticeScreen
          notice={removalNotice}
          onDismissed={() => { setRemovalNotice(null); }}
          onChangeToClient={async () => {
            await changeRoleToClient();
            await refreshProfile();
            router.replace('/');
          }}
        />
      );
    }
    if (pendingInvitations.length > 0) {
      return <PendingInvitationsScreen invitations={pendingInvitations} onResponded={load} />;
    }
    return <BusinessOnboarding onCreated={setBusiness} />;
  }

  const storiesRowOwn = {
    hasStory: activeStories > 0,
    avatarUrl: business.logo_url,
    previewImageUrl: ownPreviewImageUrl,
    onPress: () => router.push(activeStories > 0 ? `/(business)/historia/${business.id}` : '/(business)/historias'),
  };

  const growthCard = growthSuggestion && (
    <View style={styles.growthWrap}>
      <View style={styles.growthCard}>
        <Ionicons name="trending-up" size={20} color={colors.primary} />
        <View style={styles.growthCardText}>
          <Text style={styles.growthCardTitle}>{growthSuggestion.title}</Text>
          <Text style={styles.growthCardBody}>{growthSuggestion.body}</Text>
        </View>
        <Pressable style={styles.growthCardAction} onPress={() => router.push('/(business)/crece-tu-negocio')}>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
        <Pressable style={styles.growthCardAction} onPress={handleDismissSuggestion}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  const createPostBox = isOwner && (
    <View style={styles.createPostWrap}>
      {business.is_limited ? (
        <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
      ) : (
        <CreateBusinessPostBox businessId={business.id} onCreated={() => homeFeedRef.current?.refresh()} />
      )}
    </View>
  );

  if (!isWorkshop) {
    return (
      <HomeFeed
        ref={homeFeedRef}
        role="business"
        city={business.city}
        onRefresh={load}
        ListHeaderComponent={
          <View>
            <View style={styles.headerWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{business.name}</Text>
                <Text style={styles.titleSep}>|</Text>
                <Text style={styles.subtitle} numberOfLines={1}>{business.city}{business.address ? `, ${business.address}` : ''}</Text>
              </View>
              <Text style={styles.sectionTitle}>Historias</Text>
            </View>
            <View style={styles.storiesWrap}>
              <StoriesRow
                own={storiesRowOwn}
                items={feedItems.map((item) => ({
                  ...item,
                  onPress: () =>
                    router.push(
                      item.kind === 'business' ? `/(business)/historia/${item.id}` : `/(business)/historia-cliente/${item.id}`
                    ),
                }))}
              />
            </View>
            {growthCard}
            {createPostBox}
          </View>
        }
      />
    );
  }

  // Taller: mismo toggle Para ti/Siguiendo + descubrimiento de tiendas
  // nuevas cerca, igual que el home del cliente (ver app/(client)/(tabs)/index.tsx) --
  // incluye el mismo header de marca "SOSmoto" con el botón "Siguiendo" en vez
  // del nombre/ubicación del negocio.
  const paraTiHeader = (
    <View>
      <View style={styles.brandHeaderRow}>
        <View style={styles.brandHeaderSide} />
        <Text style={styles.brandTitle}>SOSmoto</Text>
        <Pressable style={[styles.brandHeaderSide, styles.brandHeaderSideRight]} onPress={() => switchTab('following')}>
          <Text style={styles.siguiendoBtn}>Siguiendo</Text>
          <Ionicons name="arrow-forward-outline" size={15} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.storiesWrap}>
        <StoriesRow
          own={storiesRowOwn}
          items={feedItems.map((item) => ({
            ...item,
            onPress: () =>
              router.push(
                item.kind === 'business' ? `/(business)/historia/${item.id}` : `/(business)/historia-cliente/${item.id}`
              ),
          }))}
        />
      </View>
      {growthCard}
      {createPostBox}
      {nearbyNewStores.length > 0 && (
        <View style={styles.descubreWrap}>
          <Text style={styles.sectionTitleInset}>Nuevas tiendas cerca de ti</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.descubreRow}>
            {nearbyNewStores.map((biz) => (
              <Pressable
                key={biz.id}
                style={styles.descubreCard}
                onPress={() => router.push(`/(business)/business/${biz.id}`)}
              >
                <View style={styles.descubreAvatarWrap}>
                  <View style={styles.descubreAvatar}>
                    {biz.logo_url ? (
                      <Image source={{ uri: biz.logo_url }} style={styles.descubreAvatarImage} />
                    ) : (
                      <Ionicons name="storefront" size={22} color={colors.primary} />
                    )}
                  </View>
                  {biz.is_verified && (
                    <View style={styles.descubreVerifiedDot}>
                      <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={styles.descubreName}>{biz.name}</Text>
                <Text numberOfLines={1} style={styles.descubreMeta}>
                  Tienda{biz.distance_km !== null ? ` · ${biz.distance_km.toFixed(1)} km` : ''}
                </Text>
                {biz.rating_avg > 0 && <Text style={styles.descubreRating}>★ {biz.rating_avg.toFixed(1)}</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const siguiendoHeader = (
    <View>
      <View style={styles.brandHeaderRow}>
        <Pressable style={[styles.brandHeaderSide, styles.brandHeaderSideLeft]} onPress={() => switchTab('all')}>
          <Ionicons name="arrow-back-outline" size={15} color={colors.primary} />
          <Text style={styles.siguiendoBtn}>Para ti</Text>
        </Pressable>
        <Text style={styles.brandTitle}>Siguiendo</Text>
        <View style={styles.brandHeaderSide} />
      </View>
      <View style={styles.storiesWrap}>
        <StoriesRow
          own={storiesRowOwn}
          items={feedItemsFollowing.map((item) => ({
            ...item,
            onPress: () => router.push(`/(business)/historia/${item.id}`),
          }))}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: dragX }] }]}>
        <HomeFeed
          ref={homeFeedRef}
          role="business"
          city={business.city}
          feedMode="all"
          clientId={profile?.id}
          onRefresh={load}
          ListHeaderComponent={paraTiHeader}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: siguiendoTranslateX }] }]}>
        <HomeFeed
          role="business"
          city={business.city}
          feedMode="following"
          clientId={profile?.id}
          emptyMessage="Las tiendas que sigues aún no han publicado nada."
          onRefresh={load}
          ListHeaderComponent={siguiendoHeader}
        />
      </Animated.View>
    </View>
  );
}

function RemovedNoticeScreen({
  notice,
  onDismissed,
  onChangeToClient,
}: {
  notice: EmployeeRemovalNotice;
  onDismissed: () => void;
  onChangeToClient: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'register' | 'wait' | 'client' | null>(null);

  async function handleDismiss(action: 'register' | 'wait') {
    setBusy(action);
    try {
      await dismissRemovalNotice(notice.id);
      onDismissed();
    } catch (err) {
      console.error('dismiss removal notice error', err);
      Alert.alert('Error', 'No se pudo continuar. Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function handleChangeToClient() {
    Alert.alert(
      'Cambiar a cuenta de cliente',
      'Tu cuenta pasará a ser de cliente. Ya no tendrás acceso al panel de negocio. ¿Confirmas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cambiar',
          style: 'destructive',
          onPress: async () => {
            setBusy('client');
            try {
              await dismissRemovalNotice(notice.id);
              await onChangeToClient();
            } catch (err) {
              console.error('change role to client error', err);
              Alert.alert('Error', 'No se pudo cambiar el rol. Intenta de nuevo.');
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.removedContainer}>
      <Ionicons name="person-remove-outline" size={52} color={colors.danger} style={styles.removedIcon} />
      <Text style={styles.removedTitle}>Fuiste removido del equipo</Text>
      <Text style={styles.removedSubtitle}>
        Ya no eres parte del equipo de <Text style={styles.removedBusiness}>{notice.business_name}</Text>.
        Elige cómo quieres continuar:
      </Text>

      <Button
        title="Registrar mi propio negocio"
        onPress={() => handleDismiss('register')}
        loading={busy === 'register'}
        disabled={busy !== null}
        style={styles.removedButton}
      />
      <Button
        title="Esperar invitación de otro negocio"
        variant="secondary"
        onPress={() => handleDismiss('wait')}
        loading={busy === 'wait'}
        disabled={busy !== null}
        style={styles.removedButton}
      />
      <Button
        title="Cambiar a cuenta de cliente"
        variant="secondary"
        onPress={handleChangeToClient}
        loading={busy === 'client'}
        disabled={busy !== null}
        style={styles.removedButton}
      />
    </ScrollView>
  );
}

function PendingInvitationsScreen({
  invitations,
  onResponded,
}: {
  invitations: EmployeeInvitationWithBusiness[];
  onResponded: () => void;
}) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function handleAccept(inv: EmployeeInvitationWithBusiness) {
    setProcessingId(inv.id);
    try {
      await acceptInvitation(inv.id);
      onResponded();
    } catch (err) {
      console.error('accept invitation error', err);
      Alert.alert('Error', 'No se pudo aceptar la invitación. Intenta de nuevo.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(inv: EmployeeInvitationWithBusiness) {
    Alert.alert(
      'Rechazar invitación',
      `¿Seguro que quieres rechazar la invitación de ${inv.business_name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(inv.id);
            try {
              await rejectInvitation(inv.id);
              onResponded();
            } catch (err) {
              console.error('reject invitation error', err);
              Alert.alert('Error', 'No se pudo rechazar la invitación.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.invitationsContainer}>
      <Ionicons name="mail-outline" size={48} color={colors.primary} style={styles.invitationsIcon} />
      <Text style={styles.invitationsTitle}>Tienes invitaciones</Text>
      <Text style={styles.invitationsSubtitle}>
        Un taller te invitó a unirte como mecánico. Acepta para empezar a trabajar.
      </Text>
      {invitations.map((inv) => (
        <View key={inv.id} style={styles.invitationCard}>
          <Text style={styles.invitationBusiness}>{inv.business_name}</Text>
          <Text style={styles.invitationMeta}>
            {inv.can_accept_aid_requests
              ? 'Podrás aceptar solicitudes de auxilio'
              : 'Sin permisos de auxilio inicialmente'}
          </Text>
          <View style={styles.invitationActions}>
            <Button
              title="Aceptar"
              onPress={() => handleAccept(inv)}
              loading={processingId === inv.id}
              style={styles.flexButton}
            />
            <Button
              title="Rechazar"
              variant="secondary"
              onPress={() => handleReject(inv)}
              style={styles.flexButton}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const ECUADOR_PROVINCES = [
  'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi',
  'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja',
  'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza',
  'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
  'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
];

const QUITO_DEFAULT = { latitude: -0.1807, longitude: -78.4678 };

function BusinessOnboarding({ onCreated }: { onCreated: (business: Business) => void }) {
  const { profile } = useAuth();
  const { coords, getCoords } = useLocation();
  const [businessType, setBusinessType] = useState<BusinessType>('workshop');
  const [name, setName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [gettingAddress, setGettingAddress] = useState(false);

  // Teclado
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Mapa
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const pendingRegionRef = useRef<Region | null>(null);

  function openMapPicker() {
    const center = selectedCoords ?? coords ?? QUITO_DEFAULT;
    const region: Region = { ...center, latitudeDelta: 0.004, longitudeDelta: 0.004 };
    pendingRegionRef.current = region;
    setMapInitialRegion(region);
    setShowMapPicker(true);
  }

  function confirmMapLocation() {
    if (pendingRegionRef.current) {
      setSelectedCoords({ latitude: pendingRegionRef.current.latitude, longitude: pendingRegionRef.current.longitude });
    }
    setShowMapPicker(false);
  }

  async function handleFillAddressFromGPS() {
    setGettingAddress(true);
    try {
      const freshCoords = await getCoords();
      const results = await Location.reverseGeocodeAsync(freshCoords);
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.streetNumber, r.street].filter(Boolean).join(' ');
        if (parts) setAddress(parts);
      }
    } catch {
      Alert.alert('GPS', 'No se pudo obtener la dirección desde el GPS.');
    } finally {
      setGettingAddress(false);
    }
  }

  async function handleCreate() {
    if (!profile) return;
    if (!name.trim() || !province || !city.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Faltan datos', 'Completa todos los campos obligatorios.');
      return;
    }
    if (!selectedCoords) {
      Alert.alert('Ubicación requerida', 'Selecciona la ubicación de tu negocio en el mapa.');
      return;
    }
    setSaving(true);
    try {
      const business = await createBusiness({
        ownerId: profile.id,
        businessType,
        name: name.trim(),
        province,
        city: city.trim(),
        address: address.trim(),
        latitude: selectedCoords.latitude,
        longitude: selectedCoords.longitude,
        phone: phone.trim(),
      });
      Keyboard.dismiss();
      onCreated(business);
    } catch (err) {
      console.error('create business error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear el negocio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.onboardingContainer, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 24 : 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Crea tu negocio</Text>
      <Text style={styles.subtitle}>Completa estos datos para empezar a recibir clientes.</Text>

      <View style={styles.typeSelector}>
        <TypeOption label="Taller" selected={businessType === 'workshop'} onPress={() => setBusinessType('workshop')} />
        <TypeOption label="Tienda" selected={businessType === 'store'} onPress={() => setBusinessType('store')} />
        <TypeOption label="Marca" selected={businessType === 'brand_advertiser'} onPress={() => setBusinessType('brand_advertiser')} />
      </View>

      <TextField label="Nombre del negocio *" placeholder="Taller Mecánico XYZ" value={name} onChangeText={setName} />

      <Text style={styles.fieldLabel}>Provincia *</Text>
      <Pressable style={styles.pickerButton} onPress={() => setShowProvincePicker(true)}>
        <Text style={[styles.pickerButtonText, !province && styles.pickerButtonPlaceholder]}>
          {province || 'Selecciona una provincia'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <TextField label="Ciudad *" placeholder="Quito" value={city} onChangeText={setCity} />

      <TextField
        label="Dirección *"
        placeholder="Av. Principal 123, oficina 4"
        value={address}
        onChangeText={setAddress}
        rightIcon={{ name: gettingAddress ? 'reload-outline' : 'navigate-outline', onPress: handleFillAddressFromGPS }}
      />

      <Text style={styles.fieldLabel}>Ubicación en el mapa *</Text>
      {selectedCoords ? (
        <View style={styles.locationConfirmed}>
          <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
          <Text style={styles.locationConfirmedText}>Ubicación seleccionada</Text>
          <Pressable onPress={openMapPicker}>
            <Text style={styles.locationChangeLink}>Cambiar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.mapPickerButton} onPress={openMapPicker}>
          <Ionicons name="map-outline" size={18} color={colors.primary} />
          <Text style={styles.mapPickerButtonText}>Seleccionar en mapa</Text>
        </Pressable>
      )}

      <TextField
        label="Teléfono *"
        placeholder="09xxxxxxxx"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Button title="Crear negocio" onPress={handleCreate} loading={saving} style={styles.createButton} />

      {/* Province picker */}
      <Modal visible={showProvincePicker} transparent animationType="slide" onRequestClose={() => setShowProvincePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProvincePicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecciona la provincia</Text>
            <FlatList
              data={ECUADOR_PROVINCES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.provinceItem, province === item && styles.provinceItemSelected]}
                  onPress={() => { setProvince(item); setShowProvincePicker(false); }}
                >
                  <Text style={[styles.provinceText, province === item && styles.provinceTextSelected]}>{item}</Text>
                  {province === item && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Map picker */}
      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={styles.mapContainer}>
          {mapInitialRegion && (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={mapInitialRegion}
              onRegionChangeComplete={(r) => { pendingRegionRef.current = r; }}
            />
          )}
          {/* Pin fijo en el centro */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.mapPinWrap}>
              <Ionicons name="location-sharp" size={48} color={colors.primary} />
              <View style={styles.mapPinShadow} />
            </View>
          </View>
          {/* Header */}
          <View style={styles.mapHeader}>
            <Pressable style={styles.mapCloseBtn} onPress={() => setShowMapPicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.mapInstructions}>Mueve el mapa para posicionar tu negocio</Text>
          </View>
          {/* Footer */}
          <View style={styles.mapFooter}>
            <Button title="Confirmar ubicación" onPress={confirmMapLocation} />
          </View>
        </View>
      </Modal>
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
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingTop: 36,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 6,
  },
  brandHeaderSide: {
    flex: 1,
  },
  brandHeaderSideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  brandHeaderSideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  siguiendoBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  storiesWrap: {
    paddingBottom: 16,
  },
  descubreWrap: {
    marginBottom: 16,
  },
  descubreRow: {
    gap: 10,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  descubreCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  descubreAvatarWrap: {
    position: 'relative',
    marginBottom: 8,
  },
  descubreAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  descubreAvatarImage: {
    width: 52,
    height: 52,
  },
  descubreVerifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  descubreName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  descubreMeta: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  descubreRating: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
  growthWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  growthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF1E6',
    borderRadius: 12,
    padding: 14,
  },
  growthCardText: {
    flex: 1,
  },
  growthCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  growthCardBody: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  growthCardAction: {
    padding: 6,
  },
  createPostWrap: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  limitedNotice: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    padding: 10,
  },
  removedContainer: {
    padding: 24,
    backgroundColor: colors.background,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removedIcon: {
    marginBottom: 20,
  },
  removedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  removedSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  removedBusiness: {
    fontWeight: '700',
    color: colors.text,
  },
  removedButton: {
    width: '100%',
    marginBottom: 12,
  },
  invitationsContainer: {
    padding: 24,
    backgroundColor: colors.background,
    flexGrow: 1,
    alignItems: 'center',
  },
  invitationsIcon: {
    marginBottom: 16,
    marginTop: 32,
  },
  invitationsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  invitationsSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  invitationCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    width: '100%',
  },
  invitationBusiness: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  invitationMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 14,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  onboardingContainer: {
    padding: 20,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  titleSep: {
    fontSize: 16,
    color: colors.border,
    fontWeight: '300',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionTitleInset: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    paddingHorizontal: 20,
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
    marginTop: 0,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerButtonPlaceholder: {
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  provinceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  provinceItemSelected: {
    backgroundColor: '#FFF1E6',
  },
  provinceText: {
    fontSize: 15,
    color: colors.text,
  },
  provinceTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  createButton: {
    marginTop: 24,
  },
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#F0FDF4',
    marginBottom: 16,
  },
  locationConfirmedText: {
    flex: 1,
    fontSize: 15,
    color: '#166534',
    fontWeight: '500',
  },
  locationChangeLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    height: 50,
    marginBottom: 16,
    backgroundColor: '#FFF1E6',
  },
  mapPickerButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapPinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  mapPinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -8,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapCloseBtn: {
    padding: 4,
  },
  mapInstructions: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
