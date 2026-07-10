// Bus mínimo para que el tab Inicio le avise a las pantallas de
// producto/servicio (dentro de (tabs)) que la próxima vez que se entre ahí
// deben reiniciar su pila -- ver (tabs)/producto/[id].tsx y
// (tabs)/servicio/[id].tsx. No hay relación de padre/hijo directa entre
// index.tsx y esas pantallas (viven como hermanos dentro del mismo
// navegador de Tabs), así que se coordinan por este módulo en vez de
// props/context anidado.
//
// Flags separados para producto y servicio: si tras volver a Inicio el
// usuario entra primero a un producto y luego a un servicio (o viceversa),
// ambas pilas deben reiniciarse de forma independiente, no solo la primera
// que se visite.
type Kind = 'producto' | 'servicio';

const pending: Record<Kind, boolean> = { producto: false, servicio: false };

export function markProductoServicioStacksForReset() {
  pending.producto = true;
  pending.servicio = true;
}

// Se consume una sola vez: la primera pantalla de ese tipo que gane foco
// después de volver a Inicio hace el reset y limpia el flag.
export function consumeProductoServicioResetFlag(kind: Kind): boolean {
  if (pending[kind]) {
    pending[kind] = false;
    return true;
  }
  return false;
}
