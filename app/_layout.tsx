import { ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../hooks/AuthContext';

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <KeyboardProvider>
          <StatusBar style="auto" />
          {/* animation: 'none' -- este Stack solo enruta por rol (auth/cliente/negocio)
              tras el splash; sin esto, la transición nativa por defecto se ve como un
              slide justo cuando aparece Home, dando la sensación de un salto raro. */}
          <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(client)" />
            <Stack.Screen name="(business)" />
          </Stack>
        </KeyboardProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
