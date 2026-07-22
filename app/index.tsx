import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Button } from '../components/Button';
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

function RetryScreen({ onRetry, stillFailing }: { onRetry: () => Promise<void>; stillFailing: boolean }) {
  const [retrying, setRetrying] = useState(false);
  // Antes el botón no daba ningún indicio de que el tap se había registrado
  // -- si seguía sin internet, reintentaba y fallaba igual, pero la
  // pantalla se quedaba exactamente igual, así que parecía que no hacía
  // nada. `attempted` habilita el aviso de abajo recién después del primer
  // intento (para no mostrarlo antes de tiempo).
  const [attempted, setAttempted] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
      setAttempted(true);
    }
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 15, color: colors.textMuted, textAlign: 'center' }}>
        No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo.
      </Text>
      {attempted && stillFailing && (
        <Text style={{ fontSize: 13, color: colors.danger, textAlign: 'center' }}>
          Seguimos sin poder conectarnos.
        </Text>
      )}
      <Button title="Reintentar" onPress={handleRetry} loading={retrying} />
    </View>
  );
}

export default function Index() {
  const { session, profile, loading, sessionAmbiguous, retrySession, profileFetchError, refreshProfile } = useAuth();
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

  // getSession() puede devolver "sin sesión" tanto si de verdad no hay una
  // como si el access token expiró y no se pudo renovar por falta de red --
  // si este dispositivo sí tuvo sesión antes, se asume lo segundo (ver
  // AuthContext) y no se manda a un usuario logueado a login solo por estar
  // sin internet.
  if (sessionAmbiguous) {
    return <RetryScreen onRetry={retrySession} stillFailing={sessionAmbiguous} />;
  }

  // Mismo caso pero un paso más adelante: la sesión sí cargó, pero el fetch
  // del perfil falló por red (ver AuthContext) -- tampoco se trata como
  // "no hay sesión".
  if (session && !profile && profileFetchError) {
    return <RetryScreen onRetry={refreshProfile} stillFailing={profileFetchError} />;
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile.role === 'business') {
    return <Redirect href="/(business)" />;
  }

  return <Redirect href="/(client)" />;
}
