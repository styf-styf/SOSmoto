import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getBusinessById } from '../../../services/businesses';
import { getActiveProducts, getActiveServices } from '../../../services/catalog';
import { followBusiness, isFollowing as fetchIsFollowing, unfollowBusiness } from '../../../services/follows';
import { getBusinessReviews } from '../../../services/reviews';
import type { Business, Product, Review, Service } from '../../../types/database';

const businessTypeLabel: Record<Business['business_type'], string> = {
  workshop: 'Taller mecánico',
  store: 'Tienda de accesorios',
  brand_advertiser: 'Marca / proveedor',
};

export default function BusinessProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [businessResult, servicesResult, productsResult, reviewsResult] = await Promise.all([
      getBusinessById(id),
      getActiveServices(id),
      getActiveProducts(id),
      getBusinessReviews(id),
    ]);
    setBusiness(businessResult);
    setServices(servicesResult);
    setProducts(productsResult);
    setReviews(reviewsResult);

    if (profile?.role === 'client') {
      setFollowing(await fetchIsFollowing(profile.id, id));
    }
  }, [id, profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('business profile load error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function toggleFollow() {
    if (!profile || !id) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowBusiness(profile.id, id);
        setFollowing(false);
        setBusiness((b) => (b ? { ...b, followers_count: b.followers_count - 1 } : b));
      } else {
        await followBusiness(profile.id, id);
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
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este negocio no existe.</Text>
      </View>
    );
  }

  const showFollow = profile?.role === 'client';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{business.name}</Text>
          {business.is_verified && (
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          )}
        </View>
        <Text style={styles.type}>{businessTypeLabel[business.business_type]}</Text>
        <Text style={styles.meta}>
          {business.address}, {business.city}
        </Text>
        {business.phone && <Text style={styles.meta}>{business.phone}</Text>}

        <View style={styles.statsRow}>
          <Stat
            icon="star"
            label={
              reviews.length > 0
                ? `${Number(business.rating_avg).toFixed(1)} (${reviews.length} reseña${reviews.length === 1 ? '' : 's'})`
                : 'Sin reseñas aún'
            }
          />
          <Stat icon="people" label={`${business.followers_count} seguidores`} />
        </View>

        {showFollow && (
          <View style={styles.actionsRow}>
            <Button
              title={following ? 'Siguiendo' : 'Seguir'}
              variant={following ? 'secondary' : 'primary'}
              onPress={toggleFollow}
              loading={followLoading}
              style={styles.actionButton}
            />
            <Button
              title="Mensaje"
              variant="secondary"
              onPress={() => router.push(`/(client)/chat/${business.id}`)}
              style={styles.actionButton}
            />
          </View>
        )}
        {showFollow && (
          <Button
            title="Agendar cita"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(client)/agendar', params: { businessId: business.id } })}
            style={styles.scheduleButton}
          />
        )}
      </View>

      {business.description && (
        <Section title="Sobre el negocio">
          <Text style={styles.description}>{business.description}</Text>
        </Section>
      )}

      <Section title="Servicios">
        {services.length === 0 ? (
          <Text style={styles.placeholder}>Este negocio aún no publicó servicios.</Text>
        ) : (
          services.map((service) => (
            <ItemRow
              key={service.id}
              name={service.name}
              price={service.reference_price}
              onPress={() => router.push(`/(client)/servicio/${service.id}`)}
            />
          ))
        )}
      </Section>

      <Section title="Productos">
        {products.length === 0 ? (
          <Text style={styles.placeholder}>Este negocio aún no publicó productos.</Text>
        ) : (
          products.map((product) => (
            <ItemRow
              key={product.id}
              name={product.name}
              price={product.reference_price}
              onPress={() => router.push(`/(client)/producto/${product.id}`)}
            />
          ))
        )}
      </Section>

      <Section title="Reseñas">
        {reviews.length === 0 ? (
          <Text style={styles.placeholder}>Este negocio aún no tiene reseñas.</Text>
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
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ItemRow({ name, price, onPress }: { name: string; price: number | null; onPress: () => void }) {
  return (
    <Pressable style={styles.itemRow} onPress={onPress}>
      <Text style={styles.itemName}>{name}</Text>
      {price !== null && <Text style={styles.itemPrice}>${Number(price).toFixed(2)}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  type: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  meta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  scheduleButton: {
    marginTop: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: {
    fontSize: 14,
    color: colors.text,
  },
  itemPrice: {
    fontSize: 14,
    color: colors.textMuted,
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
