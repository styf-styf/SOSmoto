import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  getSavedAccounts,
  removeSavedAccount,
  resolveAccountDisplayInfo,
  saveCurrentSessionAsAccount,
} from '../services/accountSwitcher';

// Fila de Configuración para guardar/quitar la cuenta activa del switcher de
// inicio rápido (ver services/accountSwitcher.ts) -- cubre a quien tocó
// "Omitir" en el prompt de login/registro y luego cambia de opinión. Mismo
// hook para cliente y negocio (app/(client)/configuracion.tsx y
// app/(business)/configuracion.tsx), la lógica de guardar/quitar es idéntica
// para ambos roles.
export function useSavedAccountToggle(userId: string | undefined) {
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!userId) {
      setChecking(false);
      return;
    }
    let isCurrent = true;
    getSavedAccounts()
      .then((accounts) => {
        if (isCurrent) setSaved(accounts.some((a) => a.userId === userId));
      })
      .catch((err) => console.error('check saved account error', err))
      .finally(() => {
        if (isCurrent) setChecking(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  async function onPress() {
    if (!userId || working) return;
    setWorking(true);
    try {
      if (saved) {
        await removeSavedAccount(userId);
        setSaved(false);
      } else {
        const info = await resolveAccountDisplayInfo(userId);
        if (!info) throw new Error('No se pudo leer tu perfil.');
        await saveCurrentSessionAsAccount(userId, info);
        setSaved(true);
        Alert.alert(
          'Cuenta guardada',
          'Ahora puedes cambiar a esta cuenta rápido desde la pantalla de inicio de sesión, sin volver a escribir tu contraseña.'
        );
      }
    } catch (err) {
      console.error('toggle saved account error', err);
      Alert.alert('Error', 'No se pudo actualizar. Intenta de nuevo.');
    } finally {
      setWorking(false);
    }
  }

  return { saved, checking, working, onPress };
}
