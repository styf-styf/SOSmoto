import { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { createAdCampaign, getAdPricing, getBusinessAds, pauseAd, quoteAdPrice } from '../../services/ads';
import { getMyWorkBusiness } from '../../services/businesses';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Ad, AdPricing, Business } from '../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 12;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));

const statusLabel: Record<Ad['status'], string> = {
  pending_review: 'Pendiente de revisión',
  approved: 'Aprobada',
  active: 'Activa',
  rejected: 'Rechazada',
  expired: 'Finalizada',
};

const statusColor: Record<Ad['status'], string> = {
  pending_review: colors.warning,
  approved: colors.success,
  active: colors.success,
  rejected: colors.danger,
  expired: colors.textMuted,
};

interface PublicidadData {
  business: Business | null;
  isOwner: boolean;
  ads: Ad[];
  pricing: AdPricing | null;
}

export default function PublicidadScreen() {
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const [national, setNational] = useState(true);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `publicidad-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<PublicidadData>(cacheKey, async () => {
    const empty: PublicidadData = { business: null, isOwner: false, ads: [], pricing: null };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    const [businessAds, adPricing] = await Promise.all([getBusinessAds(work.business.id), getAdPricing()]);
    return { business: work.business, isOwner: work.isOwner, ads: businessAds, pricing: adPricing };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;
  const ads = data?.ads ?? [];
  const pricing = data?.pricing ?? null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load publicidad error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePickImage() {
    if (!business) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(business.id);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload ad image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  const parsedDays = Number(durationDays);
  const validDays = Number.isFinite(parsedDays) && parsedDays > 0;
  const price = validDays && pricing
    ? quoteAdPrice(pricing, { targetCity: national ? undefined : business?.city, durationDays: parsedDays })
    : 0;

  async function handleCreate() {
    if (!business) return;
    if (!title.trim() || !imageUrl.trim()) {
      Alert.alert('Faltan datos', 'Completa el título y selecciona una imagen para el anuncio.');
      return;
    }
    if (linkUrl.trim() && !/^(https?:\/\/|tel:|mailto:)/i.test(linkUrl.trim())) {
      Alert.alert(
        'Link inválido',
        'El link debe ser una URL completa, por ejemplo https://wa.me/593..., https://tusitio.com, tel:+593... o mailto:correo@...'
      );
      return;
    }
    if (!validDays) {
      Alert.alert('Duración inválida', 'Ingresa un número de días válido.');
      return;
    }
    setSaving(true);
    try {
      const { checkoutUrl } = await createAdCampaign({
        businessId: business.id,
        title: title.trim(),
        imageUrl: imageUrl.trim(),
        linkUrl: linkUrl.trim() || undefined,
        targetCity: national ? undefined : business.city,
        durationDays: parsedDays,
      });
      setShowForm(false);
      await Linking.openURL(checkoutUrl);
    } catch (err) {
      console.error('create ad campaign error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo iniciar el pago de la campaña.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePause(ad: Ad) {
    try {
      const updated = await pauseAd(ad.id);
      setData((prev) => (prev ? { ...prev, ads: prev.ads.map((a) => (a.id === ad.id ? updated : a)) } : prev));
    } catch (err) {
      console.error('pause ad error', err);
      Alert.alert('Error', 'No se pudo pausar la campaña. Intenta de nuevo.');
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
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea o únete a un negocio.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Text style={styles.helperText}>
        Todas las campañas son de pago (vía Payphone) y quedan en revisión hasta que el equipo de SOSmoto las
        aprueba. Una vez activa, se muestra automáticamente en inicio, búsqueda y perfiles relevantes — no eliges
        dónde aparece.
      </Text>

      {!isOwner && <Text style={styles.helperText}>Solo el dueño del negocio puede crear campañas.</Text>}
      {isOwner && business.is_limited && (
        <Text style={styles.limitedNotice}>
          Tu negocio está limitado: no puedes crear nuevas campañas. Las campañas activas siguen circulando con
          normalidad.
        </Text>
      )}

      {isOwner && !business.is_limited && !showForm && (
        <Button title="+ Crear campaña" onPress={() => setShowForm(true)} style={styles.createButton} />
      )}

      {isOwner && !business.is_limited && showForm && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Alcance</Text>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setNational(true)} style={[styles.chip, national && styles.chipSelected]}>
              <Text style={[styles.chipText, national && styles.chipTextSelected]}>Nacional</Text>
            </Pressable>
            <Pressable onPress={() => setNational(false)} style={[styles.chip, !national && styles.chipSelected]}>
              <Text style={[styles.chipText, !national && styles.chipTextSelected]}>Solo {business.city}</Text>
            </Pressable>
          </View>

          <TextField label="Título" placeholder="20% de descuento en cambio de aceite" value={title} onChangeText={setTitle} />

          <Text style={styles.fieldLabel}>Imagen</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" /> : null}
          <Button
            title={imageUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
            variant="secondary"
            onPress={handlePickImage}
            loading={uploadingImage}
            style={styles.imageButton}
          />

          <TextField
            label="Link al tocar el anuncio (opcional)"
            placeholder="https://wa.me/..."
            value={linkUrl}
            onChangeText={setLinkUrl}
            autoCapitalize="none"
          />
          <TextField label="Duración (días)" keyboardType="numeric" value={durationDays} onChangeText={setDurationDays} />

          <Text style={styles.priceText}>{validDays ? `Total: $${price.toFixed(2)}` : 'Ingresa una duración válida'}</Text>

          <View style={styles.editActions}>
            <Button
              title={validDays ? `Pagar $${price.toFixed(2)}` : 'Pagar'}
              onPress={handleCreate}
              loading={saving}
              style={styles.flexButton}
            />
            <Button title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} style={styles.flexButton} />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tus campañas</Text>
      {ads.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has creado ninguna campaña.</Text>
      ) : (
        <View style={styles.grid}>
          {ads.map((ad) => (
            <View key={ad.id} style={styles.gridItem}>
              <View style={styles.gridImageWrap}>
                <Image source={{ uri: ad.image_url }} style={styles.gridImage} resizeMode="cover" />
                <View style={[styles.statusBadgeOverlay, { backgroundColor: statusColor[ad.status] }]}>
                  <Text style={styles.statusBadgeOverlayText}>{statusLabel[ad.status]}</Text>
                </View>
              </View>
              <Text style={styles.gridTitle} numberOfLines={1}>
                {ad.title}
              </Text>
              <Text style={styles.gridMeta}>{ad.target_city ?? 'Nacional'}</Text>
              <Text style={styles.gridMeta}>
                {new Date(ad.starts_at).toLocaleDateString('es-EC')} – {new Date(ad.ends_at).toLocaleDateString('es-EC')}
              </Text>
              <Text style={styles.gridMeta}>
                {ad.impressions} impresiones · {ad.clicks} clics
              </Text>
              {(ad.status === 'active' || ad.status === 'approved') && isOwner && (
                <Button
                  title="Pausar"
                  variant="secondary"
                  onPress={() => handlePause(ad)}
                  style={styles.gridPauseButton}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  createButton: {
    marginBottom: 16,
  },
  limitedNotice: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.primary,
  },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.background,
  },
  imageButton: {
    marginBottom: 16,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  gridImageWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  gridImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statusBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeOverlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  gridMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  gridPauseButton: {
    marginTop: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
});
