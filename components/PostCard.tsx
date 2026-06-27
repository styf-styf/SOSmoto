import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { getPostAuthorAvatar, getPostAuthorName, getPostTag, type PostWithAuthor } from '../services/posts';

export function PostCard({ post, detailHref }: { post: PostWithAuthor; detailHref: string }) {
  const authorName = getPostAuthorName(post);
  const avatarUrl = getPostAuthorAvatar(post);
  const tag = getPostTag(post);
  const isBusiness = !!post.author_business;

  return (
    <Pressable style={styles.card} onPress={() => router.push(detailHref)}>
      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name={isBusiness ? 'storefront' : 'person'} size={18} color={colors.primary} />
          )}
        </View>
        <Text style={styles.authorName} numberOfLines={1}>
          {authorName}
        </Text>
      </View>

      {post.image_url && <Image source={{ uri: post.image_url }} style={styles.image} resizeMode="cover" />}

      {post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      {tag && (
        <Pressable style={styles.tagChip} onPress={() => router.push(tag.href)}>
          <Ionicons name="pricetag" size={12} color={colors.primary} />
          <Text style={styles.tagText}>{tag.label}</Text>
        </Pressable>
      )}

      <Text style={styles.commentsLink}>
        {post.comments_count === 0 ? 'Sé el primero en comentar' : `Ver ${post.comments_count} comentario(s)`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  caption: {
    fontSize: 14,
    color: colors.text,
    marginTop: 10,
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
    marginTop: 10,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  commentsLink: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 10,
  },
});
