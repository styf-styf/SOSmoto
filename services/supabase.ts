import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { LargeSecureStore } from './largeSecureStore';

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
