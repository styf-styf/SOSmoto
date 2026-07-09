import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { FeedCatalogStrip } from '../../../components/FeedCatalogStrip';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getServiceById, getServicesByCategory, incrementServiceViews } from '../../../services/catalog';
import type { ServiceWithBusiness, FeedCatalogItem } from '../../../services/catalog';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedItems, setRelatedItems] = useState<FeedCatalogItem[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getServiceById(id);
    setService(result);
    if (result) {
      incrementServiceViews(id).catch((err) => console.error('increment service views error', err));
      getServicesByCategory(result.category_id, id)
        .then(setRelatedItems)
        .catch((err) => console.error('load related services error', err));
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load service detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (profile && profile.role !== 'client' && id) {
      router.replace('/(business)/(tabs)/catalogo');
    }
  }, [profile?.role, id]);

  if (loading || (profile && profile.role !== 'client')) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Este servicio ya no está disponible.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: service.name }} />
      <Pressable
        style={styles.businessRow}
        onPress={() => router.push(`/(client)/business/${service.business_id}`)}
      >
        <View style={styles.businessAvatarWrap}>
          <View style={styles.businessAvatar}>
            {service.business_logo_url ? (
              <Image source={{ uri: service.business_logo_url }} style={styles.businessAvatarImage} />
            ) : (
              <Ionicons name="storefront" size={18} color={colors.primary} />
            )}
          </View>
          {service.business_is_verified && (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            </View>
          )}
        </View>
        <Text style={styles.businessName} numberOfLines={1}>{service.business_name}</Text>
      </Pressable>
      {service.photos[0] && (
        <Image source={{ uri: service.photos[0] }} style={styles.photo} resizeMode="cover" />
      )}
      <Text style={styles.name}>{service.name}</Text>

      <Text style={styles.price}>
        {service.reference_price !== null ? `$${service.reference_price.toFixed(2)}` : 'Precio a consultar'}
      </Text>

      {service.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>
      )}

      <View style={styles.buttonGroup}>
        <Button
          title="Solicitar cita"
          onPress={() =>
            router.push({
              pathname: '/(client)/agendar',
              params: { businessId: service.business_id, serviceId: service.id },
            })
          }
          style={styles.apartarButton}
        />

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/business/${service.business_id}`)}>
            <Ionicons name="storefront-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver negocio</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/(client)/negocio-catalogo/${service.business_id}`)}>
            <Ionicons name="grid-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Ver catálogo</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={() =>
              router.push({
                pathname: '/(client)/chat/[id]',
                params: { id: service.business_id, prefill: `Hola, quería preguntar sobre: ${service.name}` },
              })
            }
          >
            <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
            <Text style={styles.actionBtnLabel}>Chatear</Text>
          </Pressable>
        </View>
      </View>

      {relatedItems.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={[styles.sectionTitle, styles.relatedSectionTitle]}>También te puede interesar</Text>
          <FeedCatalogStrip
            items={relatedItems.filter((item) => item.photoUrl)}
            listItems={relatedItems.filter((item) => !item.photoUrl)}
            role="client"
          />
        </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  businessAvatarWrap: {
    position: 'relative',
  },
  businessAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessAvatarImage: {
    width: 28,
    height: 28,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  businessName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  section: {
    marginTop: 24,
  },
  relatedSection: {
    marginTop: 28,
    marginHorizontal: -20,
  },
  relatedSectionTitle: {
    paddingHorizontal: 20,
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
  buttonGroup: {
    marginTop: 32,
    gap: 10,
  },
  apartarButton: {
    height: 42,
  },
  actionsRow: {
    flexDirection: 'row',
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
  button: {},
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
