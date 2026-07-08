import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { searchBusinesses, type BusinessWithDistance } from '../services/businesses';
import { createPost } from '../services/posts';
import { pickAndUploadBusinessImage } from '../services/storage';

export function CreateBusinessPostBox({ businessId, onCreated }: { businessId: string; onCreated?: () => void }) {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [posting, setPosting] = useState(false);

  const [taggedBusiness, setTaggedBusiness] = useState<BusinessWithDistance | null>(null);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<BusinessWithDistance[]>([]);
  const [searchingTag, setSearchingTag] = useState(false);

  async function handlePickImage() {
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload post image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSearchTag(text: string) {
    setTagQuery(text);
    if (text.trim().length < 2) {
      setTagResults([]);
      return;
    }
    setSearchingTag(true);
    try {
      const results = await searchBusinesses({ query: text.trim() });
      setTagResults(results.slice(0, 6));
    } catch (err) {
      console.error('search business error', err);
    } finally {
      setSearchingTag(false);
    }
  }

  function handleSelectTag(business: BusinessWithDistance) {
    setTaggedBusiness(business);
    setShowTagSearch(false);
    setTagQuery('');
    setTagResults([]);
  }

  function resetTag() {
    setTaggedBusiness(null);
    setShowTagSearch(false);
    setTagQuery('');
    setTagResults([]);
  }

  async function handlePublish() {
    if (!caption.trim() && !imageUrl) {
      Alert.alert('Falta contenido', 'Agrega una foto, un texto, o ambos.');
      return;
    }
    setPosting(true);
    try {
      await createPost({
        businessId,
        caption: caption.trim() || undefined,
        imageUrl: imageUrl || undefined,
        tagBusinessId: taggedBusiness?.id,
      });
      setCaption('');
      setImageUrl('');
      resetTag();
      onCreated?.();
    } catch (err) {
      console.error('create post error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo publicar.');
    } finally {
      setPosting(false);
    }
  }

  const canPublish = (caption.trim().length > 0 || !!imageUrl) && !posting && !uploadingImage;

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
          style={[styles.iconCircle, !!taggedBusiness && styles.iconCircleActive]}
          onPress={() => (taggedBusiness ? setTaggedBusiness(null) : setShowTagSearch((prev) => !prev))}
        >
          <Ionicons name="pricetag-outline" size={20} color={taggedBusiness ? '#fff' : colors.primary} />
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="¿Qué quieres compartir?"
          placeholderTextColor={colors.textMuted}
          value={caption}
          onChangeText={setCaption}
        />
        <Pressable style={[styles.sendButton, !canPublish && styles.sendButtonDisabled]} onPress={handlePublish} disabled={!canPublish}>
          {posting ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
        </Pressable>
      </View>

      {imageUrl ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" />
          <Pressable style={styles.removeImage} onPress={() => setImageUrl('')}>
            <Ionicons name="close" size={14} color="#fff" />
          </Pressable>
        </View>
      ) : null}

      {taggedBusiness ? (
        <View style={styles.tagChip}>
          <Ionicons name="pricetag" size={12} color={colors.primary} />
          <Text numberOfLines={1} style={styles.tagChipText}>
            {taggedBusiness.name}
          </Text>
          <Pressable onPress={() => setTaggedBusiness(null)}>
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : showTagSearch ? (
        <View style={styles.tagSearchWrap}>
          <TextInput
            style={styles.tagSearchInput}
            placeholder="Buscar taller o tienda…"
            placeholderTextColor={colors.textMuted}
            value={tagQuery}
            onChangeText={handleSearchTag}
            autoFocus
          />
          {searchingTag && <ActivityIndicator color={colors.primary} size="small" style={styles.tagSearchSpinner} />}
          {tagResults.map((b) => (
            <Pressable key={b.id} style={styles.tagResultItem} onPress={() => handleSelectTag(b)}>
              <Ionicons name="storefront" size={14} color={colors.primary} />
              <Text style={styles.tagResultText}>{b.name}</Text>
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
    alignItems: 'center',
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
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
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
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  removeImage: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
