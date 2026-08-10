import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { Button } from '../../components/Button';
import { SaveAccountPrompt } from '../../components/SaveAccountPrompt';
import { TextField } from '../../components/TextField';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { useSaveAccountFlow } from '../../hooks/useSaveAccountFlow';
import { resendSignupCode, sendPasswordResetEmail, signIn } from '../../services/auth';
import {
  getSavedAccounts,
  removeSavedAccount,
  switchToAccount,
  type SavedAccount,
} from '../../services/accountSwitcher';

export default function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const saveFlow = useSaveAccountFlow();

  useEffect(() => {
    getSavedAccounts()
      .then(setSavedAccounts)
      .catch((err) => console.error('load saved accounts error', err));
  }, []);

  async function handleQuickSwitch(account: SavedAccount) {
    if (switchingId) return;
    setSwitchingId(account.userId);
    try {
      const result = await switchToAccount(account.userId);
      if (result.ok) {
        router.replace('/');
        return;
      }
      setSavedAccounts((prev) => prev.filter((a) => a.userId !== account.userId));
      setEmail(account.email);
      Alert.alert('Sesión vencida', 'Ingresa tu contraseña para volver a entrar a esta cuenta.');
    } catch (err) {
      console.error('quick switch error', err);
      Alert.alert('Error', 'No se pudo cambiar de cuenta.');
    } finally {
      setSwitchingId(null);
    }
  }

  function handleForgetAccount(userId: string) {
    Alert.alert(
      'Quitar cuenta',
      '¿Quitar esta cuenta del inicio rápido? Vas a necesitar tu contraseña la próxima vez.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await removeSavedAccount(userId).catch((err) => console.error('remove saved account error', err));
            setSavedAccounts((prev) => prev.filter((a) => a.userId !== userId));
          },
        },
      ]
    );
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { user } = await signIn(email.trim(), password);
      if (user) {
        await saveFlow.check(user.id, 'login', () => router.replace('/'));
      } else {
        router.replace('/');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (/email.not.confirmed/i.test(raw)) {
        await resendSignupCode(email.trim()).catch(() => undefined);
        router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
        return;
      }
      const message =
        /invalid.login.credentials|invalid_credentials|wrong.password|user.not.found/i.test(raw)
          ? 'Correo o contraseña incorrectos.'
          : raw || 'No se pudo iniciar sesión. Intenta de nuevo.';
      Alert.alert('Error al iniciar sesión', message);
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
      const trimmedEmail = email.trim();
      await sendPasswordResetEmail(trimmedEmail);
      router.push({ pathname: '/(auth)/reset-password', params: { email: trimmedEmail } });
    } catch (err) {
      console.error('forgot password error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar el correo.');
    } finally {
      setResetting(false);
    }
  }

  const disabled = loading || resetting;

  return (
    <>
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={32} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>SOSmoto</Text>
      <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

      {savedAccounts.length > 0 && (
        <>
          <View style={styles.savedAccountsRow}>
            {savedAccounts.map((account) => (
              <View key={account.userId} style={styles.savedAccountItem}>
                <Pressable
                  onPress={() => handleQuickSwitch(account)}
                  disabled={switchingId !== null}
                  style={styles.savedAvatarWrap}
                >
                  <View style={styles.savedAvatarCircle}>
                    {account.avatarUrl ? (
                      <Image source={{ uri: account.avatarUrl }} style={styles.savedAvatarImage} />
                    ) : (
                      <Ionicons name="person" size={24} color={colors.textMuted} />
                    )}
                  </View>
                  {switchingId === account.userId && (
                    <View style={styles.savedAvatarLoading}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </Pressable>
                <Pressable
                  style={styles.savedRemoveBtn}
                  onPress={() => handleForgetAccount(account.userId)}
                  hitSlop={8}
                  disabled={switchingId !== null}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
                <Text style={styles.savedAccountName} numberOfLines={1}>
                  {account.displayName}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.orDivider}>o usa otra cuenta</Text>
        </>
      )}

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
    savedAccountsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 20,
      marginBottom: 16,
    },
    savedAccountItem: {
      alignItems: 'center',
      width: 76,
    },
    savedAvatarWrap: {
      position: 'relative',
    },
    savedAvatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    savedAvatarImage: {
      width: 56,
      height: 56,
    },
    savedAvatarLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedRemoveBtn: {
      position: 'absolute',
      top: -4,
      right: 6,
      backgroundColor: colors.background,
      borderRadius: 9,
    },
    savedAccountName: {
      fontSize: 11,
      color: colors.text,
      marginTop: 6,
      textAlign: 'center',
    },
    orDivider: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 20,
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
}
