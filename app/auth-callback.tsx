import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../services/supabase';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { translateAuthError } from '../utils/authErrors';

// Destino del botón "Verificar automáticamente" del correo de confirmación
// de registro y de recuperar contraseña (sosmoto://auth-callback?flow=...
// &code=...), alternativa a tipear el código de 6 dígitos a mano (ver
// verify-email.tsx / reset-password.tsx). flowType: 'pkce' en
// services/supabase.ts hace que este link traiga el código como query param
// (?code=) en vez de en el fragmento (#access_token=...), mucho más simple
// de leer acá. Mismo patrón de deep link ya probado en pago-resultado.tsx.
export default function AuthCallback() {
  const colors = useColors();
  const { code, flow, error_description } = useLocalSearchParams<{
    code?: string;
    flow?: string;
    error_description?: string;
  }>();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    (async () => {
      if (error_description) {
        Alert.alert('Error', decodeURIComponent(error_description));
        router.replace('/(auth)/login');
        return;
      }
      if (!code) {
        router.replace('/(auth)/login');
        return;
      }
      try {
        await supabase.auth.exchangeCodeForSession(code);
        if (flow === 'recovery') {
          router.replace('/(auth)/reset-password');
        } else {
          router.replace('/');
        }
      } catch (err) {
        const message = err instanceof Error ? translateAuthError(err.message) : 'El link no es válido o ya expiró.';
        Alert.alert('Error', message);
        router.replace('/(auth)/login');
      }
    })();
  }, [code, flow, error_description]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
