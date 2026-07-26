import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { updateUserProfile } from '../../services/users';

export default function DatosPersonalesScreen() {
  const { profile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  function handleCancel() {
    if (!profile) return;
    setFullName(profile.full_name);
    setPhone(profile.phone ?? '');
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
    <ScrollView contentContainerStyle={styles.container}>
      <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <View style={styles.emailRow}>
        <TextField label="Correo electrónico" value={profile?.email ?? ''} editable={false} />
      </View>
      <View style={styles.actionsRow}>
        <Button
          title="Cancelar"
          variant="secondary"
          onPress={handleCancel}
          disabled={saving}
          style={styles.flexButton}
        />
        <Button
          title="Guardar cambios"
          onPress={handleSave}
          loading={saving}
          style={styles.flexButton}
        />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  emailRow: {
    opacity: 0.6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  flexButton: {
    flex: 1,
  },
});
