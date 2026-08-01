import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './largeSecureStore';
import type { Database } from '../types/supabase';
// Reactivado 2026-08-01 junto con el build nativo que por fin compila
// react-native-get-random-values -- antes de esa fecha este mismo cambio
// rompió la sesión en producción (el módulo nativo no estaba compilado en
// el binario instalado, ver services/largeSecureStore.ts). No reactivar
// esto vía `eas update` (OTA) sin confirmar antes que el binario instalado
// realmente tiene el módulo nativo compilado -- un OTA no puede agregarlo.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE en vez de implicit: el link de confirmación/recuperación en el
    // correo redirige a sosmoto://auth-callback?code=... (query param, fácil
    // de leer con useLocalSearchParams) en vez de #access_token=... en el
    // fragmento, mucho más frágil de parsear en un deep link nativo.
    flowType: 'pkce',
  },
});
