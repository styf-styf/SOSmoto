import { Stack } from 'expo-router';
import { AppHeader } from '../../../../components/AppHeader';

// Mismo motivo que producto/_layout.tsx: stack anidado dentro del tab
// "servicio" para que el historial de navegación se apile con la tab bar
// visible. El reinicio de la pila al volver a Inicio se maneja desde
// [id].tsx (ver utils/productoServicioStackReset.ts), no acá.
export default function ServicioLayout() {
  return <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }} />;
}
