import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';

const TARGET_BY_TYPE: Record<string, string> = {
  subscription: '/(business)/suscripcion',
  advertising: '/(business)/publicidad',
};

const LABEL_BY_TYPE: Record<string, string> = {
  subscription: 'de tu plan',
  advertising: 'de tu campaña',
};

// Destino del botón "Volver a SOSmoto" en la página de confirmación de pago
// (web/api/payphone-return.js, sosmoto://pago-resultado?tipo=...&ok=...). A
// diferencia de los resolvers de post/ad/product/service (app/{post,ad,...}
// /[id].tsx), pensados para un link compartido que puede abrir alguien sin
// sesión, quien llega aquí ya estaba logueado como negocio cuando inició el
// pago (Payphone lo exige) -- así que no hace falta la maquinaria de "deep
// link pendiente" para retomar tras login, solo aterrizar directo.
export default function PagoResultado() {
  const { tipo, ok } = useLocalSearchParams<{ tipo?: string; ok?: string }>();
  const { profile, loading } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current) return;
    handledRef.current = true;

    if (!profile) {
      router.replace('/(auth)/login');
      return;
    }
    const target = TARGET_BY_TYPE[tipo ?? ''] ?? '/(business)';
    // ok='0' significa que payphone-return.js no pudo confirmar el cobro
    // (rechazado, o todavía pendiente) -- sin este aviso, esa pantalla se ve
    // idéntica a una que el propio negocio decidió cancelar.
    if (ok === '0') {
      Alert.alert(
        'No pudimos confirmar tu pago',
        `Si ya pagaste, la confirmación puede tardar unos segundos más y se reflejará sola. Si el cobro fue rechazado, no se aplicó ningún cambio ${LABEL_BY_TYPE[tipo ?? ''] ?? ''}.`.trim(),
        [{ text: 'Entendido', onPress: () => router.replace(target) }],
      );
      return;
    }
    router.replace(target);
  }, [loading, profile, tipo, ok]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
