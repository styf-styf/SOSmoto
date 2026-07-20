import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';

const TARGET_BY_TYPE: Record<string, string> = {
  subscription: '/(business)/suscripcion',
  advertising: '/(business)/publicidad',
};

// Destino del botón "Volver a SOSmoto" en la página de confirmación de pago
// (web/api/payphone-return.js, sosmoto://pago-resultado?tipo=...). A
// diferencia de los resolvers de post/ad/product/service (app/{post,ad,...}
// /[id].tsx), pensados para un link compartido que puede abrir alguien sin
// sesión, quien llega aquí ya estaba logueado como negocio cuando inició el
// pago (Payphone lo exige) -- así que no hace falta la maquinaria de "deep
// link pendiente" para retomar tras login, solo aterrizar directo.
export default function PagoResultado() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const { profile, loading } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current) return;
    handledRef.current = true;

    if (!profile) {
      router.replace('/(auth)/login');
      return;
    }
    router.replace(TARGET_BY_TYPE[tipo ?? ''] ?? '/(business)');
  }, [loading, profile, tipo]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
