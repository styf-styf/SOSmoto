import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { createStory, getClientActiveStoryCount } from '../services/stories';
import { pickAndUploadClientStoryImage } from '../services/storage';
import type { Story } from '../types/database';

const CLIENT_DAILY_LIMIT = 3;
const templates = ['Mi moto', 'En ruta', 'Antes/Después', 'Recomiendo este taller'];

// Popup de creación de historia -- reemplaza a la antigua pantalla
// app/(client)/historias.tsx (eliminada). Se abre desde el botón "Añadir" del
// carrusel de Historias en el home; el límite diario se revisa apenas se abre
// el popup (antes se revisaba antes de mostrar el formulario, mismo efecto).
export function CreateClientStoryModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (story: Story) => void;
}) {
  const { profile } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (!visible || !profile) return;
    getClientActiveStoryCount(profile.id)
      .then((count) => {
        setActiveCount(count);
        if (count >= CLIENT_DAILY_LIMIT) {
          Alert.alert('Límite diario alcanzado', `Puedes subir hasta ${CLIENT_DAILY_LIMIT} historias por día.`);
          onClose();
        }
      })
      .catch((err) => console.error('load active story count error', err));
  }, [visible, profile, onClose]);

  function handleClose() {
    setImageUrl('');
    setCaption('');
    onClose();
  }

  async function handlePickImage() {
    if (!profile) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadClientStoryImage(profile.id);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload client story image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreate() {
    if (!profile) return;
    if (!imageUrl.trim()) {
      Alert.alert('Falta la imagen', 'Selecciona una foto para la historia.');
      return;
    }
    setSaving(true);
    try {
      const created = await createStory({
        clientId: profile.id,
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        actionType: 'none',
      });
      onCreated(created);
      handleClose();
    } catch (err) {
      console.error('create client story error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo crear la historia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Nueva historia</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            Foto visible 24h para toda la comunidad. {activeCount}/{CLIENT_DAILY_LIMIT} historias activas hoy.
          </Text>

          <Text style={styles.fieldLabel}>Imagen</Text>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" /> : null}
          <Button
            title={imageUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
            variant="secondary"
            onPress={handlePickImage}
            loading={uploadingImage}
            style={styles.imageButton}
          />

          <Text style={styles.fieldLabel}>Plantilla (opcional)</Text>
          <View style={styles.chipRow}>
            {templates.map((t) => (
              <Pressable key={t} onPress={() => setCaption(t)} style={[styles.chip, caption === t && styles.chipSelected]}>
                <Text style={[styles.chipText, caption === t && styles.chipTextSelected]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <TextField label="Texto" placeholder="Listo para rodar" value={caption} onChangeText={setCaption} />

          <View style={styles.actions}>
            <Button title="Publicar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={handleClose} style={styles.flexButton} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 56,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.primary,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  imageButton: {
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
});
