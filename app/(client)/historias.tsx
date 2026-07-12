import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { createStory, deleteStory, getClientActiveStoryCount, getClientStories, isStoryVisible } from '../../services/stories';
import { pickAndUploadClientStoryImage } from '../../services/storage';
import type { Story } from '../../types/database';

const CLIENT_DAILY_LIMIT = 3;

const templates = ['Mi moto', 'En ruta', 'Antes/Después', 'Recomiendo este taller'];

export default function ClientHistoriasScreen() {
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `client-historias-${profile.id}` : null;
  const { data, loading, reload, setData: setStories } = useCachedLoad<Story[]>(cacheKey, async () => {
    if (!profile) return [];
    return getClientStories(profile.id);
  });
  const stories = data ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load client historias error', err);
    } finally {
      setRefreshing(false);
    }
  }

  const activeCount = stories.filter(isStoryVisible).length;
  const atLimit = activeCount >= CLIENT_DAILY_LIMIT;

  function resetForm() {
    setImageUrl('');
    setCaption('');
  }

  async function handleAddPress() {
    if (!profile) return;
    if (atLimit) {
      Alert.alert('Límite diario alcanzado', `Puedes subir hasta ${CLIENT_DAILY_LIMIT} historias por día.`);
      return;
    }
    try {
      const freshCount = await getClientActiveStoryCount(profile.id);
      if (freshCount >= CLIENT_DAILY_LIMIT) {
        Alert.alert('Límite diario alcanzado', `Puedes subir hasta ${CLIENT_DAILY_LIMIT} historias por día.`);
        return;
      }
    } catch {
      // si falla la verificación, deja intentar (el trigger del DB lo bloquea de todas formas)
    }
    resetForm();
    setShowForm(true);
  }

  async function handlePickImage() {
    if (!profile) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadClientStoryImage(profile.id);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload client story image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreate() {
    if (!profile) return;
    if (!imageUrl.trim()) {
      Alert.alert('Falta la imagen', 'Selecciona una foto para la historia.');
      return;
    }
    setSaving(true);
    try {
      const created = await createStory({
        clientId: profile.id,
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        actionType: 'none',
      });
      setStories((prev) => [created, ...(prev ?? [])]);
      setShowForm(false);
    } catch (err) {
      console.error('create client story error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la historia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(story: Story) {
    try {
      await deleteStory(story.id);
      setStories((prev) => (prev ?? []).filter((s) => s.id !== story.id));
    } catch (err) {
      console.error('delete client story error', err);
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

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Text style={styles.helperText}>
        Foto visible 24h para toda la comunidad. {activeCount}/{CLIENT_DAILY_LIMIT} historias activas hoy.
      </Text>

      {profile?.is_limited && (
        <Text style={styles.limitedNotice}>Tu cuenta está limitada: no puedes subir nuevas historias.</Text>
      )}
      {!showForm && !profile?.is_limited && (
        <Button title="+ Nueva historia" onPress={handleAddPress} style={styles.createButton} />
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

          <Text style={styles.fieldLabel}>Plantilla (opcional)</Text>
          <View style={styles.chipRow}>
            {templates.map((t) => (
              <Pressable key={t} onPress={() => setCaption(t)} style={[styles.chip, caption === t && styles.chipSelected]}>
                <Text style={[styles.chipText, caption === t && styles.chipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Texto" placeholder="Listo para rodar" value={caption} onChangeText={setCaption} />

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
                {isStoryVisible(story) ? 'Activa' : 'Expirada'}
                {' · '}
                {story.views} vistas · {story.clicks} clics
              </Text>
              <Button title="Eliminar" variant="secondary" onPress={() => handleDelete(story)} style={styles.deleteButton} />
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
