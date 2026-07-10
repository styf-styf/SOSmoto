import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getFollowedBusinesses } from '../../../services/businesses';
import { getMyClientPosts } from '../../../services/posts';
import { pickAndUploadUserAvatar } from '../../../services/storage';
import { updateUserProfile } from '../../../services/users';
import { getVehicles } from '../../../services/vehicles';
import type { Business, Post } from '../../../types/database';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

export default function ClientPerfilScreen() {
  const { profile } = useAuth();

  const [following, setFollowing] = useState<Business[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const avatarUrl = avatarOverride ?? profile?.avatar_url ?? null;
  const postsWithImage = posts.filter((post) => post.photos.length > 0);
  const postsWithoutImage = posts.filter((post) => post.photos.length === 0);

  async function handleChangeAvatar() {
    if (!profile) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadUserAvatar(profile.id);
      if (!url) return;
      await updateUserProfile(profile.id, { avatarUrl: url });
      setAvatarOverride(url);
    } catch (err) {
      console.error('upload avatar error', err);
      Alert.alert('Error', 'No se pudo actualizar tu foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const load = useCallback(async () => {
    if (!profile) return;
    await Promise.all([
      getFollowedBusinesses(profile.id).then(setFollowing).catch((err) => console.error('load followed businesses error', err)),
      getMyClientPosts(profile.id).then(setPosts).catch((err) => console.error('load my posts error', err)),
      getVehicles(profile.id).then((vehicles) => setVehicleCount(vehicles.length)).catch((err) => console.error('load vehicles error', err)),
    ]);
  }, [profile]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <View style={styles.headerRow}>
        <Pressable style={styles.avatarWrap} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={36} color={colors.primary} />
            )}
            {uploadingAvatar && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </View>
          {!uploadingAvatar && (
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          )}
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{profile?.full_name || 'Perfil'}</Text>
          <Text style={styles.subtitle}>{profile?.email}</Text>
        </View>
        <Pressable onPress={() => router.push('/(client)/configuracion')}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Pressable style={styles.statItem} onPress={() => router.push('/(client)/vehiculos')}>
          <Text style={styles.statValue}>{vehicleCount}</Text>
          <Text style={styles.statLabel}>Motos</Text>
        </Pressable>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{following.length}</Text>
          <Text style={styles.statLabel}>Siguiendo</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{posts.length}</Text>
          <Text style={styles.statLabel}>Publicaciones</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionBtn} onPress={() => router.push('/(client)/citas')}>
          <Ionicons name="calendar-outline" size={20} color={colors.text} />
          <Text style={styles.actionBtnLabel}>Mis citas</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => router.push('/(client)/mis-compras')}>
          <Ionicons name="bag-handle-outline" size={20} color={colors.text} />
          <Text style={styles.actionBtnLabel}>Mis compras</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => router.push('/(client)/publicaciones')}>
          <Ionicons name="grid-outline" size={20} color={colors.text} />
          <Text style={styles.actionBtnLabel}>Publicaciones</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => router.push('/(client)/invitaciones')}>
          <Ionicons name="mail-outline" size={20} color={colors.text} />
          <Text style={styles.actionBtnLabel}>Invitaciones</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Siguiendo</Text>
      {following.length === 0 ? (
        <Text style={styles.placeholder}>
          Aún no sigues a ningún negocio. Explora "Buscar" y sigue talleres para ver sus novedades aquí.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followingRow}>
          {following.map((business) => (
            <Pressable
              key={business.id}
              style={styles.followingItem}
              onPress={() => router.push(`/(client)/business/${business.id}`)}
            >
              <View style={styles.followingAvatarWrap}>
                <View style={styles.followingAvatar}>
                  {business.logo_url ? (
                    <Image source={{ uri: business.logo_url }} style={styles.followingAvatarImage} />
                  ) : (
                    <Ionicons name="storefront" size={20} color={colors.primary} />
                  )}
                </View>
                {business.is_verified && (
                  <View style={styles.followingVerifiedDot}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={styles.followingName}>
                {business.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Mis publicaciones</Text>
      {posts.length === 0 ? (
        <View>
          <Text style={styles.placeholder}>Todavía no has publicado nada.</Text>
          <Button title="Crear publicación" variant="secondary" onPress={() => router.push('/(client)/publicaciones')} />
        </View>
      ) : (
        <>
          {postsWithImage.length > 0 && (
            <View style={styles.grid}>
              {postsWithImage.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.gridCell}
                  onPress={() => router.push(`/(client)/publicacion/${post.id}`)}
                >
                  <Image source={{ uri: post.photos[0] }} style={styles.gridImage} />
                </Pressable>
              ))}
            </View>
          )}
          {postsWithoutImage.length > 0 && (
            <View style={[postsWithImage.length > 0 && styles.listWrapWithGrid]}>
              {postsWithoutImage.map((post) => (
                <Pressable
                  key={post.id}
                  style={styles.listRow}
                  onPress={() => router.push(`/(client)/publicacion/${post.id}`)}
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
  avatarWrap: {
    width: 72,
    height: 72,
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
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  actionsRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
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
    marginBottom: 12,
  },
  followingRow: {
    gap: 16,
  },
  followingItem: {
    width: 64,
    alignItems: 'center',
  },
  followingAvatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  followingAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  followingAvatarImage: {
    width: 56,
    height: 56,
  },
  followingVerifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  followingName: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  gridCell: {
    width: CELL_SIZE,
    height: Math.round(CELL_SIZE * (4 / 3)),
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
