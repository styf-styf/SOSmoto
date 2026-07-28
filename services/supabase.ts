import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
// LargeSecureStore (cifrado de sesión) queda listo en services/largeSecureStore.ts
// pero SIN USAR todavía a propósito: requiere react-native-get-random-values,
// un módulo nativo que no está compilado en el binario instalado hoy (`eas
// update` publica todo el JS del repo sin importar qué build nativo tiene
// cada usuario -- este archivo se activó por error antes de tiempo y rompió
// la sesión en producción). Volver a activarlo recién junto con el próximo
// build nativo (ver memoria "EAS build pending").

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
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
