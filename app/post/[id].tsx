import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import { setPendingDeepLink } from '../../utils/pendingDeepLink';

// Destino público de "compartir publicación" (https://so-smoto.vercel.app/post/:id,
// vía Universal Links/App Links) -- ruta de nivel superior, fuera de
// (client)/(business), porque esos grupos no aparecen en la URL y ambos
// resuelven al mismo path sin prefijo (ver plan). Esta pantalla solo decide
// a cuál de los dos mandar según el rol de quien tiene la sesión activa.
export default function PostLinkResolver() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile, loading } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current || !id) return;
    handledRef.current = true;

    if (!session || !profile) {
      setPendingDeepLink('post', id)
        .catch((err) => console.error('save pending deep link error', err))
        .finally(() => router.replace('/(auth)/login'));
      return;
    }

    const prefix = profile.role === 'business' ? '/(business)' : '/(client)';
    router.replace(`${prefix}/publicacion/${id}`);
  }, [loading, session, profile, id]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
