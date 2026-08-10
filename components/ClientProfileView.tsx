import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { supabase } from '../services/supabase';
import { getMyClientPosts, type PostWithAuthor } from '../services/posts';
import { Button } from './Button';
import { PostCard } from './PostCard';

const SIDE_PADDING = 20;

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Ver AdDetail.tsx: en la entrada fría el parámetro llega undefined en
    // el primer render pese a que el tipo lo declara string.
    if (!userId) return;
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

  // Al recuperar el foco (ej. volver de una publicación) se refresca en
  // segundo plano, sin spinner, para reflejar publicaciones nuevas del usuario.
  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh client profile on focus error', err));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const prefix = userRole === 'business' ? '/(business)' : '/(client)';

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
        <View style={styles.postsListWrap}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              detailHref={`${prefix}/publicacion/${post.id}`}
              userRole={userRole}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
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
    // Mismo motivo que BusinessProfileView.tsx: cancela el padding del
    // contenedor para que las tarjetas queden del mismo ancho que en Inicio.
    postsListWrap: {
      marginHorizontal: -SIDE_PADDING,
    },
  });
}
