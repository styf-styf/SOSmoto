import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { getClientPublicPosts, type PostWithAuthor } from '../services/posts';
import { PostCard } from './PostCard';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function ClientProfileView({
  userId,
  userRole = 'client',
}: {
  userId: string;
  userRole?: 'client' | 'business';
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [profileRes, postsData] = await Promise.all([
      supabase.from('users').select('id, full_name, avatar_url').eq('id', userId).maybeSingle(),
      getClientPublicPosts(userId),
    ]);
    if (profileRes.data) setProfile(profileRes.data as UserProfile);
    setPosts(postsData);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const prefix = userRole === 'business' ? '/(business)' : '/(client)';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={36} color={colors.primary} />
          )}
        </View>
        <Text style={styles.name}>{profile?.full_name ?? 'Usuario'}</Text>
      </View>

      {posts.length === 0 ? (
        <Text style={styles.placeholder}>Sin publicaciones aún.</Text>
      ) : (
        posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            detailHref={`${prefix}/publicacion/${post.id}`}
            userRole={userRole}
            showTopShadow={index > 0}
          />
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
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 80,
    height: 80,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 24,
  },
});
