import { Stack } from 'expo-router';
import { useColors } from '../../hooks/ThemeContext';

export default function AuthLayout() {
  const colors = useColors();
  return (
    // contentStyle: sin esto, el fondo detrás/alrededor de la pantalla durante
    // la animación de push/pop queda blanco fijo -- franja blanca en oscuro.
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
