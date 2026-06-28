import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Link, router } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { sendPasswordResetEmail, signIn } from '../../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (err) {
      console.error('login error', err);
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Ingresa tu correo', 'Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(email.trim());
      Alert.alert('Correo enviado', 'Revisa tu bandeja de entrada para restablecer tu contraseña.');
    } catch (err) {
      console.error('forgot password error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setResetting(false);
    }
  }

  const disabled = loading || resetting;

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={32}>
      <Text style={styles.title}>SOSmoto</Text>
      <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

      <TextField
        label="Correo electrónico"
        placeholder="tucorreo@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!disabled}
      />
      <TextField
        label="Contraseña"
        placeholder="********"
        secureTextEntry={!showPassword}
        value={password}
        onChangeText={setPassword}
        editable={!disabled}
        rightIcon={{
          name: showPassword ? 'eye-off-outline' : 'eye-outline',
          onPress: () => setShowPassword((v) => !v),
        }}
      />

      <Pressable onPress={handleForgotPassword} disabled={disabled} style={styles.forgotLink}>
        <Text style={styles.forgotLinkText}>{resetting ? 'Enviando…' : '¿Olvidaste tu contraseña?'}</Text>
      </Pressable>

      <Button title="Iniciar sesión" onPress={handleLogin} loading={loading} disabled={disabled} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tienes cuenta? </Text>
        <Link href="/(auth)/register" style={styles.link}>
          Regístrate
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
