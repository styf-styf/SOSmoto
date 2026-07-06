import { Stack } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { AppHeader } from '../../components/AppHeader';

// Mismo motivo que app/(client)/_layout.tsx: Stack real envolviendo el
// navegador de Tabs en "(tabs)" para que "atrás" haga pop pantalla por
// pantalla en vez de saltar siempre a Inicio.
export default function BusinessLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id, 'business');

  return (
    <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* chat/[id], historia/[businessId] y historia-cliente/[clientId] ya traen su
          propio botón de regreso (ChatHeader / StoryViewer) -- header nativo apagado
          para no duplicarlo. */}
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="historia/[businessId]" options={{ headerShown: false }} />
      <Stack.Screen name="historia-cliente/[clientId]" options={{ headerShown: false }} />
      <Stack.Screen name="publicaciones" options={{ title: 'Publicaciones' }} />
      <Stack.Screen name="publicacion/[id]" options={{ title: 'Publicación' }} />
      <Stack.Screen name="business/[id]" options={{ title: 'Perfil del negocio' }} />
      <Stack.Screen name="anuncio/[id]" options={{ title: 'Anuncio' }} />
      <Stack.Screen name="empleados" options={{ title: 'Equipo' }} />
      <Stack.Screen name="suscripcion" options={{ title: 'Plan y suscripción' }} />
      <Stack.Screen name="agenda-negocio" options={{ title: 'Agenda' }} />
      <Stack.Screen name="nueva-cita" options={{ title: 'Nueva cita' }} />
      <Stack.Screen name="nuevo-informe" options={{ title: 'Nuevo informe' }} />
      <Stack.Screen name="informe/[id]" options={{ title: 'Informe de servicio' }} />

      <Stack.Screen name="clientes" options={{ title: 'Mis clientes' }} />
      <Stack.Screen name="cliente/[id]" options={{ title: 'Perfil del cliente' }} />
      <Stack.Screen name="cliente-externo" options={{ title: 'Cliente externo' }} />
      <Stack.Screen name="nuevo-cliente" options={{ title: 'Nuevo cliente' }} />
<Stack.Screen name="mantenimiento-proactivo" options={{ title: 'Recordatorios de mantenimiento' }} />
      <Stack.Screen name="publicidad" options={{ title: 'Publicidad' }} />
      <Stack.Screen name="historias" options={{ title: 'Historias' }} />
      <Stack.Screen name="configuracion" options={{ title: 'Configuración' }} />
      <Stack.Screen name="verificacion" options={{ title: 'Verificación de negocio' }} />
      <Stack.Screen name="estado-cuenta" options={{ title: 'Estado de cuenta' }} />
      <Stack.Screen name="estadisticas" options={{ title: 'Estadísticas' }} />
      <Stack.Screen name="crece-tu-negocio" options={{ title: 'Crece tu negocio' }} />
    </Stack>
  );
}
