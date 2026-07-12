import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAccountLimited } from '../hooks/useAccountLimited';
import { useAuth } from '../hooks/useAuth';
import {
  createAdComment,
  getAdById,
  getAdComments,
  registerAdClick,
  type AdCommentWithAuthor,
  type AdWithBusiness,
} from '../services/ads';

export function AdDetail({ adId }: { adId: string }) {
  const { profile } = useAuth();
  const { isLimited } = useAccountLimited();
  const [ad, setAd] = useState<AdWithBusiness | null>(null);
  const [comments, setComments] = useState<AdCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [adResult, commentsResult] = await Promise.all([getAdById(adId), getAdComments(adId)]);
    setAd(adResult);
    setComments(commentsResult);
  }, [adId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load ad detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  // Al recuperar el foco (ej. volver de un enlace del anuncio) se refresca en
  // segundo plano, sin spinner, para reflejar comentarios nuevos de otros usuarios.
  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh ad detail on focus error', err));
    }, [load])
  );

  async function handleSend() {
    if (!profile || !text.trim() || isLimited) return;
    const body = text.trim();
    setText('');
    setSending(true);
    try {
      const comment = await createAdComment(adId, profile.id, body);
      setComments((prev) => [
        ...prev,
        { ...comment, users: { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url } },
      ]);
      setAd((prev) => (prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev));
    } catch (err) {
      console.error('send ad comment error', err);
      setText(body);
    } finally {
      setSending(false);
    }
  }

  function handleOpenLink() {
    if (!ad?.link_url) return;
    registerAdClick(ad.id).catch((err) => console.error('register ad click error', err));
    Linking.openURL(ad.link_url).catch(() => {});
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!ad) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este anuncio ya no está disponible.</Text>
      </View>
    );
  }

  const businessName = ad.business?.name ?? 'Anuncio';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {ad.business?.logo_url ? (
              <Image source={{ uri: ad.business.logo_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.authorName}>{businessName}</Text>
          {ad.business?.is_verified && (
            <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          )}
        </View>

        <View style={styles.imageWrap}>
          <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
          <View style={styles.adChip}>
            <Ionicons name="megaphone" size={12} color="#fff" />
            <Text style={styles.adChipText}>Anuncio</Text>
          </View>
        </View>

        {ad.title && <Text style={styles.caption}>{ad.title}</Text>}

        {ad.link_url && (
          <Pressable style={styles.linkButton} onPress={handleOpenLink}>
            <Ionicons name="open-outline" size={16} color="#fff" />
            <Text style={styles.linkButtonText}>Ver más</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Comentarios</Text>
        {comments.length === 0 ? (
          <Text style={styles.placeholder}>Sé el primero en comentar.</Text>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={styles.commentAvatar}>
                {comment.users?.avatar_url ? (
                  <Image source={{ uri: comment.users.avatar_url }} style={styles.commentAvatarImage} />
                ) : (
                  <Ionicons name="person" size={14} color={colors.primary} />
                )}
              </View>
              <View style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{comment.users?.full_name ?? 'Usuario'}</Text>
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
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  adChip: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  caption: {
    fontSize: 15,
    color: colors.text,
    marginTop: 14,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 14,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
});
