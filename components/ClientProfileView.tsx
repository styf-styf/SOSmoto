import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { supabase } from '../services/supabase';
import { getMyClientPosts } from '../services/posts';
import { Button } from './Button';
import type { Post } from '../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [profileRes, postsData] = await Promise.all([
      supabase.from('users').select('id, full_name, avatar_url').eq('id', userId).maybeSingle(),
      getMyClientPosts(userId),
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
  const postsWithImage = posts.filter((p) => p.image_url);
  const postsWithoutImage = posts.filter((p) => !p.image_url);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={36} color={colors.primary} />
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{profile?.full_name ?? 'Usuario'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{posts.length}</Text>
          <Text style={styles.statLabel}>Publicaciones</Text>
        </View>
      </View>

      {userRole === 'business' && (
        <View style={styles.crmAction}>
          <Button
            title="Ver en mis clientes"
            variant="secondary"
            onPress={() => router.push(`/(business)/cliente/${userId}`)}
          />
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Publicaciones</Text>
      {posts.length === 0 ? (
        <Text style={styles.placeholder}>Este usuario aún no ha publicado nada.</Text>
      ) : (
        <>
          {postsWithImage.length > 0 && (
            <View style={styles.grid}>
              {postsWithImage.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.gridCell}
                  onPress={() => router.push(`${prefix}/publicacion/${post.id}`)}
                >
                  <Image source={{ uri: post.image_url! }} style={styles.gridImage} />
                </Pressable>
              ))}
            </View>
          )}
          {postsWithoutImage.length > 0 && (
            <View style={postsWithImage.length > 0 ? styles.listWrapWithGrid : undefined}>
              {postsWithoutImage.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.listRow}
                  onPress={() => router.push(`${prefix}/publicacion/${post.id}`)}
                >
                  <View style={styles.listIcon}>
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                  </View>
                  <Text numberOfLines={2} style={styles.listText}>
                    {post.caption || 'Publicación sin texto'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </>
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
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 36,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  crmAction: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  listWrapWithGrid: {
    marginTop: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
});
