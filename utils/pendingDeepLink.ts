import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pendingDeepLink';
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingDeepLinkKind = 'post' | 'ad' | 'product' | 'service';

interface StoredPendingDeepLink {
  kind: PendingDeepLinkKind;
  id: string;
  savedAt: number;
}

export async function setPendingDeepLink(kind: PendingDeepLinkKind, id: string): Promise<void> {
  const value: StoredPendingDeepLink = { kind, id, savedAt: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}

// Lee y borra el link pendiente en un solo paso -- una vez consumido (o
// descartado por vencido) no debe volver a aplicarse en un próximo login.
export async function consumePendingDeepLink(): Promise<{ kind: PendingDeepLinkKind; id: string } | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(raw) as StoredPendingDeepLink;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return { kind: parsed.kind, id: parsed.id };
  } catch {
    return null;
  }
}
