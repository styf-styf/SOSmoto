import 'react-native-get-random-values';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Patrón documentado por Supabase para Expo: la sesión completa (JWT +
// refresh token + metadata) puede superar el límite de ~2KB por clave de
// SecureStore (iOS Keychain / Android Keystore), así que no se guarda ahí
// directo. En cambio: se cifra con una clave AES-256 generada al vuelo, esa
// clave sí cabe en SecureStore, y el blob cifrado (de cualquier tamaño) va a
// AsyncStorage como texto ininteligible -- antes de este cambio la sesión
// completa vivía en AsyncStorage sin cifrar (legible con acceso físico al
// teléfono o un backup sin cifrar del dispositivo).
export class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  // Sesiones viejas (guardadas antes de este cambio) no tienen clave en
  // SecureStore -- se tratan como "no hay sesión" en vez de intentar
  // descifrar algo que nunca se cifró, que haría crashear la app.
  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    try {
      return await this.decrypt(key, encrypted);
    } catch {
      // Valor corrupto/no descifrable (ej. formato viejo distinto) -- mismo
      // criterio que "no hay clave": tratarlo como sesión inexistente.
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}
