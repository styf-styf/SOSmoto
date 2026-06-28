import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { signOut } from '../services/auth';
import { getBusinessById, getMyWorkBusiness, updateBusiness } from '../services/businesses';
import { followBusiness, isFollowing as fetchIsFollowing, unfollowBusiness } from '../services/follows';
import { getMyBusinessPosts } from '../services/posts';
import { getBusinessReviews } from '../services/reviews';
import { pickAndUploadBusinessImage } from '../services/storage';
import type { Business, Post, Review } from '../types/database';
import { getScheduleRows, isBusinessOpenNow } from '../utils/businessSchedule';

const SIDE_PADDING = 20;
const GRID_GAP = 10;
const GRID_COLUMNS = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.round((SCREEN_WIDTH - SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

const businessTypeLabel: Record<Business['business_type'], string> = {
  workshop: 'Taller mecánico',
  store: 'Tienda de accesorios',
  brand_advertiser: 'Marca / proveedor',
};

export interface BusinessProfileViewProps {
  // 'self': el dueño/staff viendo el perfil de su propio negocio (logo
  // editable, botón a Catálogo de gestión, link "Gestionar" publicaciones).
  // 'public': cualquiera viendo el perfil de un negocio desde (client)
  // (Seguir/Mensaje/Agendar si quien mira es cliente, + horario, anuncios,
  // descripción y reseñas). businessId es requerido solo en mode "public" --
  // en "self" el negocio se resuelve desde el perfil autenticado.
  mode: 'self' | 'public';
  businessId?: string;
}

export function BusinessProfileView({ mode, businessId }: BusinessProfileViewProps) {
  const { profile } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoOverride, setLogoOverride] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const logoUrl = logoOverride ?? business?.logo_url ?? null;
  const postsWithImage = posts.filter((post) => post.image_url);
  const postsWithoutImage = posts.filter((post) => !post.image_url);
  const postHrefBase = mode === 'self' ? '/(business)/publicacion' : '/(client)/publicacion';

  const load = useCallback(async () => {
    let resolvedBusiness: Business | null = null;
    let owner = false;
    if (mode === 'self') {
      if (!profile) return;
      const work = await getMyWorkBusiness(profile.id);
      resolvedBusiness = work?.business ?? null;
      owner = work?.isOwner ?? false;
    } else {
      if (!businessId) return;
      resolvedBusiness = await getBusinessById(businessId);
    }
    setBusiness(resolvedBusiness);
    setIsOwner(owner);
    if (!resolvedBusiness) return;

    const myPosts = await getMyBusinessPosts(resolvedBusiness.id);
    setPosts(myPosts);

    if (mode === 'public') {
      const reviewsResult = await getBusinessReviews(resolvedBusiness.id);
      setReviews(reviewsResult);
      if (profile?.role === 'client') {
        setFollowing(await fetchIsFollowing(profile.id, resolvedBusiness.id));
      }
    }
  }, [mode, businessId, profile]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.error('business profile load error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handleChangeLogo() {
    if (!business || !isOwner) return;
    setUploadingLogo(true);
    try {
      const url = await pickAndUploadBusinessImage(business.id);
      if (!url) return;
      await updateBusiness(business.id, { logo_url: url });
      setLogoOverride(url);
    } catch (err) {
      console.error('upload logo error', err);
      Alert.alert('Error', 'No se pudo actualizar el logo.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  async function toggleFollow() {
    if (!profile || !business) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowBusiness(profile.id, business.id);
        setFollowing(false);
        setBusiness((b) => (b ? { ...b, followers_count: b.followers_count - 1 } : b));
      } else {
        await followBusiness(profile.id, business.id);
        setFollowing(true);
        setBusiness((b) => (b ? { ...b, followers_count: b.followers_count + 1 } : b));
      }
    } catch (err) {
      console.error('toggle follow error', err);
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    if (mode === 'self') {
      return (
        <View style={styles.center}>
          <Text style={styles.placeholder}>{profile?.full_name ?? 'Perfil'}</Text>
          <Button title="Cerrar sesión" variant="secondary" onPress={handleSignOut} />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este negocio no existe.</Text>
      </View>
    );
  }

  const showFollow = mode === 'public' && profile?.role === 'client';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {mode === 'self' && business.is_limited && (
        <View style={styles.suspendedBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.suspendedBannerText}>
            Tu negocio está limitado{business.limitation_reason ? `: ${business.limitation_reason}` : '.'} No puedes
            crear anuncios, historias, publicaciones, gestionar empleados, editar catálogo ni usar el chat hasta que se
            quite el límite. Sigues recibiendo solicitudes de auxilio con normalidad.
          </Text>
        </View>
      )}
      <View style={styles.headerRow}>
        {mode === 'self' ? (
          <Pressable style={styles.avatarWrap} onPress={handleChangeLogo} disabled={!isOwner || uploadingLogo}>
            <View style={styles.avatar}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="storefront" size={36} color={colors.primary} />
              )}
              {uploadingLogo && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </View>
            {isOwner && !uploadingLogo && (
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.avatar}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="storefront" size={36} color={colors.primary} />
            )}
          </View>
        )}
        <View style={styles.headerText}>
          {mode === 'public' ? (
            <View style={styles.nameRow}>
              <Text style={styles.title}>{business.name}</Text>
              {business.is_verified && <Ionicons name="checkmark-circle" size={16} color={colors.primary} />}
            </View>
          ) : (
            <Text style={styles.title}>{business.name}</Text>
          )}
          {mode === 'public' && <Text style={styles.subtitle}>{businessTypeLabel[business.business_type]}</Text>}
          <Text style={styles.subtitle}>
            {business.address}, {business.city}
          </Text>
        </View>
        {mode === 'self' && (
          <Pressable onPress={() => router.push('/(business)/configuracion')}>
            <Ionicons name="menu" size={26} color={colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{business.rating_avg > 0 ? business.rating_avg.toFixed(1) : '—'}</Text>
          <Text style={styles.statLabel}>Calificación</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{business.followers_count}</Text>
          <Text style={styles.statLabel}>Seguidores</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{posts.length}</Text>
          <Text style={styles.statLabel}>Publicaciones</Text>
        </View>
      </View>

      {mode === 'self' && (
        <View style={styles.actionsRow}>
          <Button
            title="Catálogo"
            variant="secondary"
            onPress={() => router.push('/(business)/catalogo')}
            style={styles.actionButton}
          />
          <Button
            title="Anuncios"
            variant="secondary"
            onPress={() => router.push('/(business)/publicidad')}
            style={styles.actionButton}
          />
        </View>
      )}

      {mode === 'public' && (
        <View style={styles.profileActionsRow}>
          {showFollow && (
            <ProfileActionButton
              icon={following ? 'checkmark-circle' : 'person-add-outline'}
              label={following ? 'Siguiendo' : 'Seguir'}
              onPress={toggleFollow}
              loading={followLoading}
              active={following}
            />
          )}
          {showFollow && (
            <ProfileActionButton
              icon="chatbubble-outline"
              label="Mensaje"
              onPress={() => router.push(`/(client)/chat/${business.id}`)}
            />
          )}
          {showFollow && (
            <ProfileActionButton
              icon="calendar-outline"
              label="Agendar"
              onPress={() => router.push({ pathname: '/(client)/agendar', params: { businessId: business.id } })}
            />
          )}
          <ProfileActionButton
            icon="grid-outline"
            label="Catálogo"
            onPress={() => router.push(`/(client)/negocio-catalogo/${business.id}`)}
          />
        </View>
      )}

      {mode === 'public' && (
        <View style={styles.section}>
          <View style={styles.scheduleHeaderRow}>
            <Text style={styles.sectionTitle}>Horario</Text>
            <View style={[styles.openBadge, isBusinessOpenNow(business) ? styles.openBadgeOpen : styles.openBadgeClosed]}>
              <Text style={styles.openBadgeText}>
                {business.is_24h ? 'Abierto 24/7' : isBusinessOpenNow(business) ? 'Abierto ahora' : 'Cerrado ahora'}
              </Text>
            </View>
          </View>
          {!business.is_24h &&
            getScheduleRows(business.schedule).map((row) => (
              <View key={row.label} style={styles.scheduleRow}>
                <Text style={[styles.scheduleDay, row.isToday && styles.scheduleDayToday]}>{row.label}</Text>
                <Text style={[styles.scheduleHours, row.isToday && styles.scheduleDayToday]}>{row.hours}</Text>
              </View>
            ))}
        </View>
      )}

      {mode === 'public' && business.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre el negocio</Text>
          <Text style={styles.description}>{business.description}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.postsHeaderRow}>
        <Text style={styles.sectionTitle}>Publicaciones</Text>
        {mode === 'self' && (
          <Pressable onPress={() => router.push('/(business)/publicaciones')}>
            <Text style={styles.manageLink}>Gestionar</Text>
          </Pressable>
        )}
      </View>
      {posts.length === 0 ? (
        <View>
          <Text style={styles.placeholderText}>
            {mode === 'self' ? 'Todavía no has publicado nada.' : 'Este negocio aún no ha publicado nada.'}
          </Text>
          {mode === 'self' && isOwner && (
            <Button title="Crear publicación" variant="secondary" onPress={() => router.push('/(business)/publicaciones')} />
          )}
        </View>
      ) : (
        <>
          {postsWithImage.length > 0 && (
            <View style={styles.grid}>
              {postsWithImage.map((post) => (
                <Pressable key={post.id} style={styles.gridCell} onPress={() => router.push(`${postHrefBase}/${post.id}`)}>
                  <Image source={{ uri: post.image_url! }} style={styles.gridImage} />
                </Pressable>
              ))}
            </View>
          )}
          {postsWithoutImage.length > 0 && (
            <View style={[postsWithImage.length > 0 && styles.listWrapWithGrid]}>
              {postsWithoutImage.map((post) => (
                <Pressable key={post.id} style={styles.listRow} onPress={() => router.push(`${postHrefBase}/${post.id}`)}>
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

      {mode === 'public' && (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Reseñas</Text>
          {reviews.length === 0 ? (
            <Text style={styles.placeholderText}>Este negocio aún no tiene reseñas.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewRow}>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Ionicons
                      key={value}
                      name={value <= review.rating ? 'star' : 'star-outline'}
                      size={14}
                      color={colors.warning}
                    />
                  ))}
                </View>
                {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

// Botón compacto (ícono + etiqueta) para agrupar Seguir/Mensaje/Agendar/Ver
// catálogo en una sola fila -- los <Button> normales son demasiado anchos
// para los 4 juntos.
function ProfileActionButton({
  icon,
  label,
  onPress,
  loading,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable style={styles.profileActionButton} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.text} />
      )}
      <Text numberOfLines={1} style={[styles.profileActionLabel, active && styles.profileActionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
    gap: 8,
  },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBE8E8',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  suspendedBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  container: {
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
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
    borderRadius: 16,
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
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    gap: 10,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
  },
  profileActionsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  profileActionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  profileActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  profileActionLabelActive: {
    color: colors.primary,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  openBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  openBadgeOpen: {
    backgroundColor: '#E7F6EC',
  },
  openBadgeClosed: {
    backgroundColor: '#FBE8E8',
  },
  openBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scheduleDay: {
    fontSize: 13,
    color: colors.textMuted,
  },
  scheduleHours: {
    fontSize: 13,
    color: colors.textMuted,
  },
  scheduleDayToday: {
    color: colors.text,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  postsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 12,
  },
  manageLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  reviewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 13,
    color: colors.text,
  },
});
