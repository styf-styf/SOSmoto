import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { SaveAccountPrompt } from '../../components/SaveAccountPrompt';
import { TextField } from '../../components/TextField';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { useSaveAccountFlow } from '../../hooks/useSaveAccountFlow';
import { resendSignupCode, verifySignupCode } from '../../services/auth';
import { translateAuthError } from '../../utils/authErrors';

export default function VerifyEmailScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const saveFlow = useSaveAccountFlow();

  async function handleVerify() {
    if (code.trim().length !== 8) {
      Alert.alert('Código incompleto', 'Ingresa el código de 8 dígitos que enviamos a tu correo.');
      return;
    }
    setLoading(true);
    try {
      const data = await verifySignupCode(email, code.trim());
      if (data.session && data.user) {
        await saveFlow.check(data.user.id, 'signup', () => router.replace('/'));
      } else {
        router.replace('/');
      }
    } catch (err) {
      const message = err instanceof Error ? translateAuthError(err.message) : 'No se pudo verificar el código.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendSignupCode(email);
      Alert.alert('Código reenviado', 'Revisa tu correo.');
    } catch (err) {
      const message = err instanceof Error ? translateAuthError(err.message) : 'No se pudo reenviar el código.';
      Alert.alert('Error', message);
    } finally {
      setResending(false);
    }
  }

  const disabled = loading || resending;

  return (
    <>
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={32} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Verifica tu correo</Text>
      <Text style={styles.subtitle}>Enviamos un código de 8 dígitos a{'\n'}{email}</Text>

      <TextField
        label="Código de verificación"
        placeholder="12345678"
        keyboardType="number-pad"
        maxLength={8}
        value={code}
        onChangeText={setCode}
        editable={!disabled}
      />

      <Button title="Verificar" onPress={handleVerify} loading={loading} disabled={disabled} style={styles.submitButton} />
      <Button
        title={resending ? 'Reenviando…' : 'Reenviar código'}
        onPress={handleResend}
        disabled={disabled}
        variant="secondary"
      />
    </KeyboardAwareScrollView>
    <SaveAccountPrompt
      visible={saveFlow.visible}
      displayName={saveFlow.displayName}
      email={saveFlow.email}
      avatarUrl={saveFlow.avatarUrl}
      saving={saveFlow.saving}
      onSave={saveFlow.onSave}
      onSkip={saveFlow.onSkip}
    />
    </>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
    },
    submitButton: {
      marginTop: 4,
      marginBottom: 12,
    },
  });
}
