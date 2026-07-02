import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { getServiceById, incrementServiceViews } from '../../../services/catalog';
import {
  cancelServiceIntent,
  createServiceIntent,
  getClientIntentForService,
  subscribeToClientServiceIntent,
} from '../../../services/serviceIntents';
import type { ServiceWithBusiness } from '../../../services/catalog';
import type { ServiceIntent } from '../../../types/database';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [service, setService] = useState<ServiceWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ServiceIntent | null>(null);
  const [agendando, setAgendando] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await getServiceById(id);
    setService(result);
    if (result) incrementServiceViews(id).catch((err) => console.error('increment service views error', err));
    if (profile?.id) {
      getClientIntentForService(profile.id, id)
        .then(setIntent)
        .catch((err) => console.error('load service intent error', err));
    }
  }, [id, profile?.id]);

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

  useEffect(() => {
    if (!profile?.id || !id) return;
    return subscribeToClientServiceIntent(profile.id, id, setIntent, () => {
      Alert.alert('No disponible', 'El negocio indicó que este servicio no está disponible en este momento.');
    });
  }, [profile?.id, id]);

  async function handleAgendar() {
    if (!profile || !service) return;
    setAgendando(true);
    try {
      if (intent) {
        await cancelServiceIntent(intent.id);
        setIntent(null);
      } else {
        const newIntent = await createServiceIntent(profile.id, service.id, service.business_id);
        setIntent(newIntent);
        router.push({
          pathname: '/(client)/chat/[id]',
          params: {
            id: service.business_id,
            prefill: `Hola, quiero agendar: ${service.name}${service.reference_price != null ? ` ($${service.reference_price.toFixed(2)})` : ''}`,
            autoSend: 'true',
          },
        });
      }
    } catch (err) {
      console.error('agendar error', err);
      Alert.alert('Error', 'No se pudo procesar. Intenta de nuevo.');
    } finally {
      setAgendando(false);
    }
  }

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
        {intent?.status !== 'confirmed' && (
          <Button
            title={intent ? 'Cancelar cita' : 'Agendar servicio'}
            onPress={handleAgendar}
            loading={agendando}
            style={intent ? styles.buttonCancel : styles.button}
          />
        )}
        {intent?.status === 'pending' && (
          <Text style={styles.intentBadge}>Cita solicitada — en espera de confirmación del negocio</Text>
        )}
        {intent?.status === 'confirmed' && (
          <Text style={[styles.intentBadge, styles.intentBadgeConfirmed]}>✓ Cita confirmada por el negocio</Text>
        )}
        <Button
          title="Ver negocio"
          onPress={() => router.push(`/(client)/business/${service.business_id}`)}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title="Ver catálogo"
          variant="secondary"
          onPress={() => router.push(`/(client)/negocio-catalogo/${service.business_id}`)}
          style={styles.button}
        />
        <Button
          title="Chatear"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/(client)/chat/[id]',
              params: { id: service.business_id, prefill: `Hola, quería preguntar sobre: ${service.name}` },
            })
          }
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
  buttonCancel: {
    backgroundColor: colors.danger,
  },
  intentBadge: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  intentBadgeConfirmed: {
    color: colors.success,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
});
