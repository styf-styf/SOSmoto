import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { getServiceById, incrementServiceViews } from '../../../services/catalog';
import type { ServiceWithBusiness } from '../../../services/catalog';

export default function BusinessServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getServiceById(id);
    setService(result);
    if (result) incrementServiceViews(id).catch((err) => console.error('increment service views error', err));
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
      <Stack.Screen options={{ title: service.name }} />
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

      <View style={styles.buttonGroup}>
        <Button
          title="Chatear con el negocio"
          onPress={() => {
            const msg = encodeURIComponent(`Hola, estoy interesado en el servicio "${service.name}". ¿Podrían darme más información?`);
            router.push(`/(business)/chat/${service.business_owner_id}?initialMessage=${msg}`);
          }}
          style={styles.button}
        />
        <Button
          title="Ver negocio"
          variant="secondary"
          onPress={() => router.push(`/(business)/business/${service.business_id}`)}
          style={styles.button}
        />
        <Button
          title="Ver catálogo"
          variant="secondary"
          onPress={() => router.push(`/(business)/negocio-catalogo/${service.business_id}`)}
          style={styles.button}
        />
      </View>
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
  buttonGroup: {
    marginTop: 32,
    gap: 10,
  },
  button: {},
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
