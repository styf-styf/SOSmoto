import { supabase } from './supabase';
import { getMyWorkBusiness } from './businesses';
import { LargeSecureStore } from './largeSecureStore';

// Guarda varias sesiones completas en el dispositivo (cifradas, mismo
// mecanismo que la sesión activa de Supabase) para cambiar de cuenta con un
// toque -- sin volver a pedir contraseña -- en vez de cerrar sesión y
// escribir todo de nuevo. Patrón "cambiar de cuenta" tipo Facebook/Gmail.
//
// NOTA: depende de LargeSecureStore, que a su vez depende de
// react-native-get-random-values (módulo nativo). Ese módulo no está
// compilado en el binario instalado hoy -- este feature completo queda
// listo en el código pero solo debe publicarse (OTA) junto con o después
// del próximo build nativo. Ver el comentario en services/supabase.ts.
const ACCOUNTS_KEY = 'sosmoto_saved_accounts';
const secureStore = new LargeSecureStore();

export interface SavedAccount {
  userId: string;
  email: string;
  role: 'client' | 'business';
  displayName: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string;
  savedAt: string;
}

export async function getSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await secureStore.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

async function writeSavedAccounts(accounts: SavedAccount[]): Promise<void> {
  await secureStore.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// login: solo pregunta si ya hay otra cuenta guardada (si es la única cuenta
// del dispositivo, no tiene sentido "cambiar rápido" a nada -- se comporta
// igual que hoy, sin fricción nueva para el caso normal de una sola cuenta).
// signup: siempre pregunta -- crear cuenta es una acción deliberada y poco
// frecuente, no rutinaria como el login.
export async function shouldPromptSaveAccount(
  userId: string,
  context: 'login' | 'signup'
): Promise<boolean> {
  const saved = await getSavedAccounts();
  if (saved.some((a) => a.userId === userId)) return false;
  if (context === 'signup') return true;
  return saved.length > 0;
}

export interface AccountDisplayInfo {
  email: string;
  role: 'client' | 'business';
  displayName: string;
  avatarUrl: string | null;
}

// Si es negocio, muestra nombre/logo del NEGOCIO, no del dueño a título
// personal -- mismo criterio de identidad que ya se aplica en el resto de
// la app (ver fix de "identidad de negocio siempre gana").
export async function resolveAccountDisplayInfo(userId: string): Promise<AccountDisplayInfo | null> {
  const { data: user, error } = await supabase
    .from('users')
    .select('email, full_name, avatar_url, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !user) return null;

  if (user.role === 'business') {
    const work = await getMyWorkBusiness(userId).catch(() => null);
    if (work) {
      return {
        email: user.email ?? '',
        role: 'business',
        displayName: work.business.name,
        avatarUrl: work.business.logo_url ?? null,
      };
    }
  }

  return {
    email: user.email ?? '',
    role: user.role === 'business' ? 'business' : 'client',
    displayName: user.full_name,
    avatarUrl: user.avatar_url ?? null,
  };
}

export async function saveCurrentSessionAsAccount(
  userId: string,
  info: AccountDisplayInfo
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  // Si la sesión activa ya no es la de este usuario (ej. se demoró en
  // responder el prompt y mientras tanto pasó algo raro), no guardar nada
  // desincronizado.
  if (!session || session.user.id !== userId) return;

  const accounts = await getSavedAccounts();
  const next = accounts.filter((a) => a.userId !== userId);
  next.push({
    userId,
    email: info.email,
    role: info.role,
    displayName: info.displayName,
    avatarUrl: info.avatarUrl,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    savedAt: new Date().toISOString(),
  });
  await writeSavedAccounts(next);
}

// Supabase rota el refresh token cada vez que se usa -- si la cuenta activa
// está guardada, hay que mantener su token actualizado acá, si no, la
// próxima vez que se intente volver a ella desde el switcher, el token
// guardado ya estaría vencido y el cambio fallaría.
export async function syncActiveAccountTokens(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const accounts = await getSavedAccounts();
  const idx = accounts.findIndex((a) => a.userId === userId);
  if (idx === -1) return;
  if (accounts[idx].accessToken === accessToken && accounts[idx].refreshToken === refreshToken) return;
  accounts[idx] = { ...accounts[idx], accessToken, refreshToken };
  await writeSavedAccounts(accounts);
}

export async function removeSavedAccount(userId: string): Promise<void> {
  const accounts = await getSavedAccounts();
  await writeSavedAccounts(accounts.filter((a) => a.userId !== userId));
}

export type SwitchAccountResult = { ok: true } | { ok: false; email: string };

export async function switchToAccount(userId: string): Promise<SwitchAccountResult> {
  const accounts = await getSavedAccounts();
  const account = accounts.find((a) => a.userId === userId);
  if (!account) return { ok: false, email: '' };

  const { error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error) {
    // El refresh token ya no sirve (vencido/revocado, ej. cambió la
    // contraseña en otro dispositivo) -- se quita de la lista para no
    // seguir ofreciéndolo como acceso rápido cuando ya no funciona.
    await removeSavedAccount(userId);
    return { ok: false, email: account.email };
  }
  return { ok: true };
}
