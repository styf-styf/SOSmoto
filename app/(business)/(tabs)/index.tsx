import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { createBusiness, getMyWorkBusiness } from '../../../services/businesses';
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

export default function BusinessHomeScreen() {
  const { profile, refreshProfile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingInvitations, setPendingInvitations] = useState<EmployeeInvitationWithBusiness[]>([]);
  const [removalNotice, setRemovalNotice] = useState<EmployeeRemovalNotice | null>(null);
  const [activeStories, setActiveStories] = useState(0);
  const [feedItems, setFeedItems] = useState<StoryFeedItem[]>([]);
  const [ownPreviewImageUrl, setOwnPreviewImageUrl] = useState<string | null>(null);
  const [growthSuggestion, setGrowthSuggestion] = useState<GrowthSuggestion | null>(null);
  const homeFeedRef = useRef<HomeFeedHandle>(null);
  const limitCheckedRef = useRef(false);

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

      const [stories, businessStoriesGlobal, clientStoriesGlobal, suggestion] = await Promise.all([
        getBusinessStories(result.id),
        getVisibleBusinessStoriesGlobal(),
        getVisibleClientStories(),
        getActiveGrowthSuggestion(result.id),
      ]);
      setGrowthSuggestion(suggestion);
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
          onDismissed={() => {
            setRemovalNotice(null);
          }}
          onChangeToClient={async () => {
            await changeRoleToClient();
            await refreshProfile();
            router.replace('/');
          }}
        />
      );
    }
    if (pendingInvitations.length > 0) {
      return (
        <PendingInvitationsScreen
          invitations={pendingInvitations}
          onResponded={load}
        />
      );
    }
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
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{business.name}</Text>
              <Text style={styles.titleSep}>|</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{business.city}{business.address ? `, ${business.address}` : ''}</Text>
            </View>
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
          {growthSuggestion && (
            <View style={styles.growthWrap}>
              <View style={styles.growthCard}>
                <Ionicons name="trending-up" size={20} color={colors.primary} />
                <View style={styles.growthCardText}>
                  <Text style={styles.growthCardTitle}>{growthSuggestion.title}</Text>
                  <Text style={styles.growthCardBody}>{growthSuggestion.body}</Text>
                </View>
                <Pressable
                  style={styles.growthCardAction}
                  onPress={() => router.push('/(business)/crece-tu-negocio')}
                >
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </Pressable>
                <Pressable style={styles.growthCardAction} onPress={handleDismissSuggestion}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          )}
          {isOwner && (
            <View style={styles.createPostWrap}>
              {business.is_limited ? (
                <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
              ) : (
                <CreateBusinessPostBox businessId={business.id} onCreated={() => homeFeedRef.current?.refresh()} />
              )}
            </View>
          )}
        </View>
      }
    />
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
    paddingTop: 36,
  },
  storiesWrap: {
    paddingBottom: 16,
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
