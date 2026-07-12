import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { MultiPhotoPicker } from '../../components/MultiPhotoPicker';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness } from '../../services/businesses';
import { getActiveProducts, getActiveServices, getPlanLimits } from '../../services/catalog';
import { getMyEmployeeRecord } from '../../services/employees';
import { createPost, deletePost, getMyBusinessPosts } from '../../services/posts';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Business, Post, Product, Service } from '../../types/database';

type TagKind = 'none' | 'service' | 'product';

interface BusinessPublicacionesData {
  business: Business | null;
  isOwner: boolean;
  canCreatePosts: boolean;
  posts: Post[];
  maxPhotos: number;
}

export default function BusinessPublicacionesScreen() {
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [tagKind, setTagKind] = useState<TagKind>('none');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `business-publicaciones-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<BusinessPublicacionesData>(cacheKey, async () => {
    const empty: BusinessPublicacionesData = { business: null, isOwner: false, canCreatePosts: false, posts: [], maxPhotos: 1 };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    const [myPosts, limits, employeeRecord] = await Promise.all([
      getMyBusinessPosts(work.business.id),
      getPlanLimits(work.business.id),
      work.isOwner ? Promise.resolve(null) : getMyEmployeeRecord(work.business.id, profile.id),
    ]);
    return {
      business: work.business,
      isOwner: work.isOwner,
      canCreatePosts: work.isOwner || (employeeRecord?.can_create_posts ?? false),
      posts: myPosts,
      maxPhotos: limits.maxPhotosPerItem ?? 5,
    };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;
  const canCreatePosts = data?.canCreatePosts ?? false;
  const posts = data?.posts ?? [];
  // Tope de fotos por publicación según el plan del negocio (mismo campo que
  // products/services: Free 1, Estándar 3, Pro 5).
  const maxPhotos = data?.maxPhotos ?? 1;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load business posts error', err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!business) return;
    if (tagKind === 'service' && services.length === 0) {
      getActiveServices(business.id).then(setServices).catch((err) => console.error('load services error', err));
    }
    if (tagKind === 'product' && products.length === 0) {
      getActiveProducts(business.id).then(setProducts).catch((err) => console.error('load products error', err));
    }
  }, [tagKind, business, services.length, products.length]);

  function resetForm() {
    setPhotos([]);
    setCaption('');
    setTagKind('none');
    setTargetId(null);
  }

  function handleAddPress() {
    resetForm();
    setShowForm(true);
  }

  async function handlePickImage() {
    if (!business || photos.length >= maxPhotos) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(business.id);
      if (url) setPhotos((prev) => [...prev, url]);
    } catch (err) {
      console.error('upload post image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate() {
    if (!business) return;
    if (photos.length === 0 && !caption.trim()) {
      Alert.alert('Falta contenido', 'Agrega una foto, un texto, o ambos.');
      return;
    }
    if ((tagKind === 'service' || tagKind === 'product') && !targetId) {
      Alert.alert('Falta elegir', tagKind === 'service' ? 'Elige un servicio.' : 'Elige un producto.');
      return;
    }
    setSaving(true);
    try {
      const created = await createPost({
        businessId: business.id,
        photos,
        caption: caption.trim() || undefined,
        tagServiceId: tagKind === 'service' ? targetId ?? undefined : undefined,
        tagProductId: tagKind === 'product' ? targetId ?? undefined : undefined,
      });
      setData((prev) => (prev ? { ...prev, posts: [created, ...prev.posts] } : prev));
      setShowForm(false);
    } catch (err) {
      console.error('create post error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo publicar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post: Post) {
    try {
      await deletePost(post.id);
      setData((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== post.id) } : prev));
    } catch (err) {
      console.error('delete post error', err);
      Alert.alert('Error', 'No se pudo eliminar la publicación.');
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
      <Text style={styles.helperText}>Foto y texto permanentes, visibles para toda la comunidad.</Text>

      {!canCreatePosts && <Text style={styles.helperText}>No tienes permiso para publicar en este negocio.</Text>}
      {canCreatePosts && business.is_limited && (
        <Text style={styles.limitedNotice}>Tu negocio está limitado: no puedes crear nuevas publicaciones.</Text>
      )}

      {canCreatePosts && !business.is_limited && !showForm && (
        <Button title="+ Nueva publicación" onPress={handleAddPress} style={styles.createButton} />
      )}

      {canCreatePosts && !business.is_limited && showForm && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Fotos ({photos.length}/{maxPhotos})</Text>
          <View style={styles.imageButton}>
            <MultiPhotoPicker
              photos={photos}
              onRemove={handleRemovePhoto}
              onAdd={handlePickImage}
              max={maxPhotos}
              uploading={uploadingImage}
            />
          </View>

          <TextField label="Texto" placeholder="Cuéntale algo a tus clientes" value={caption} onChangeText={setCaption} />

          <Text style={styles.fieldLabel}>Etiquetar (opcional)</Text>
          <View style={styles.chipRow}>
            {(
              [
                { label: 'Ninguno', value: 'none' as TagKind },
                { label: 'Servicio', value: 'service' as TagKind },
                { label: 'Producto', value: 'product' as TagKind },
              ]
            ).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setTagKind(opt.value);
                  setTargetId(null);
                }}
                style={[styles.chip, tagKind === opt.value && styles.chipSelected]}
              >
                <Text style={[styles.chipText, tagKind === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          {tagKind === 'service' && (
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

          {tagKind === 'product' && (
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

          <View style={styles.editActions}>
            <Button title="Publicar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} style={styles.flexButton} />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tus publicaciones</Text>
      {posts.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has publicado nada.</Text>
      ) : (
        posts.map((post) => (
          <Pressable key={post.id} style={styles.postCard} onPress={() => router.push(`/(business)/publicacion/${post.id}`)}>
            {post.photos[0] ? (
              <Image source={{ uri: post.photos[0] }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="document-text-outline" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.postInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {post.caption || '(sin texto)'}
              </Text>
              <Text style={styles.cardMeta}>{post.comments_count} comentario(s)</Text>
              {isOwner && (
                <Button title="Eliminar" variant="secondary" onPress={() => handleDelete(post)} style={styles.deleteButton} />
              )}
            </View>
          </Pressable>
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
    marginTop: 4,
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
  postCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postInfo: {
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
