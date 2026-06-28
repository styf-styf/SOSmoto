import { Stack } from 'expo-router';
import { ActiveHelpRequestProvider } from '../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// Stack real envolviendo el navegador de Tabs (en "(tabs)") -- así el
// botón/gesto de "atrás" en las pantallas secundarias (chat, servicio,
// catálogo, etc.) hace un pop normal, pantalla por pantalla, en vez de
// saltar siempre a Inicio como pasaba cuando todas eran hermanas dentro del
// mismo Tabs. La tab bar solo se ve dentro de "(tabs)"; al entrar a una
// pantalla secundaria, queda oculta (igual que la mayoría de apps).
export default function ClientLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);

  return (
    <ActiveHelpRequestProvider clientId={profile?.id}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="business/[id]" />
        <Stack.Screen name="negocio-catalogo/[id]" />
        <Stack.Screen name="historia/[businessId]" />
        <Stack.Screen name="historias" />
        <Stack.Screen name="historia-cliente/[clientId]" />
        <Stack.Screen name="publicaciones" />
        <Stack.Screen name="publicacion/[id]" />
        <Stack.Screen name="anuncio/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="vehiculos" />
        <Stack.Screen name="historial" />
        <Stack.Screen name="servicio/[id]" />
        <Stack.Screen name="producto/[id]" />
        <Stack.Screen name="configuracion" />
        <Stack.Screen name="agendar" />
        <Stack.Screen name="citas" />
      </Stack>
    </ActiveHelpRequestProvider>
  );
}
