import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { setPendingPaymentResult } from '../utils/pendingDeepLink';

const TARGET_BY_TYPE: Record<string, string> = {
  subscription: '/(business)/suscripcion',
  advertising: '/(business)/publicidad',
};

const LABEL_BY_TYPE: Record<string, string> = {
  subscription: 'de tu plan',
  advertising: 'de tu campaña',
};

// Destino del botón "Volver a SOSmoto" en la página de confirmación de pago
// (web/api/payphone-return.js, sosmoto://pago-resultado?tipo=...&ok=...).
// Quien inició el pago estaba logueado como negocio, pero no necesariamente
// en ESTE dispositivo/app (el pago pudo iniciarse desde el navegador -- ej.
// el negocio nunca abrió la app en ese celular, o su sesión ahí venció). Si
// no hay sesión activa acá, se guarda tipo/ok como "pago pendiente" (mismo
// patrón que post/ad/product/service en app/{post,ad,...}/[id].tsx) antes de
// mandar a login -- sin esto, tras loguearse caía al home en vez de a Plan y
// suscripción/Publicidad (ver utils/pendingDeepLink.ts).
export default function PagoResultado() {
  const colors = useColors();
  const { tipo, ok } = useLocalSearchParams<{ tipo?: string; ok?: string }>();
  const { profile, loading } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (loading || handledRef.current) return;
    handledRef.current = true;

    if (!profile) {
      setPendingPaymentResult(tipo ?? '', ok ?? '1').finally(() => router.replace('/(auth)/login'));
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
