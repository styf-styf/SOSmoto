import { Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// Mismo motivo que app/(client)/_layout.tsx: Stack real envolviendo el
// navegador de Tabs en "(tabs)" para que "atrás" haga pop pantalla por
// pantalla en vez de saltar siempre a Inicio.
export default function BusinessLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="historia/[businessId]" />
      <Stack.Screen name="historia-cliente/[clientId]" />
      <Stack.Screen name="publicaciones" />
      <Stack.Screen name="publicacion/[id]" />
      <Stack.Screen name="anuncio/[id]" />
      <Stack.Screen name="empleados" />
      <Stack.Screen name="suscripcion" />
      <Stack.Screen name="agenda-negocio" />
      <Stack.Screen name="publicidad" />
      <Stack.Screen name="historias" />
      <Stack.Screen name="configuracion" />
      <Stack.Screen name="verificacion" />
      <Stack.Screen name="estado-cuenta" />
      <Stack.Screen name="estadisticas" />
      <Stack.Screen name="crece-tu-negocio" />
    </Stack>
  );
}
