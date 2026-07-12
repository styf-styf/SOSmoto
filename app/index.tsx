import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';
import { consumePendingDeepLink, type PendingDeepLinkKind } from '../utils/pendingDeepLink';
import { navigateToDeepLinkTarget } from '../utils/deepLinkNavigate';

const PENDING_DEEP_LINK_SCREEN: Record<PendingDeepLinkKind, string> = {
  post: 'publicacion',
  ad: 'anuncio',
  product: '(tabs)/producto',
  service: '(tabs)/servicio',
};

export default function Index() {
  const { session, profile, loading } = useAuth();
  const [pendingChecked, setPendingChecked] = useState(false);
  const [handledPending, setHandledPending] = useState(false);

  // Si el usuario llegó de un link compartido (publicación/anuncio/producto/
  // servicio) sin sesión, app/{post,ad,product,service}/[id].tsx guardó el
  // destino antes de mandarlo a login -- al volver aquí (login/register
  // hacen router.replace('/')) con sesión ya activa, lo retomamos en vez de
  // caer al home normal. Se usa la misma navegación imperativa
  // (navigateToDeepLinkTarget) que los resolvers, no un <Redirect> declarativo,
  // para que también acá quede una pila limpia (Inicio -> destino).
  useEffect(() => {
    if (loading || !session || !profile) {
      setPendingChecked(true);
      return;
    }
    consumePendingDeepLink()
      .then((pending) => {
        if (pending) {
          const prefix = profile.role === 'business' ? '/(business)' : '/(client)';
          navigateToDeepLinkTarget(prefix, PENDING_DEEP_LINK_SCREEN[pending.kind], pending.id);
          setHandledPending(true);
        }
      })
      .catch((err) => console.error('consume pending deep link error', err))
      .finally(() => setPendingChecked(true));
  }, [loading, session, profile]);

  if (loading || !pendingChecked || handledPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile.role === 'business') {
    return <Redirect href="/(business)" />;
  }

  return <Redirect href="/(client)" />;
}
