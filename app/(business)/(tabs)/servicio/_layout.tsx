import { Stack } from 'expo-router';
import { AppHeader } from '../../../../components/AppHeader';
import { useColors } from '../../../../hooks/ThemeContext';

// Mismo motivo que producto/_layout.tsx: stack anidado dentro del tab
// "servicio" para que el historial de navegación se apile con la tab bar
// visible. El reinicio de la pila al volver a Inicio se maneja desde
// [id].tsx (ver utils/productoServicioStackReset.ts), no acá.
export default function ServicioLayout() {
  const colors = useColors();
  // contentStyle: sin esto, el fondo detrás/alrededor de la pantalla durante
  // la animación de push/pop queda blanco fijo -- franja blanca en oscuro.
  return <Stack screenOptions={{ header: (props) => <AppHeader {...props} />, contentStyle: { backgroundColor: colors.background } }} />;
}
