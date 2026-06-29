import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getActiveGrowthSuggestion } from '../../services/growth';
import type { GrowthSuggestion } from '../../types/database';

const SUGGESTION_ROUTE: Record<GrowthSuggestion['type'], string> = {
  upgrade_plan_limit_reached: '/(business)/suscripcion',
  upgrade_plan_near_limit: '/(business)/suscripcion',
  advertise_low_visibility: '/(business)/publicidad',
  advertise_new_business: '/(business)/publicidad',
};

const SUGGESTION_CTA: Record<GrowthSuggestion['type'], string> = {
  upgrade_plan_limit_reached: 'Ver planes',
  upgrade_plan_near_limit: 'Ver planes',
  advertise_low_visibility: 'Crear campaña',
  advertise_new_business: 'Crear campaña',
};

export default function CreceTuNegocioScreen() {
  const { profile } = useAuth();
  const [suggestion, setSuggestion] = useState<GrowthSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setSuggestion(await getActiveGrowthSuggestion(work.business.id));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.error('load crece tu negocio error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {suggestion ? (
        <View style={styles.card}>
          <Ionicons name="trending-up" size={28} color={colors.primary} />
          <Text style={styles.title}>{suggestion.title}</Text>
          <Text style={styles.body}>{suggestion.body}</Text>
          <Button
            title={SUGGESTION_CTA[suggestion.type]}
            onPress={() => router.push(SUGGESTION_ROUTE[suggestion.type] as any)}
            style={styles.button}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <Text style={styles.title}>Vas bien</Text>
          <Text style={styles.body}>No tenemos recomendaciones nuevas para ti por ahora. Revisamos tu actividad cada semana.</Text>
        </View>
      )}

      <Text style={styles.linkText} onPress={() => router.push('/(business)/estadisticas')}>
        Ver mis estadísticas →
      </Text>
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 20,
    textAlign: 'center',
  },
});
