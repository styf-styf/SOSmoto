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

// Mismo patrón que arriba, pero para app/pago-resultado.tsx (botón "Volver a
// SOSmoto" tras pagar en web/api/payphone-checkout.js). Ese pago pudo
// iniciarse desde el navegador (ej. el negocio nunca abrió la app en ese
// celular, o su sesión ahí venció) -- si al abrir el deep link no hay sesión
// activa en la app, pago-resultado.tsx manda a login SIN esto se perdía el
// tipo/resultado del pago para siempre, y tras loguearse cae al home en vez
// de a Plan y suscripción/Publicidad.
const PAYMENT_RESULT_KEY = 'pendingPaymentResult';

interface StoredPendingPaymentResult {
  tipo: string;
  ok: string;
  savedAt: number;
}

export async function setPendingPaymentResult(tipo: string, ok: string): Promise<void> {
  const value: StoredPendingPaymentResult = { tipo, ok, savedAt: Date.now() };
  await AsyncStorage.setItem(PAYMENT_RESULT_KEY, JSON.stringify(value));
}

export async function consumePendingPaymentResult(): Promise<{ tipo: string; ok: string } | null> {
  const raw = await AsyncStorage.getItem(PAYMENT_RESULT_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(PAYMENT_RESULT_KEY);
  try {
    const parsed = JSON.parse(raw) as StoredPendingPaymentResult;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return { tipo: parsed.tipo, ok: parsed.ok };
  } catch {
    return null;
  }
}
