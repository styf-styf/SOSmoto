import { useCallback, useState } from 'react';
import {
  resolveAccountDisplayInfo,
  saveCurrentSessionAsAccount,
  shouldPromptSaveAccount,
} from '../services/accountSwitcher';

interface PromptState {
  userId: string;
  email: string;
  role: 'client' | 'business';
  displayName: string;
  avatarUrl: string | null;
  onResolved: () => void;
}

// Un solo hook para las 3 pantallas que necesitan mostrar el prompt "Guarda
// tu cuenta" después de resolver una sesión (login, registro directo,
// verificación de correo): decide si corresponde preguntar, resuelve
// nombre/avatar a mostrar, y solo llama a `onResolved` (que cada pantalla
// usa para navegar) una vez que el usuario responde -- o de inmediato si no
// corresponde preguntar.
export function useSaveAccountFlow() {
  const [state, setState] = useState<PromptState | null>(null);
  const [saving, setSaving] = useState(false);

  const check = useCallback(
    async (userId: string, context: 'login' | 'signup', onResolved: () => void) => {
      try {
        const should = await shouldPromptSaveAccount(userId, context);
        if (!should) {
          onResolved();
          return;
        }
        const info = await resolveAccountDisplayInfo(userId);
        if (!info) {
          onResolved();
          return;
        }
        setState({ userId, ...info, onResolved });
      } catch (err) {
        console.error('check save account prompt error', err);
        onResolved();
      }
    },
    []
  );

  async function handleSave() {
    if (!state) return;
    setSaving(true);
    try {
      await saveCurrentSessionAsAccount(state.userId, {
        email: state.email,
        role: state.role,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
      });
    } catch (err) {
      console.error('save account error', err);
    } finally {
      setSaving(false);
      const onResolved = state.onResolved;
      setState(null);
      onResolved();
    }
  }

  function handleSkip() {
    if (!state) return;
    const onResolved = state.onResolved;
    setState(null);
    onResolved();
  }

  return {
    visible: !!state,
    displayName: state?.displayName ?? '',
    email: state?.email ?? '',
    avatarUrl: state?.avatarUrl ?? null,
    saving,
    onSave: handleSave,
    onSkip: handleSkip,
    check,
  };
}
