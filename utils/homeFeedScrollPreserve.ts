// Bus mínimo (mismo patrón que productoServicioStackReset.ts) para que las
// tarjetas del feed le avisen a Inicio que la próxima vez que gane foco fue
// por volver de una publicación, no por un cambio de tab real -- en ese caso
// el useFocusEffect de Inicio debe seguir refrescando en silencio pero SIN
// forzar scrollToTop, para no perder la posición donde el usuario se quedó
// leyendo el feed.
let preserveNextFocusScroll = false;

export function markHomeFeedPreserveScroll() {
  preserveNextFocusScroll = true;
}

// Se consume una sola vez: el primer foco de Inicio después de volver de una
// publicación respeta el scroll y limpia el flag.
export function consumeHomeFeedPreserveScroll(): boolean {
  if (preserveNextFocusScroll) {
    preserveNextFocusScroll = false;
    return true;
  }
  return false;
}
