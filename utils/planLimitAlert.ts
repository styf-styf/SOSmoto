import { Alert } from 'react-native';
import { router } from 'expo-router';

// Todas las funciones que bloquean por límite/beneficio de plan (ver
// services/catalog.ts, services/employees.ts, CreateBusinessStoryModal.tsx)
// tiran un Error con "Sube de plan"; los triggers de backend que hacen la
// misma validación como respaldo (ver enforce_story_limit y similares)
// usan en cambio "Límite del plan" -- cualquiera de las dos frases marca
// que vale la pena ofrecer el botón "Ver planes" en el Alert, sin
// mostrarlo en errores que no tienen nada que ver con el plan (ej. falla
// de red al guardar).
const PLAN_LIMIT_PATTERN = /sube de plan|l[ií]mite del? plan/i;

export function showPlanAwareError(title: string, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  if (PLAN_LIMIT_PATTERN.test(message)) {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ver planes', onPress: () => router.push('/(business)/suscripcion') },
    ]);
  } else {
    Alert.alert(title, message);
  }
}
