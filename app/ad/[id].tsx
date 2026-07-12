import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import { setPendingDeepLink } from '../../utils/pendingDeepLink';
import { navigateToDeepLinkTarget } from '../../utils/deepLinkNavigate';

// Destino público de "compartir anuncio" (https://so-smoto.vercel.app/ad/:id,
// vía Universal Links/App Links) -- mismo patrón que app/post/[id].tsx.
export default function AdLinkResolver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile, loading } = useAuth();
  // Keyed por id -- ver app/post/[id].tsx para el motivo.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || handledRef.current === id || !id) return;
    handledRef.current = id;

    if (!session || !profile) {
      setPendingDeepLink('ad', id)
        .catch((err) => console.error('save pending deep link error', err))
        .finally(() => router.replace('/(auth)/login'));
      return;
    }

    const prefix = profile.role === 'business' ? '/(business)' : '/(client)';
    navigateToDeepLinkTarget(prefix, 'anuncio', id);
  }, [loading, session, profile, id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
