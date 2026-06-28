import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { getActiveProducts, getActiveServices } from '../services/catalog';
import { createPost } from '../services/posts';
import { pickAndUploadBusinessImage } from '../services/storage';
import type { Product, Service } from '../types/database';

type TagKind = 'service' | 'product';
type TaggedItem = { kind: TagKind; id: string; name: string };

// Versión de negocio de CreatePostBox (cliente) -- mismo composer compacto
// sobre el feed de Inicio, pero la etiqueta es un servicio/producto del
// propio catálogo en vez de buscar otro negocio.
export function CreateBusinessPostBox({ businessId, onCreated }: { businessId: string; onCreated?: () => void }) {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [posting, setPosting] = useState(false);

  const [taggedItem, setTaggedItem] = useState<TaggedItem | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagKind, setTagKind] = useState<TagKind>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!showTagPicker) return;
    if (tagKind === 'service' && services.length === 0) {
      getActiveServices(businessId).then(setServices).catch((err) => console.error('load services error', err));
    }
    if (tagKind === 'product' && products.length === 0) {
      getActiveProducts(businessId).then(setProducts).catch((err) => console.error('load products error', err));
    }
  }, [showTagPicker, tagKind, businessId, services.length, products.length]);

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

  function resetTag() {
    setTaggedItem(null);
    setShowTagPicker(false);
    setTagKind('service');
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
        tagServiceId: taggedItem?.kind === 'service' ? taggedItem.id : undefined,
        tagProductId: taggedItem?.kind === 'product' ? taggedItem.id : undefined,
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
  const tagItems: { id: string; name: string }[] = tagKind === 'service' ? services : products;

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
          onPress={() => (taggedItem ? setTaggedItem(null) : setShowTagPicker((prev) => !prev))}
        >
          <Ionicons name="pricetag-outline" size={20} color={taggedItem ? '#fff' : colors.primary} />
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

      {taggedItem ? (
        <View style={styles.tagChip}>
          <Ionicons name="pricetag" size={12} color={colors.primary} />
          <Text numberOfLines={1} style={styles.tagChipText}>
            {taggedItem.name}
          </Text>
          <Pressable onPress={() => setTaggedItem(null)}>
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : showTagPicker ? (
        <View style={styles.tagPickerWrap}>
          <View style={styles.tagKindRow}>
            <Pressable
              style={[styles.tagKindChip, tagKind === 'service' && styles.tagKindChipSelected]}
              onPress={() => setTagKind('service')}
            >
              <Text style={[styles.tagKindText, tagKind === 'service' && styles.tagKindTextSelected]}>Servicio</Text>
            </Pressable>
            <Pressable
              style={[styles.tagKindChip, tagKind === 'product' && styles.tagKindChipSelected]}
              onPress={() => setTagKind('product')}
            >
              <Text style={[styles.tagKindText, tagKind === 'product' && styles.tagKindTextSelected]}>Producto</Text>
            </Pressable>
          </View>
          {tagItems.length === 0 ? (
            <Text style={styles.tagEmptyText}>
              {tagKind === 'service' ? 'No tienes servicios activos.' : 'No tienes productos activos.'}
            </Text>
          ) : (
            tagItems.map((item) => (
              <Pressable
                key={item.id}
                style={styles.tagResultItem}
                onPress={() => {
                  setTaggedItem({ kind: tagKind, id: item.id, name: item.name });
                  setShowTagPicker(false);
                }}
              >
                <Ionicons name={tagKind === 'service' ? 'construct-outline' : 'cube-outline'} size={14} color={colors.primary} />
                <Text style={styles.tagResultText}>{item.name}</Text>
              </Pressable>
            ))
          )}
          <Pressable onPress={() => setShowTagPicker(false)}>
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
  tagPickerWrap: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  tagKindRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tagKindChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagKindChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  tagKindText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tagKindTextSelected: {
    color: colors.primary,
  },
  tagEmptyText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
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
