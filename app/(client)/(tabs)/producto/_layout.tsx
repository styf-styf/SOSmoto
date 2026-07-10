import { Stack } from 'expo-router';
import { AppHeader } from '../../../../components/AppHeader';

// Stack anidado dentro del tab "producto" (href: null, sin botón propio) --
// así cada producto visitado se apila (Producto A -> B -> C, "atrás" hace
// pop normal entre ellos) mientras la tab bar de (tabs) se mantiene visible,
// porque técnicamente seguimos dentro del navegador de Tabs. El reinicio de
// la pila al volver a Inicio se maneja desde [id].tsx (ver
// utils/productoServicioStackReset.ts), no acá.
export default function ProductoLayout() {
  return <Stack screenOptions={{ header: (props) => <AppHeader {...props} /> }} />;
}
