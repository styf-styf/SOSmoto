import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getActiveProducts, getActiveServices, getPlanLimits, type PlanLimits } from '../../services/catalog';
import { getMyWorkBusiness } from '../../services/businesses';
import { createStory, deleteStory, getBusinessStories, isStoryVisible } from '../../services/stories';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Business, Product, Service, Story, StoryActionType } from '../../types/database';

const templates = ['Promo del día', 'Antes/Después', 'Nuevo producto', 'Cupo disponible hoy'];

const actionOptions: { label: string; value: StoryActionType }[] = [
  { label: 'Ninguno', value: 'none' },
  { label: 'Ver servicio', value: 'service' },
  { label: 'Ver producto', value: 'product' },
  { label: 'Contactar', value: 'contact' },
];

export default function HistoriasScreen() {
  const { profile } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [plan, setPlan] = useState<PlanLimits | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [actionType, setActionType] = useState<StoryActionType>('none');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusiness(work.business);
    setIsOwner(work.isOwner);
    const [planLimits, businessStories] = await Promise.all([
      getPlanLimits(work.business.id),
      getBusinessStories(work.business.id),
    ]);
    setPlan(planLimits);
    setStories(businessStories);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load historias error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!business) return;
    if (actionType === 'service' && services.length === 0) {
      getActiveServices(business.id).then(setServices).catch((err) => console.error('load services error', err));
    }
    if (actionType === 'product' && products.length === 0) {
      getActiveProducts(business.id).then(setProducts).catch((err) => console.error('load products error', err));
    }
  }, [actionType, business, services.length, products.length]);

  const activeCount = stories.filter(isStoryVisible).length;
  const atLimit = plan?.maxActiveStories !== null && activeCount >= (plan?.maxActiveStories ?? Infinity);
  const canPin = plan?.planName === 'pro';

  function resetForm() {
    setImageUrl('');
    setCaption('');
    setActionType('none');
    setTargetId(null);
    setIsPinned(false);
  }

  function handleAddPress() {
    if (atLimit) {
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${plan?.planName} permite hasta ${plan?.maxActiveStories} historia(s) activa(s). Sube de plan para subir más.`
      );
      return;
    }
    resetForm();
    setShowForm(true);
  }

  async function handlePickImage() {
    if (!business) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(business.id);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload story image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreate() {
    if (!business) return;
    if (!imageUrl.trim()) {
      Alert.alert('Falta la imagen', 'Selecciona una foto para la historia.');
      return;
    }
    if ((actionType === 'service' || actionType === 'product') && !targetId) {
      Alert.alert('Falta elegir', actionType === 'service' ? 'Elige un servicio.' : 'Elige un producto.');
      return;
    }
    setSaving(true);
    try {
      const created = await createStory({
        businessId: business.id,
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        actionType,
        actionTargetId: actionType === 'service' || actionType === 'product' ? targetId ?? undefined : undefined,
        isPinned: canPin ? isPinned : false,
      });
      setStories((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (err) {
      console.error('create story error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la historia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(story: Story) {
    try {
      await deleteStory(story.id);
      setStories((prev) => prev.filter((s) => s.id !== story.id));
    } catch (err) {
      console.error('delete story error', err);
      Alert.alert('Error', 'No se pudo eliminar la historia.');
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Historias</Text>
      <Text style={styles.helperText}>
        Foto visible 24h para tus clientes. {plan?.maxActiveStories === null ? 'Tu plan permite historias ilimitadas.' : `${activeCount}/${plan?.maxActiveStories ?? 0} historias activas según tu plan ${plan?.planName}.`}
      </Text>

      {!isOwner && <Text style={styles.helperText}>Solo el dueño del negocio puede subir historias.</Text>}
      {isOwner && business.is_limited && (
        <Text style={styles.limitedNotice}>Tu negocio está limitado: no puedes subir nuevas historias.</Text>
      )}

      {isOwner && !business.is_limited && !showForm && (
        <Button title="+ Nueva historia" onPress={handleAddPress} style={styles.createButton} />
      )}

      {isOwner && !business.is_limited && showForm && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Imagen</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" /> : null}
          <Button
            title={imageUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
            variant="secondary"
            onPress={handlePickImage}
            loading={uploadingImage}
            style={styles.imageButton}
          />

          <Text style={styles.fieldLabel}>Plantilla (opcional)</Text>
          <View style={styles.chipRow}>
            {templates.map((t) => (
              <Pressable key={t} onPress={() => setCaption(t)} style={[styles.chip, caption === t && styles.chipSelected]}>
                <Text style={[styles.chipText, caption === t && styles.chipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Texto" placeholder="20% de descuento hoy" value={caption} onChangeText={setCaption} />

          <Text style={styles.fieldLabel}>Botón de acción</Text>
          <View style={styles.chipRow}>
            {actionOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setActionType(opt.value);
                  setTargetId(null);
                }}
                style={[styles.chip, actionType === opt.value && styles.chipSelected]}
              >
                <Text style={[styles.chipText, actionType === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          {actionType === 'service' && (
            <View style={styles.chipRow}>
              {services.length === 0 ? (
                <Text style={styles.placeholder}>No tienes servicios activos.</Text>
              ) : (
                services.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setTargetId(s.id)}
                    style={[styles.chip, targetId === s.id && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, targetId === s.id && styles.chipTextSelected]}>{s.name}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {actionType === 'product' && (
            <View style={styles.chipRow}>
              {products.length === 0 ? (
                <Text style={styles.placeholder}>No tienes productos activos.</Text>
              ) : (
                products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setTargetId(p.id)}
                    style={[styles.chip, targetId === p.id && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, targetId === p.id && styles.chipTextSelected]}>{p.name}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {canPin && (
            <Pressable onPress={() => setIsPinned((v) => !v)} style={[styles.chip, isPinned && styles.chipSelected, styles.pinChip]}>
              <Text style={[styles.chipText, isPinned && styles.chipTextSelected]}>
                {isPinned ? '✓ Fijada como destacado permanente' : 'Fijar como destacado permanente'}
              </Text>
            </Pressable>
          )}

          <View style={styles.editActions}>
            <Button title="Publicar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} style={styles.flexButton} />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tus historias</Text>
      {stories.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has subido ninguna historia.</Text>
      ) : (
        stories.map((story) => (
          <View key={story.id} style={styles.storyCard}>
            <Image source={{ uri: story.image_url }} style={styles.thumb} resizeMode="cover" />
            <View style={styles.storyInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {story.caption || '(sin texto)'}
              </Text>
              <Text style={styles.cardMeta}>
                {isStoryVisible(story) ? (story.is_pinned ? 'Destacada' : 'Activa') : 'Expirada'}
                {' · '}
                {story.views} vistas · {story.clicks} clics
              </Text>
              {isOwner && (
                <Button title="Eliminar" variant="secondary" onPress={() => handleDelete(story)} style={styles.deleteButton} />
              )}
            </View>
          </View>
        ))
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
    padding: 20,
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
  pinChip: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.background,
  },
  imageButton: {
    marginBottom: 16,
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
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
  storyCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  storyInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  deleteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
