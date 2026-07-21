import { Stack } from 'expo-router';
import { ActiveHelpRequestProvider } from '../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { AppHeader } from '../../components/AppHeader';

// Stack real envolviendo el navegador de Tabs (en "(tabs)") -- así el
// botón/gesto de "atrás" en las pantallas secundarias (chat, catálogo, etc.)
// hace un pop normal, pantalla por pantalla, en vez de saltar siempre a
// Inicio como pasaba cuando todas eran hermanas dentro del mismo Tabs. La tab
// bar solo se ve dentro de "(tabs)"; al entrar a una pantalla secundaria,
// queda oculta (igual que la mayoría de apps) -- excepto producto/ y
// servicio/, que viven dentro de "(tabs)" (href: null) a propósito para que
// la tab bar siga visible ahí; cada una tiene su propio Stack anidado
// (ver (tabs)/producto/_layout.tsx) así que sí conservan header y botón
// atrás real, apilando cada item visitado.
export default function ClientLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id, 'client');

  return (
    <ActiveHelpRequestProvider clientId={profile?.id}>
      <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* business/[id] y negocio-catalogo/[id] ponen su propio título dinámico
            (nombre real) con <Stack.Screen options={{title}}/> desde dentro de
            la pantalla una vez que cargan los datos. */}
        <Stack.Screen name="business/[id]" options={{ title: 'Negocio' }} />
        <Stack.Screen name="negocio-catalogo/[id]" options={{ title: 'Catálogo' }} />
        {/* historia/[businessId], historia-cliente/[clientId] y chat/[id] ya traen su
            propio botón de regreso (StoryViewer / ChatHeader) -- header nativo apagado
            para no duplicarlo. */}
        <Stack.Screen name="historia/[businessId]" options={{ headerShown: false }} />
        <Stack.Screen name="historia-cliente/[clientId]" options={{ headerShown: false }} />
        <Stack.Screen name="publicacion/[id]" options={{ title: 'Publicación' }} />
        <Stack.Screen name="anuncio/[id]" options={{ title: 'Anuncio' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/asistente" options={{ headerShown: false }} />
        <Stack.Screen name="vehiculos" options={{ title: 'Vehículos' }} />
        <Stack.Screen name="historial" options={{ title: 'Historial' }} />
        <Stack.Screen name="mis-compras" options={{ title: 'Mis compras' }} />
        <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
        <Stack.Screen name="notificaciones-preferencias" options={{ title: 'Notificaciones' }} />
        <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
        <Stack.Screen name="datos-personales" options={{ title: 'Perfil personal' }} />
        <Stack.Screen name="cambiar-password" options={{ title: 'Contraseña' }} />
        <Stack.Screen name="estado-cuenta" options={{ title: 'Estado de cuenta' }} />
        <Stack.Screen name="agendar" options={{ title: 'Solicitar cita' }} />
        <Stack.Screen name="citas" options={{ title: 'Mis citas' }} />
        <Stack.Screen name="informe/[id]" options={{ title: 'Informe de servicio' }} />
        <Stack.Screen name="invitaciones" options={{ title: 'Invitaciones' }} />
        <Stack.Screen name="usuario/[id]" options={{ title: 'Perfil' }} />
</Stack>
    </ActiveHelpRequestProvider>
  );
}
