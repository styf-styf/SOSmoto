// Ordena por más reciente la primera vez que se carga la sesión (lastSeenAt
// null) -- así lo más nuevo aparece primero al abrir la pantalla. En
// recargas posteriores, lo realmente nuevo desde la última carga sigue yendo
// primero, pero el resto (lo que ya se vio) se mezcla en vez de repetir
// siempre el mismo orden; si no hay nada nuevo, termina siendo todo mezclado.
// Compartido entre HomeFeed (posts/catálogo/anuncios del feed) y Buscar
// (anuncios destacados).
export function applyFreshnessOrder<T>(
  items: T[],
  getCreatedAt: (item: T) => string,
  lastSeenAtRef: { current: string | null }
): T[] {
  const lastSeenAt = lastSeenAtRef.current;
  let result: T[];
  if (lastSeenAt === null) {
    result = items;
  } else {
    const fresh = items.filter((item) => getCreatedAt(item) > lastSeenAt);
    const rest = items.filter((item) => getCreatedAt(item) <= lastSeenAt);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    result = [...fresh, ...rest];
  }
  if (items.length > 0) lastSeenAtRef.current = getCreatedAt(items[0]);
  return result;
}
