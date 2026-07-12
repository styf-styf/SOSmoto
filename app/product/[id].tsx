import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import { setPendingDeepLink } from '../../utils/pendingDeepLink';
import { navigateToDeepLinkTarget } from '../../utils/deepLinkNavigate';

// Destino público de "compartir producto" (https://so-smoto.vercel.app/product/:id).
// Mismo patrón que app/post/[id].tsx, pero el destino real vive dentro de
// (tabs) en ambos roles.
export default function ProductLinkResolver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile, loading } = useAuth();
  // Keyed por id -- ver app/post/[id].tsx para el motivo.
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || handledRef.current === id || !id) return;
    handledRef.current = id;

    if (!session || !profile) {
      setPendingDeepLink('product', id)
        .catch((err) => console.error('save pending deep link error', err))
        .finally(() => router.replace('/(auth)/login'));
      return;
    }

    const prefix = profile.role === 'business' ? '/(business)' : '/(client)';
    navigateToDeepLinkTarget(prefix, '(tabs)/producto', id);
  }, [loading, session, profile, id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
