import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from '../../components/Button';
import { ChangePasswordCard } from '../../components/ChangePasswordCard';
import { TextField } from '../../components/TextField';
import { useColors } from '../../hooks/ThemeContext';
import type { ColorTheme } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/users';

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function IconInfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.iconRow, !last && styles.iconRowSpacing]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.iconRowText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function DatosPersonalesScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  function handleCancelEdit() {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
    setEditing(false);
  }

  async function handleSave() {
    if (!profile) return;
    if (!fullName.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa tu nombre completo.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(profile.id, { fullName: fullName.trim(), phone: phone.trim() || null });
      setEditing(false);
      Alert.alert('Guardado', 'Tu perfil se actualizó.');
    } catch (err) {
      console.error('update profile error', err);
      Alert.alert('Error', 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
    <Stack.Screen
      options={{
        headerRight: () =>
          editing ? (
            <Pressable onPress={handleCancelEdit} hitSlop={8}>
              <Text style={styles.headerActionText}>Cancelar</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setEditing(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
      }}
    />
    <ScrollView contentContainerStyle={styles.container}>
      {!editing ? (
        <InfoCard title="Información">
          <IconInfoRow icon="person-outline" label="Nombre completo" value={fullName} />
          <IconInfoRow icon="call-outline" label="Celular/WhatsApp" value={phone} />
          <IconInfoRow icon="mail-outline" label="Correo electrónico" value={profile?.email ?? ''} last />
        </InfoCard>
      ) : (
        <>
          <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
          <TextField label="Celular/WhatsApp" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={styles.emailRow}>
            <TextField label="Correo electrónico" value={profile?.email ?? ''} editable={false} />
          </View>
          <Button title="Guardar cambios" onPress={handleSave} loading={saving} style={styles.saveButton} />
        </>
      )}
      <ChangePasswordCard />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      backgroundColor: colors.background,
    },
    headerActionText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      paddingHorizontal: 4,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 14,
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    iconRowSpacing: {
      marginBottom: 14,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${colors.primary}1A`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconRowText: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    emailRow: {
      opacity: 0.6,
    },
    saveButton: {
      marginTop: 24,
    },
  });
}
