import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { sendPasswordResetEmail, updatePassword, verifyRecoveryCode } from '../../services/auth';
import { translateAuthError } from '../../utils/authErrors';

export default function ResetPasswordScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { email } = useLocalSearchParams<{ email?: string }>();
  // Sin `email`: se llegó ya autenticado vía el link "Verificar
  // automáticamente" del correo (ver auth-callback.tsx, que ya hizo el
  // exchangeCodeForSession) -- no hace falta pedir el código de nuevo.
  const viaLink = !email;
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    if (!viaLink && code.trim().length !== 8) {
      Alert.alert('Código incompleto', 'Ingresa el código de 8 dígitos que enviamos a tu correo.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Usa al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Las contraseñas no coinciden', 'Revisa ambos campos.');
      return;
    }
    setLoading(true);
    try {
      if (!viaLink) {
        await verifyRecoveryCode(email, code.trim());
      }
      await updatePassword(password);
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? translateAuthError(err.message) : 'No se pudo restablecer la contraseña.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await sendPasswordResetEmail(email);
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
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={32} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Restablecer contraseña</Text>
      <Text style={styles.subtitle}>
        {viaLink ? 'Elige tu nueva contraseña.' : `Enviamos un código de 8 dígitos a\n${email}`}
      </Text>

      {!viaLink && (
        <TextField
          label="Código de verificación"
          placeholder="12345678"
          keyboardType="number-pad"
          maxLength={8}
          value={code}
          onChangeText={setCode}
          editable={!disabled}
        />
      )}
      <TextField
        label="Nueva contraseña"
        placeholder="********"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!disabled}
      />
      <TextField
        label="Confirmar nueva contraseña"
        placeholder="********"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!disabled}
      />

      <Button title="Restablecer" onPress={handleSubmit} loading={loading} disabled={disabled} style={styles.submitButton} />
      {!viaLink && (
        <Button
          title={resending ? 'Reenviando…' : 'Reenviar código'}
          onPress={handleResend}
          disabled={disabled}
          variant="secondary"
        />
      )}
    </KeyboardAwareScrollView>
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
