import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';
import { consumePendingDeepLink } from '../utils/pendingDeepLink';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [pendingChecked, setPendingChecked] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Si el usuario llegó de un link compartido (publicación/anuncio) sin
  // sesión, app/post|ad/[id].tsx guardó el destino antes de mandarlo a
  // login -- al volver aquí (login/register hacen router.replace('/')) con
  // sesión ya activa, lo retomamos en vez de caer al home normal.
  useEffect(() => {
    if (loading || !session || !profile) {
      setPendingChecked(true);
      return;
    }
    consumePendingDeepLink()
      .then((pending) => {
        if (pending) {
          const prefix = profile.role === 'business' ? '/(business)' : '/(client)';
          const screen = pending.kind === 'post' ? 'publicacion' : 'anuncio';
          setPendingHref(`${prefix}/${screen}/${pending.id}`);
        }
      })
      .catch((err) => console.error('consume pending deep link error', err))
      .finally(() => setPendingChecked(true));
  }, [loading, session, profile]);

  if (loading || !pendingChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (pendingHref) {
    return <Redirect href={pendingHref} />;
  }

  if (profile.role === 'business') {
    return <Redirect href="/(business)" />;
  }

  return <Redirect href="/(client)" />;
}
