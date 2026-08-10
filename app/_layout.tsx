import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../hooks/AuthContext';
import { ThemeProvider, useTheme } from '../hooks/ThemeContext';
import { PilotWelcomeModal } from '../components/PilotWelcomeModal';

// Cualquier ScrollView de la app permite que un tap sobre un botón/tarjeta
// dispare la acción Y cierre el teclado en un solo gesto, sin requerir
// dos taps (uno para cerrar el teclado y otro para la acción).
(ScrollView as any).defaultProps = {
  ...((ScrollView as any).defaultProps ?? {}),
  keyboardShouldPersistTaps: 'handled',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Aparte de RootLayout para poder leer useTheme() -- ese hook solo funciona
// DENTRO de <ThemeProvider>, así que este componente vive anidado ahí.
function RootLayoutInner() {
  const { isDark, colors } = useTheme();
  return (
    <KeyboardProvider>
      {/* Antes fijo a "dark": "auto" no muestreaba el color real debajo de la
          barra y en algunos Android pintaba iconos blancos sobre fondo claro,
          invisibles a simple vista. Ahora que existe el switch de tema en
          Configuración, sigue isDark en vez de quedar fijo -- iconos oscuros
          sobre fondo claro, claros sobre fondo oscuro. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* animation: 'none' -- este Stack solo enruta por rol (auth/cliente/negocio)
          tras el splash; sin esto, la transición nativa por defecto se ve como un
          slide justo cuando aparece Home, dando la sensación de un salto raro. */}
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(business)" />
        <Stack.Screen name="post/[id]" />
        <Stack.Screen name="ad/[id]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="service/[id]" />
        <Stack.Screen name="pago-resultado" />
        <Stack.Screen name="eliminar-cuenta" options={{ headerShown: true, title: 'Eliminar cuenta' }} />
        <Stack.Screen name="enviar-sugerencia" options={{ headerShown: true, title: 'Enviar sugerencia' }} />
        <Stack.Screen name="cuenta-eliminacion-pendiente" />
        <Stack.Screen name="auth-callback" />
        <Stack.Screen name="negocio" />
      </Stack>
      <PilotWelcomeModal />
    </KeyboardProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <RootLayoutInner />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
