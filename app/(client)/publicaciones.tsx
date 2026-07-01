import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { searchBusinesses, type BusinessWithDistance } from '../../services/businesses';
import { createPost, deletePost, getMyClientPosts } from '../../services/posts';
import { pickAndUploadClientPostImage } from '../../services/storage';
import type { Post } from '../../types/database';

export default function ClientPublicacionesScreen() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<BusinessWithDistance[]>([]);
  const [searching, setSearching] = useState(false);
  const [taggedBusiness, setTaggedBusiness] = useState<BusinessWithDistance | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const myPosts = await getMyClientPosts(profile.id);
    setPosts(myPosts);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load client posts error', err))
      .finally(() => setLoading(false));
  }, [load]);

  function resetForm() {
    setImageUrl('');
    setCaption('');
    setTagQuery('');
    setTagResults([]);
    setTaggedBusiness(null);
  }

  function handleAddPress() {
    resetForm();
    setShowForm(true);
  }

  async function handlePickImage() {
    if (!profile) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadClientPostImage(profile.id);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload post image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSearchBusiness(text: string) {
    setTagQuery(text);
    setTaggedBusiness(null);
    if (text.trim().length < 2) {
      setTagResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchBusinesses({ query: text.trim() });
      setTagResults(results.slice(0, 8));
    } catch (err) {
      console.error('search business error', err);
    } finally {
      setSearching(false);
    }
  }

  async function handleCreate() {
    if (!profile) return;
    if (!imageUrl.trim() && !caption.trim()) {
      Alert.alert('Falta contenido', 'Agrega una foto, un texto, o ambos.');
      return;
    }
    setSaving(true);
    try {
      const created = await createPost({
        clientId: profile.id,
        imageUrl: imageUrl.trim() || undefined,
        caption: caption.trim() || undefined,
        tagBusinessId: taggedBusiness?.id,
      });
      setPosts((prev) => [created, ...prev]);
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
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.helperText}>Foto y texto permanentes, visibles para toda la comunidad.</Text>

      {profile?.is_limited && (
        <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes crear nuevas publicaciones.</Text>
      )}
      {!showForm && !profile?.is_limited && (
        <Button title="+ Nueva publicación" onPress={handleAddPress} style={styles.createButton} />
      )}

      {showForm && (
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

          <TextField label="Texto" placeholder="Cuéntanos qué pasó" value={caption} onChangeText={setCaption} />

          <Text style={styles.fieldLabel}>Etiquetar un negocio (opcional)</Text>
          {taggedBusiness ? (
            <Pressable style={[styles.chip, styles.chipSelected, styles.pinChip]} onPress={() => setTaggedBusiness(null)}>
              <Text style={[styles.chipText, styles.chipTextSelected]}>✓ {taggedBusiness.name} (quitar)</Text>
            </Pressable>
          ) : (
            <>
              <TextField label="Buscar negocio" placeholder="Buscar taller o tienda…" value={tagQuery} onChangeText={handleSearchBusiness} />
              {searching && <ActivityIndicator color={colors.primary} style={styles.searchSpinner} />}
              {tagResults.length > 0 && (
                <View style={styles.chipRow}>
                  {tagResults.map((b) => (
                    <Pressable key={b.id} onPress={() => setTaggedBusiness(b)} style={styles.chip}>
                      <Text style={styles.chipText}>{b.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
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
          <Pressable key={post.id} style={styles.postCard} onPress={() => router.push(`/(client)/publicacion/${post.id}`)}>
            {post.image_url ? (
              <Image source={{ uri: post.image_url }} style={styles.thumb} resizeMode="cover" />
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
              <Button title="Eliminar" variant="secondary" onPress={() => handleDelete(post)} style={styles.deleteButton} />
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
    marginTop: 8,
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
    marginTop: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  searchSpinner: {
    marginTop: 8,
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
    height: 96,
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
