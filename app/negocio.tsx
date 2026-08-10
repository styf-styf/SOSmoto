import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// Destino genérico de "Ver en SOSmoto" para correos que no son de pago
// (KYC aprobado/rechazado, sugerencia de crecimiento, etc.) --
// sosmoto://negocio?seccion=verificacion, similar a pago-resultado.tsx pero
// sin la lógica de alerta de pago (no aplica acá).
export default function NegocioResultado() {
  const colors = useColors();
  const { seccion } = useLocalSearchParams<{ seccion?: string }>();
  const { profile, loading } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current) return;
    handledRef.current = true;

    if (!profile) {
      router.replace('/(auth)/login');
      return;
    }
    router.replace(seccion ? `/(business)/${seccion}` : '/(business)');
  }, [loading, profile, seccion]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
