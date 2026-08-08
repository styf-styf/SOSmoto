import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import { setPendingDeepLink } from '../../utils/pendingDeepLink';
import { navigateToNegocioDeepLink } from '../../utils/deepLinkNavigate';

// Destino público de "compartir catálogo/perfil de negocio"
// (https://sosmoto.net/negocio/:id) -- mismo patrón que app/post/[id].tsx.
export default function NegocioLinkResolver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile, loading } = useAuth();
  // Keyed por id -- ver app/post/[id].tsx para el motivo.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || handledRef.current === id || !id) return;
    handledRef.current = id;

    if (!session || !profile) {
      setPendingDeepLink('negocio', id)
        .catch((err) => console.error('save pending deep link error', err))
        .finally(() => router.replace('/(auth)/login'));
      return;
    }

    navigateToNegocioDeepLink(profile, id).catch((err) => console.error('navigate negocio deep link error', err));
  }, [loading, session, profile, id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
