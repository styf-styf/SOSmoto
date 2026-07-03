import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAccountLimited } from '../hooks/useAccountLimited';
import { useAuth } from '../hooks/useAuth';
import {
  createComment,
  getComments,
  getPostAuthorAvatar,
  getPostAuthorName,
  getPostById,
  getPostTag,
  type PostCommentWithAuthor,
  type PostWithAuthor,
} from '../services/posts';

export function PostDetail({ postId, userRole = 'client' }: { postId: string; userRole?: 'client' | 'business' }) {
  const { profile } = useAuth();
  const { isLimited } = useAccountLimited();
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [comments, setComments] = useState<PostCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name={isBusiness ? 'storefront' : 'person'} size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.authorName}>{authorName}</Text>
        </View>

        {post.image_url && <Image source={{ uri: post.image_url }} style={styles.image} resizeMode="cover" />}

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
  image: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: colors.surface,
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
});
