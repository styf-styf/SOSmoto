import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { getServiceById } from '../../../services/catalog';
import type { ServiceWithBusiness } from '../../../services/catalog';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getServiceById(id);
    setService(result);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load service detail error', err))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
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
      {service.photos[0] && (
        <Image source={{ uri: service.photos[0] }} style={styles.photo} resizeMode="cover" />
      )}
      <Text style={styles.name}>{service.name}</Text>
      <Text style={styles.business}>{service.business_name}</Text>

      <Text style={styles.price}>
        {service.reference_price !== null ? `$${service.reference_price.toFixed(2)}` : 'Precio a consultar'}
      </Text>

      {service.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripción</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>
      )}

      <Button
        title="Ver negocio"
        onPress={() => router.push(`/(client)/business/${service.business_id}`)}
        style={styles.button}
      />
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
    padding: 20,
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
  business: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 4,
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
  button: {
    marginTop: 32,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
