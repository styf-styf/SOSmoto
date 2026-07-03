import { Stack } from 'expo-router';
import { ActiveHelpRequestProvider } from '../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { AppHeader } from '../../components/AppHeader';

// Stack real envolviendo el navegador de Tabs (en "(tabs)") -- así el
// botón/gesto de "atrás" en las pantallas secundarias (chat, servicio,
// catálogo, etc.) hace un pop normal, pantalla por pantalla, en vez de
// saltar siempre a Inicio como pasaba cuando todas eran hermanas dentro del
// mismo Tabs. La tab bar solo se ve dentro de "(tabs)"; al entrar a una
// pantalla secundaria, queda oculta (igual que la mayoría de apps).
export default function ClientLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id, 'client');

  return (
    <ActiveHelpRequestProvider clientId={profile?.id}>
      <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* business/[id], negocio-catalogo/[id], servicio/[id] y producto/[id] ponen
            su propio título dinámico (nombre real) con <Stack.Screen options={{title}}/>
            desde dentro de la pantalla una vez que cargan los datos. */}
        <Stack.Screen name="business/[id]" options={{ title: 'Negocio' }} />
        <Stack.Screen name="negocio-catalogo/[id]" options={{ title: 'Catálogo' }} />
        {/* historia/[businessId], historia-cliente/[clientId] y chat/[id] ya traen su
            propio botón de regreso (StoryViewer / ChatHeader) -- header nativo apagado
            para no duplicarlo. */}
        <Stack.Screen name="historia/[businessId]" options={{ headerShown: false }} />
        <Stack.Screen name="historias" options={{ title: 'Mis historias' }} />
        <Stack.Screen name="historia-cliente/[clientId]" options={{ headerShown: false }} />
        <Stack.Screen name="publicaciones" options={{ title: 'Mis publicaciones' }} />
        <Stack.Screen name="publicacion/[id]" options={{ title: 'Publicación' }} />
        <Stack.Screen name="anuncio/[id]" options={{ title: 'Anuncio' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="vehiculos" options={{ title: 'Vehículos' }} />
        <Stack.Screen name="historial" options={{ title: 'Historial' }} />
        <Stack.Screen name="servicio/[id]" options={{ title: 'Servicio' }} />
        <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
        <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
        <Stack.Screen name="estado-cuenta" options={{ title: 'Estado de cuenta' }} />
        <Stack.Screen name="agendar" options={{ title: 'Solicitar cita' }} />
        <Stack.Screen name="citas" options={{ title: 'Mis citas' }} />
        <Stack.Screen name="portafolio/[id]" options={{ title: 'Portafolio de trabajos' }} />
      </Stack>
    </ActiveHelpRequestProvider>
  );
}
