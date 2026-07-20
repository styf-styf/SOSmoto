import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MultiPhotoPicker } from './MultiPhotoPicker';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { searchBusinesses, type BusinessWithDistance } from '../services/businesses';
import { createPost, MAX_POST_PHOTOS_CLIENT } from '../services/posts';
import { pickAndUploadClientPostImage } from '../services/storage';
import { searchClients } from '../services/users';

type TagResult =
  | { kind: 'business'; id: string; name: string }
  | { kind: 'client'; id: string; name: string };

export function CreatePostBox({ onCreated }: { onCreated?: () => void }) {
  const { profile } = useAuth();
  const [caption, setCaption] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [posting, setPosting] = useState(false);

  const [taggedItem, setTaggedItem] = useState<TagResult | null>(null);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<TagResult[]>([]);
  const [searchingTag, setSearchingTag] = useState(false);

  async function handlePickImage() {
    if (!profile || photos.length >= MAX_POST_PHOTOS_CLIENT) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadClientPostImage(profile.id);
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

  async function handleSearchTag(text: string) {
    setTagQuery(text);
    if (text.trim().length < 2) {
      setTagResults([]);
      return;
    }
    setSearchingTag(true);
    try {
      const [businesses, clients] = await Promise.all([
        searchBusinesses({ query: text.trim() }),
        searchClients(text.trim()),
      ]);
      const bizResults: TagResult[] = (businesses as BusinessWithDistance[]).slice(0, 4).map((b) => ({ kind: 'business', id: b.id, name: b.name }));
      const clientResults: TagResult[] = clients.slice(0, 3).map((c) => ({ kind: 'client', id: c.id, name: c.full_name }));
      setTagResults([...bizResults, ...clientResults]);
    } catch (err) {
      console.error('search tag error', err);
    } finally {
      setSearchingTag(false);
    }
  }

  function handleSelectTag(item: TagResult) {
    setTaggedItem(item);
    setShowTagSearch(false);
    setTagQuery('');
    setTagResults([]);
  }

  function resetTag() {
    setTaggedItem(null);
    setShowTagSearch(false);
    setTagQuery('');
    setTagResults([]);
  }

  async function handlePublish() {
    if (!profile) return;
    if (!caption.trim() && photos.length === 0) {
      Alert.alert('Falta contenido', 'Agrega una foto, un texto, o ambos.');
      return;
    }
    setPosting(true);
    try {
      await createPost({
        clientId: profile.id,
        caption: caption.trim() || undefined,
        photos,
        tagBusinessId: taggedItem?.kind === 'business' ? taggedItem.id : undefined,
        tagClientId: taggedItem?.kind === 'client' ? taggedItem.id : undefined,
      });
      setCaption('');
      setPhotos([]);
      resetTag();
      onCreated?.();
    } catch (err) {
      console.error('create post error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo publicar.');
    } finally {
      setPosting(false);
    }
  }

  const canPublish = (caption.trim().length > 0 || photos.length > 0) && !posting && !uploadingImage;

  return (
    <View style={styles.card}>
      <View style={styles.inputRow}>
        <Pressable style={styles.iconCircle} onPress={handlePickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.primary} />
          )}
        </Pressable>
        <Pressable
          style={[styles.iconCircle, !!taggedItem && styles.iconCircleActive]}
          onPress={() => (taggedItem ? setTaggedItem(null) : setShowTagSearch((prev) => !prev))}
        >
          <Ionicons name="pricetag-outline" size={20} color={taggedItem ? '#fff' : colors.primary} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="¿Qué quieres compartir?"
          placeholderTextColor={colors.textMuted}
          value={caption}
          onChangeText={setCaption}
          multiline
          blurOnSubmit={false}
        />
        <Pressable style={[styles.sendButton, !canPublish && styles.sendButtonDisabled]} onPress={handlePublish} disabled={!canPublish}>
          {posting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </Pressable>
      </View>

      {photos.length > 0 && (
        <View style={styles.previewWrap}>
          <MultiPhotoPicker
            photos={photos}
            onRemove={handleRemovePhoto}
            onAdd={handlePickImage}
            max={MAX_POST_PHOTOS_CLIENT}
            uploading={uploadingImage}
          />
        </View>
      )}

      {taggedItem ? (
        <View style={styles.tagChip}>
          <Ionicons name={taggedItem.kind === 'business' ? 'storefront' : 'person'} size={12} color={colors.primary} />
          <Text numberOfLines={1} style={styles.tagChipText}>
            {taggedItem.name}
          </Text>
          <Pressable onPress={() => setTaggedItem(null)}>
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : showTagSearch ? (
        <View style={styles.tagSearchWrap}>
          <TextInput
            style={styles.tagSearchInput}
            placeholder="Buscar negocio o cliente…"
            placeholderTextColor={colors.textMuted}
            value={tagQuery}
            onChangeText={handleSearchTag}
            autoFocus
          />
          {searchingTag && <ActivityIndicator color={colors.primary} size="small" style={styles.tagSearchSpinner} />}
          {tagResults.map((item) => (
            <Pressable key={`${item.kind}-${item.id}`} style={styles.tagResultItem} onPress={() => handleSelectTag(item)}>
              <Ionicons name={item.kind === 'business' ? 'storefront' : 'person'} size={14} color={colors.primary} />
              <Text style={styles.tagResultText}>{item.name}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowTagSearch(false)}>
            <Text style={styles.cancelTagText}>Cancelar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: colors.primary,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  previewWrap: {
    marginTop: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E6',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    maxWidth: '100%',
  },
  tagChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  tagSearchWrap: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  tagSearchInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  tagSearchSpinner: {
    marginTop: 8,
  },
  tagResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  tagResultText: {
    fontSize: 13,
    color: colors.text,
    flexShrink: 1,
  },
  cancelTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
