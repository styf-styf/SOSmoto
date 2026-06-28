import AsyncStorage from '@react-native-async-storage/async-storage';

// Persistencia local mínima para detectar la transición limitado -> activo
// entre aperturas de la app (el backend no guarda historial de esto, solo
// el estado actual is_limited/limitation_reason).
export async function wasPreviouslyLimited(key: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key)) === '1';
}

export async function markLimited(key: string): Promise<void> {
  await AsyncStorage.setItem(key, '1');
}

export async function clearLimitedMark(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}
