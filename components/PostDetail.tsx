import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { MultiPhotoPicker } from './MultiPhotoPicker';
import { PhotoCarousel } from './PhotoCarousel';
import { ReportModal } from './ReportModal';
import { TextField } from './TextField';
import { colors } from '../constants/colors';
import { useAccountLimited } from '../hooks/useAccountLimited';
import { useAuth } from '../hooks/useAuth';
import { searchBusinesses, type BusinessWithDistance } from '../services/businesses';
import { getActiveProducts, getActiveServices, getPlanLimits } from '../services/catalog';
import {
  createComment,
  deletePost,
  getComments,
  getPostAuthorAvatar,
  getPostAuthorName,
  getPostById,
  getPostTag,
  updatePost,
  MAX_POST_PHOTOS_CLIENT,
  type PostCommentWithAuthor,
  type PostWithAuthor,
} from '../services/posts';
import { createReport } from '../services/reports';
import { pickAndUploadBusinessImage, pickAndUploadClientPostImage } from '../services/storage';
import { searchClients } from '../services/users';
import type { Product, Service } from '../types/database';

type EditTagSelection =
  | { kind: 'none' }
  | { kind: 'business'; id: string; name: string }
  | { kind: 'client'; id: string; name: string }
  | { kind: 'service'; id: string; name: string }
  | { kind: 'product'; id: string; name: string };

function tagIconForKind(kind: EditTagSelection['kind']): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'business':
      return 'storefront';
    case 'client':
      return 'person';
    case 'service':
      return 'construct';
    case 'product':
      return 'cube';
    default:
      return 'pricetag';
  }
}

export function PostDetail({ postId, userRole = 'client' }: { postId: string; userRole?: 'client' | 'business' }) {
  const { profile } = useAuth();
  const { isLimited } = useAccountLimited();
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [comments, setComments] = useState<PostCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const [showReportModal, setShowReportModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMaxPhotos, setEditMaxPhotos] = useState(MAX_POST_PHOTOS_CLIENT);

  const [editTag, setEditTag] = useState<EditTagSelection>({ kind: 'none' });
  const [editTagPanel, setEditTagPanel] = useState<'none' | 'search' | 'service' | 'product'>('none');
  const [editTagQuery, setEditTagQuery] = useState('');
  const [editTagResults, setEditTagResults] = useState<EditTagSelection[]>([]);
  const [searchingEditTag, setSearchingEditTag] = useState(false);
  const [editTagServices, setEditTagServices] = useState<Service[]>([]);
  const [editTagProducts, setEditTagProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const [postResult, commentsResult] = await Promise.all([getPostById(postId), getComments(postId)]);
    setPost(postResult);
    setComments(commentsResult);
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load post detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSend() {
    if (!profile || !text.trim() || isLimited) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const comment = await createComment(postId, profile.id, body);
      setComments((prev) => [...prev, { ...comment, users: { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url } }]);
      setPost((prev) => (prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev));
    } catch (err) {
      console.error('send comment error', err);
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Esta publicación ya no está disponible.</Text>
      </View>
    );
  }

  const authorName = getPostAuthorName(post);
  const avatarUrl = getPostAuthorAvatar(post);
  const isBusiness = !!post.author_business;
  const tag = getPostTag(post, userRole);
  const prefix = userRole === 'business' ? '/(business)' : '/(client)';
  const isOwner =
    (isBusiness && post.author_business?.owner_id === profile?.id) ||
    (!isBusiness && post.author_client?.id === profile?.id);

  async function openEditModal() {
    if (!post) return;
    setEditCaption(post.caption ?? '');
    setEditPhotos(post.photos);
    if (post.tag_business) setEditTag({ kind: 'business', id: post.tag_business.id, name: post.tag_business.name });
    else if (post.tag_client) setEditTag({ kind: 'client', id: post.tag_client.id, name: post.tag_client.full_name });
    else if (post.tag_service) setEditTag({ kind: 'service', id: post.tag_service.id, name: post.tag_service.name });
    else if (post.tag_product) setEditTag({ kind: 'product', id: post.tag_product.id, name: post.tag_product.name });
    else setEditTag({ kind: 'none' });
    setEditTagPanel('none');
    setEditTagQuery('');
    setEditTagResults([]);
    if (isBusiness && post.business_id) {
      try {
        const limits = await getPlanLimits(post.business_id);
        setEditMaxPhotos(limits.maxPhotosPerItem ?? 5);
      } catch (err) {
        console.error('load plan limits error', err);
      }
    } else {
      setEditMaxPhotos(MAX_POST_PHOTOS_CLIENT);
    }
    setShowEditModal(true);
  }

  async function openTagPanel(panel: 'search' | 'service' | 'product') {
    setEditTagPanel(panel);
    if (panel === 'service' && editTagServices.length === 0 && post?.business_id) {
      try {
        setEditTagServices(await getActiveServices(post.business_id));
      } catch (err) {
        console.error('load services error', err);
      }
    }
    if (panel === 'product' && editTagProducts.length === 0 && post?.business_id) {
      try {
        setEditTagProducts(await getActiveProducts(post.business_id));
      } catch (err) {
        console.error('load products error', err);
      }
    }
  }

  async function handleEditTagSearch(value: string) {
    setEditTagQuery(value);
    if (value.trim().length < 2) {
      setEditTagResults([]);
      return;
    }
    setSearchingEditTag(true);
    try {
      const [businesses, clients] = await Promise.all([
        searchBusinesses({ query: value.trim() }),
        searchClients(value.trim()),
      ]);
      const bizResults: EditTagSelection[] = (businesses as BusinessWithDistance[])
        .slice(0, 4)
        .map((b) => ({ kind: 'business', id: b.id, name: b.name }));
      const clientResults: EditTagSelection[] = clients
        .slice(0, 3)
        .map((c) => ({ kind: 'client', id: c.id, name: c.full_name }));
      setEditTagResults([...bizResults, ...clientResults]);
    } catch (err) {
      console.error('search tag error', err);
    } finally {
      setSearchingEditTag(false);
    }
  }

  function selectEditTag(selection: EditTagSelection) {
    setEditTag(selection);
    setEditTagPanel('none');
    setEditTagQuery('');
    setEditTagResults([]);
  }

  async function handlePickEditPhoto() {
    if (!post || editPhotos.length >= editMaxPhotos) return;
    setUploadingEditPhoto(true);
    try {
      const url =
        isBusiness && post.business_id
          ? await pickAndUploadBusinessImage(post.business_id)
          : await pickAndUploadClientPostImage(profile?.id ?? '');
      if (url) setEditPhotos((prev) => [...prev, url]);
    } catch (err) {
      console.error('upload edit post image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingEditPhoto(false);
    }
  }

  function handleRemoveEditPhoto(index: number) {
    setEditPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveEdit() {
    if (!post) return;
    if (!editCaption.trim() && editPhotos.length === 0) {
      Alert.alert('Falta contenido', 'Agrega una foto, un texto, o ambos.');
      return;
    }
    setSavingEdit(true);
    try {
      await updatePost(post.id, {
        caption: editCaption.trim() || null,
        photos: editPhotos,
        tag_business_id: editTag.kind === 'business' ? editTag.id : null,
        tag_client_id: editTag.kind === 'client' ? editTag.id : null,
        tag_service_id: editTag.kind === 'service' ? editTag.id : null,
        tag_product_id: editTag.kind === 'product' ? editTag.id : null,
      });
      await load();
      setShowEditModal(false);
    } catch (err) {
      console.error('update post error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar los cambios.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeletePost() {
    if (!post) return;
    Alert.alert('Eliminar publicación', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setSavingEdit(true);
          try {
            await deletePost(post.id);
            setShowEditModal(false);
            router.back();
          } catch (err) {
            console.error('delete post error', err);
            Alert.alert('Error', 'No se pudo eliminar la publicación.');
          } finally {
            setSavingEdit(false);
          }
        },
      },
    ]);
  }

  async function handleReportPost(reason: string) {
    if (!post || !profile) return;
    try {
      await createReport(profile.id, 'post', post.id, reason);
      setShowReportModal(false);
      Alert.alert('Gracias', 'Reportaste esta publicación. Un admin la va a revisar.');
    } catch (err) {
      console.error('report post error', err);
      Alert.alert('Error', 'No se pudo enviar el reporte.');
    }
  }

  function handleAuthorPress() {
    if (!post) return;
    if (isBusiness && post.author_business) {
      if (post.author_business.owner_id === profile?.id) {
        router.push(`${prefix}/(tabs)/perfil`);
      } else {
        router.push(`${prefix}/business/${post.author_business.id}`);
      }
    } else if (post.author_client) {
      if (post.author_client.id === profile?.id) {
        router.push(`${prefix}/(tabs)/perfil`);
      } else {
        router.push(`${prefix}/usuario/${post.author_client.id}`);
      }
    }
  }

  function handleCommentAuthorPress(comment: PostCommentWithAuthor) {
    if (!comment.users) return;
    if (comment.users.id === profile?.id) {
      router.push(`${prefix}/(tabs)/perfil`);
    } else {
      router.push(`${prefix}/usuario/${comment.users.id}`);
    }
  }

  return (
    <View style={styles.container}>
      {(isOwner || profile) && (
        <Stack.Screen
          options={{
            headerRight: () =>
              isOwner ? (
                <Pressable onPress={openEditModal} hitSlop={8}>
                  <Ionicons name="create-outline" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={() => setShowReportModal(true)} hitSlop={8}>
                  <Ionicons name="flag-outline" size={22} color={colors.text} />
                </Pressable>
              ),
          }}
        />
      )}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.authorRow} onPress={handleAuthorPress}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name={isBusiness ? 'storefront' : 'person'} size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.authorName}>{authorName}</Text>
          {post.author_business?.is_verified && (
            <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          )}
        </Pressable>

        <PhotoCarousel photos={post.photos} />

        {post.caption && <Text style={styles.caption}>{post.caption}</Text>}

        {tag && (
          <Pressable style={styles.tagChip} onPress={() => router.push(tag.href)}>
            <Ionicons name="pricetag" size={12} color={colors.primary} />
            <Text style={styles.tagText}>{tag.label}</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Comentarios</Text>
        {comments.length === 0 ? (
          <Text style={styles.placeholder}>Sé el primero en comentar.</Text>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <Pressable onPress={() => handleCommentAuthorPress(comment)}>
                <View style={styles.commentAvatar}>
                  {comment.users?.avatar_url ? (
                    <Image source={{ uri: comment.users.avatar_url }} style={styles.commentAvatarImage} />
                  ) : (
                    <Ionicons name="person" size={14} color={colors.primary} />
                  )}
                </View>
              </Pressable>
              <View style={styles.commentBubble}>
                <Pressable onPress={() => handleCommentAuthorPress(comment)}>
                  <Text style={styles.commentAuthor}>{comment.users?.full_name ?? 'Usuario'}</Text>
                </Pressable>
                <Text style={styles.commentBody}>{comment.body}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {isLimited ? (
        <View style={styles.limitedNotice}>
          <Text style={styles.limitedNoticeText}>Tu cuenta está limitada: no puedes comentar.</Text>
        </View>
      ) : (
        <KeyboardStickyView>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un comentario…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
            />
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardStickyView>
      )}

      <Modal visible={showEditModal} animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <ScrollView contentContainerStyle={styles.modalContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar publicación</Text>
            <Pressable onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.photosSection}>
            <Text style={styles.fieldLabel}>
              Fotos ({editPhotos.length}/{editMaxPhotos})
            </Text>
            <MultiPhotoPicker
              photos={editPhotos}
              onRemove={handleRemoveEditPhoto}
              onAdd={handlePickEditPhoto}
              max={editMaxPhotos}
              uploading={uploadingEditPhoto}
            />
          </View>

          <TextField
            label="Descripción"
            placeholder="Escribe una descripción…"
            value={editCaption}
            onChangeText={setEditCaption}
          />

          <Text style={styles.fieldLabel}>Etiqueta</Text>
          {editTag.kind !== 'none' ? (
            <View style={styles.tagEditChip}>
              <Ionicons name={tagIconForKind(editTag.kind)} size={12} color={colors.primary} />
              <Text numberOfLines={1} style={styles.tagEditChipText}>
                {editTag.name}
              </Text>
              <Pressable onPress={() => setEditTag({ kind: 'none' })} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.tagChipRow}>
                <Pressable
                  style={[styles.tagOptionChip, editTagPanel === 'search' && styles.tagOptionChipSelected]}
                  onPress={() => openTagPanel('search')}
                >
                  <Text style={[styles.tagOptionChipText, editTagPanel === 'search' && styles.tagOptionChipTextSelected]}>
                    Negocio o persona
                  </Text>
                </Pressable>
                {isBusiness && (
                  <>
                    <Pressable
                      style={[styles.tagOptionChip, editTagPanel === 'service' && styles.tagOptionChipSelected]}
                      onPress={() => openTagPanel('service')}
                    >
                      <Text style={[styles.tagOptionChipText, editTagPanel === 'service' && styles.tagOptionChipTextSelected]}>
                        Servicio
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.tagOptionChip, editTagPanel === 'product' && styles.tagOptionChipSelected]}
                      onPress={() => openTagPanel('product')}
                    >
                      <Text style={[styles.tagOptionChipText, editTagPanel === 'product' && styles.tagOptionChipTextSelected]}>
                        Producto
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              {editTagPanel === 'search' && (
                <View style={styles.tagSearchWrap}>
                  <TextInput
                    style={styles.tagSearchInput}
                    placeholder="Buscar negocio o cliente…"
                    placeholderTextColor={colors.textMuted}
                    value={editTagQuery}
                    onChangeText={handleEditTagSearch}
                    autoFocus
                  />
                  {searchingEditTag && <ActivityIndicator color={colors.primary} size="small" style={styles.tagSearchSpinner} />}
                  {editTagResults.map((item) =>
                    item.kind === 'none' ? null : (
                      <Pressable key={`${item.kind}-${item.id}`} style={styles.tagResultItem} onPress={() => selectEditTag(item)}>
                        <Ionicons name={tagIconForKind(item.kind)} size={14} color={colors.primary} />
                        <Text style={styles.tagResultText}>{item.name}</Text>
                      </Pressable>
                    )
                  )}
                  <Pressable onPress={() => setEditTagPanel('none')}>
                    <Text style={styles.tagCancelText}>Cancelar</Text>
                  </Pressable>
                </View>
              )}

              {editTagPanel === 'service' && (
                <View style={styles.tagChipRow}>
                  {editTagServices.length === 0 ? (
                    <Text style={styles.placeholder}>No tienes servicios activos.</Text>
                  ) : (
                    editTagServices.map((s) => (
                      <Pressable
                        key={s.id}
                        style={styles.tagOptionChip}
                        onPress={() => selectEditTag({ kind: 'service', id: s.id, name: s.name })}
                      >
                        <Text style={styles.tagOptionChipText}>{s.name}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              {editTagPanel === 'product' && (
                <View style={styles.tagChipRow}>
                  {editTagProducts.length === 0 ? (
                    <Text style={styles.placeholder}>No tienes productos activos.</Text>
                  ) : (
                    editTagProducts.map((p) => (
                      <Pressable
                        key={p.id}
                        style={styles.tagOptionChip}
                        onPress={() => selectEditTag({ kind: 'product', id: p.id, name: p.name })}
                      >
                        <Text style={styles.tagOptionChipText}>{p.name}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}

          <Button title="Guardar" onPress={handleSaveEdit} loading={savingEdit} style={styles.saveButton} />
          <Button title="Cancelar" variant="secondary" onPress={() => setShowEditModal(false)} style={styles.spacedButton} />
          <Pressable onPress={handleDeletePost} style={styles.deleteLink}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.deleteLinkText}>Eliminar publicación</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      <ReportModal
        visible={showReportModal}
        targetLabel="esta publicación"
        onCancel={() => setShowReportModal(false)}
        onSubmit={handleReportPost}
      />
    </View>
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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 38,
    height: 38,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    fontSize: 15,
    color: colors.text,
    marginTop: 14,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E6',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 24,
    marginBottom: 10,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 28,
    height: 28,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  commentBody: {
    fontSize: 14,
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitedNotice: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FBE8E8',
  },
  limitedNoticeText: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  modalContainer: {
    padding: 20,
    paddingTop: 56,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  photosSection: {
    marginBottom: 20,
  },
  saveButton: {
    marginTop: 16,
  },
  spacedButton: {
    marginTop: 10,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 8,
  },
  deleteLinkText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  tagEditChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1E6',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
    maxWidth: '100%',
  },
  tagEditChipText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagOptionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagOptionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  tagOptionChipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tagOptionChipTextSelected: {
    color: colors.primary,
  },
  tagSearchWrap: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 8,
    marginBottom: 16,
  },
  tagSearchInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.background,
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
  tagCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
