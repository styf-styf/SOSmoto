import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { CategoryPicker } from '../../components/CategoryPicker';
import { InfoButton, InfoExample, InfoModal, InfoStep, infoTextStyles } from '../../components/InfoModal';
import { MultiPhotoPicker } from '../../components/MultiPhotoPicker';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { createAdCampaign, getAdPricing, getBusinessAds, pauseAd, quoteAdPrice } from '../../services/ads';
import { getMyWorkBusiness } from '../../services/businesses';
import { getActiveProducts, getActiveServices } from '../../services/catalog';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Ad, AdKind, AdPricing, Business, Product, Service } from '../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 12;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
const CARD_HEIGHT = Math.round(CARD_WIDTH * (4 / 3));
const MAX_AD_PHOTOS = 3;

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
  const params = useLocalSearchParams<{ openForm?: string }>();
  // Llegada desde el botón "Crear campaña" de Crece tu negocio -- abre el
  // formulario directo en vez de dejar al negocio con un segundo toque en
  // "+ Crear campaña" para llegar a donde ya quería ir.
  const [showForm, setShowForm] = useState(!!params.openForm);

  const [national, setNational] = useState(true);
  const [kind, setKind] = useState<AdKind>('product');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [existingServices, setExistingServices] = useState<Service[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

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
  // Tienda/marca no ofrece servicios -- solo un taller puede anunciar uno
  // (misma regla que el catálogo, ver CLAUDE.md).
  const canChooseKind = business?.business_type === 'workshop';

  // Tienda/marca siempre queda en 'product' (único válido) aunque el chip no se muestre.
  useEffect(() => {
    if (!canChooseKind) setKind('product');
  }, [canChooseKind]);

  useEffect(() => {
    if (!business || mode !== 'existing') return;
    setSelectedItemId(null);
    setLoadingCatalog(true);
    const request = kind === 'product' ? getActiveProducts(business.id) : getActiveServices(business.id);
    request
      .then((items) => (kind === 'product' ? setExistingProducts(items as Product[]) : setExistingServices(items as Service[])))
      .catch((err) => console.error('load catalog for ad error', err))
      .finally(() => setLoadingCatalog(false));
  }, [business, kind, mode]);

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
    if (!business || photos.length >= MAX_AD_PHOTOS) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(business.id);
      if (url) setPhotos((prev) => [...prev, url]);
    } catch (err) {
      console.error('upload ad image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  const existingItems: { id: string; name: string }[] = kind === 'product' ? existingProducts : existingServices;
  const selectedItem = existingItems.find((item) => item.id === selectedItemId) ?? null;

  const parsedDays = Number(durationDays);
  const validDays = Number.isFinite(parsedDays) && parsedDays > 0;
  const price = validDays && pricing
    ? quoteAdPrice(pricing, { targetCity: national ? undefined : business?.city, durationDays: parsedDays })
    : 0;

  function resetForm() {
    setMode('existing');
    setSelectedItemId(null);
    setNewItemName('');
    setNewItemCategoryId('');
    setTitle('');
    setPhotos([]);
    setLinkUrl('');
    setDurationDays('7');
  }

  async function handleCreate() {
    if (!business) return;
    if (mode === 'existing' && !selectedItemId) {
      Alert.alert('Falta elegir', kind === 'product' ? 'Elige un producto de tu catálogo.' : 'Elige un servicio de tu catálogo.');
      return;
    }
    if (mode === 'new' && (!newItemName.trim() || !newItemCategoryId)) {
      Alert.alert('Faltan datos', 'Ingresa el nombre y la categoría de lo que quieres anunciar.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Faltan datos', 'Completa el texto del anuncio.');
      return;
    }
    if (photos.length === 0) {
      Alert.alert('Falta la imagen', 'Sube al menos una foto para el anuncio.');
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
        kind,
        productId: mode === 'existing' && kind === 'product' ? selectedItemId! : undefined,
        serviceId: mode === 'existing' && kind === 'service' ? selectedItemId! : undefined,
        categoryId: mode === 'new' ? newItemCategoryId : undefined,
        itemName: mode === 'existing' ? selectedItem?.name ?? '' : newItemName.trim(),
        title: title.trim(),
        photos,
        linkUrl: linkUrl.trim() || undefined,
        targetCity: national ? undefined : business.city,
        durationDays: parsedDays,
      });
      setShowForm(false);
      resetForm();
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
      <View style={styles.headerRow}>
        <Text style={[styles.helperText, styles.headerRowText]}>
          Todas las campañas son de pago (vía Payphone) y quedan en revisión hasta que el equipo de SOSmoto las
          aprueba. Una vez activa, se muestra automáticamente en inicio, búsqueda y perfiles relevantes — no eliges
          dónde aparece.
        </Text>
        <InfoButton onPress={() => setShowInfo(true)} accessibilityLabel="Cómo funciona la publicidad" size={20} />
      </View>

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

          {canChooseKind && (
            <>
              <Text style={styles.fieldLabel}>¿Qué quieres anunciar?</Text>
              <View style={styles.chipRow}>
                <Pressable onPress={() => setKind('product')} style={[styles.chip, kind === 'product' && styles.chipSelected]}>
                  <Text style={[styles.chipText, kind === 'product' && styles.chipTextSelected]}>Producto</Text>
                </Pressable>
                <Pressable onPress={() => setKind('service')} style={[styles.chip, kind === 'service' && styles.chipSelected]}>
                  <Text style={[styles.chipText, kind === 'service' && styles.chipTextSelected]}>Servicio</Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={styles.fieldLabel}>{kind === 'product' ? 'Producto a anunciar' : 'Servicio a anunciar'}</Text>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setMode('existing')} style={[styles.chip, mode === 'existing' && styles.chipSelected]}>
              <Text style={[styles.chipText, mode === 'existing' && styles.chipTextSelected]}>Ya publicado</Text>
            </Pressable>
            <Pressable onPress={() => setMode('new')} style={[styles.chip, mode === 'new' && styles.chipSelected]}>
              <Text style={[styles.chipText, mode === 'new' && styles.chipTextSelected]}>Nuevo, solo para este anuncio</Text>
            </Pressable>
          </View>

          {mode === 'existing' ? (
            loadingCatalog ? (
              <ActivityIndicator color={colors.primary} style={styles.catalogLoading} />
            ) : existingItems.length === 0 ? (
              <Text style={styles.placeholder}>
                {kind === 'product' ? 'No tienes productos activos en tu catálogo.' : 'No tienes servicios activos en tu catálogo.'}
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {existingItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setSelectedItemId(item.id)}
                    style={[styles.chip, selectedItemId === item.id && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selectedItemId === item.id && styles.chipTextSelected]}>{item.name}</Text>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <>
              <TextField
                label={kind === 'product' ? 'Nombre del producto' : 'Nombre del servicio'}
                placeholder={kind === 'product' ? 'Casco MT' : 'Cambio de aceite'}
                value={newItemName}
                onChangeText={setNewItemName}
              />
              <CategoryPicker kind={kind} value={newItemCategoryId} onChange={(id) => setNewItemCategoryId(id)} />
            </>
          )}

          <TextField label="Texto del anuncio" placeholder="20% de descuento en cambio de aceite" value={title} onChangeText={setTitle} />

          <Text style={styles.fieldLabel}>
            Fotos ({photos.length}/{MAX_AD_PHOTOS})
          </Text>
          <View style={styles.photosRow}>
            <MultiPhotoPicker photos={photos} onRemove={handleRemovePhoto} onAdd={handlePickImage} max={MAX_AD_PHOTOS} uploading={uploadingImage} />
          </View>

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
            <Button title="Cancelar" variant="secondary" onPress={() => { setShowForm(false); resetForm(); }} style={styles.flexButton} />
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
                <Image source={{ uri: ad.photos[0] }} style={styles.gridImage} resizeMode="cover" />
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

      <InfoModal visible={showInfo} title="Cómo funciona la publicidad" onClose={() => setShowInfo(false)}>
        <InfoStep number={1} title="Anuncias un producto o servicio real">
          <Text style={infoTextStyles.text}>
            Puedes elegir un producto o servicio que ya tengas publicado (la categoría se asigna sola), o crear uno
            nuevo solo para este anuncio -- ese ítem nuevo no aparece en tu catálogo normal, existe únicamente para la
            campaña.
          </Text>
        </InfoStep>

        <InfoStep number={2} title="Cómo se calcula el precio">
          <Text style={infoTextStyles.text}>
            El total es <Text style={infoTextStyles.bold}>precio por día × cantidad de días</Text>. El precio por día
            es distinto según el alcance que elijas: "Nacional" cuesta más por día que "Solo tu ciudad".
          </Text>
          <InfoExample label="Ejemplo con los precios de hoy">
            {pricing && (
              <>
                <Text style={infoTextStyles.exampleText}>
                  Nacional: ${Number(pricing.price_per_day_national).toFixed(2)}/día · Solo tu ciudad: $
                  {Number(pricing.price_per_day_city).toFixed(2)}/día
                </Text>
                <Text style={infoTextStyles.exampleText}>
                  Campaña nacional de 7 días → 7 × ${Number(pricing.price_per_day_national).toFixed(2)} = $
                  {(Number(pricing.price_per_day_national) * 7).toFixed(2)}
                </Text>
                <Text style={infoTextStyles.exampleText}>
                  La misma campaña, solo en tu ciudad → 7 × ${Number(pricing.price_per_day_city).toFixed(2)} = $
                  {(Number(pricing.price_per_day_city) * 7).toFixed(2)}
                </Text>
              </>
            )}
            <Text style={infoTextStyles.exampleTextMuted}>Estos precios los define el admin y pueden cambiar.</Text>
          </InfoExample>
        </InfoStep>

        <InfoStep number={3} title="Pagas primero, se revisa después">
          <Text style={infoTextStyles.text}>
            Pagas de una sola vez (vía Payphone) al crear la campaña. Después, un admin de SOSmoto la revisa antes de
            mostrarla a nadie -- para evitar contenido inapropiado o competencia desleal. El estado pasa de
            "Pendiente de revisión" a "Aprobada" (ya circulando) o "Rechazada".
          </Text>
        </InfoStep>

        <InfoStep number={4} title="Dónde aparece">
          <Text style={infoTextStyles.text}>
            Una vez aprobada, se muestra automáticamente en el inicio (mezclada con el carrusel de productos/
            servicios) y como el primer resultado cuando alguien busca justo lo que anuncias -- no hay forma de elegir
            una posición específica.
          </Text>
        </InfoStep>

        <InfoStep number={5} title="Termina sola">
          <Text style={infoTextStyles.text}>
            Al llegar la fecha de fin, la campaña se marca como "Finalizada" y deja de mostrarse sola, sin que tengas
            que hacer nada.
          </Text>
        </InfoStep>

        <InfoStep number={6} title="Impresiones y clics">
          <Text style={infoTextStyles.text}>
            Cada campaña activa muestra cuántas veces se vio (impresiones) y cuántas veces la tocaron (clics), para
            que midas si está funcionando.
          </Text>
        </InfoStep>

        <InfoStep number={7} title='"Pausar" no devuelve el dinero'>
          <Text style={infoTextStyles.text}>
            Pausar detiene que la campaña se siga mostrando, pero no reembolsa lo ya pagado -- revisa bien la
            duración antes de pagar.
          </Text>
        </InfoStep>
      </InfoModal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerRowText: {
    flex: 1,
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
  catalogLoading: {
    marginBottom: 16,
  },
  photosRow: {
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
