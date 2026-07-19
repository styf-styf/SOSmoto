import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors } from '../constants/colors';
import { getActiveProducts, getActiveServices, getPlanLimits } from '../services/catalog';
import { createStory, getBusinessStories, isStoryVisible } from '../services/stories';
import { pickAndUploadBusinessStoryImage } from '../services/storage';
import type { Product, Service, Story, StoryActionType } from '../types/database';

const templates = ['Promo del día', 'Antes/Después', 'Nuevo producto', 'Cupo disponible hoy'];

const actionOptions: { label: string; value: StoryActionType }[] = [
  { label: 'Ninguno', value: 'none' },
  { label: 'Ver servicio', value: 'service' },
  { label: 'Ver producto', value: 'product' },
  { label: 'Contactar', value: 'contact' },
];

// Popup de creación de historia -- reemplaza a la antigua pantalla
// app/(business)/historias.tsx (eliminada). Se abre desde el botón "Añadir"
// del carrusel de Historias en el home del negocio; el límite del plan se
// revisa apenas se abre el popup (antes se revisaba antes de mostrar el
// formulario, mismo efecto).
export function CreateBusinessStoryModal({
  visible,
  businessId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  businessId: string;
  onClose: () => void;
  onCreated: (story: Story) => void;
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [actionType, setActionType] = useState<StoryActionType>('none');
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [maxActiveStories, setMaxActiveStories] = useState<number | null>(0);
  const [planName, setPlanName] = useState('free');

  useEffect(() => {
    if (!visible) return;
    Promise.all([getPlanLimits(businessId), getBusinessStories(businessId)])
      .then(([plan, stories]) => {
        const count = stories.filter(isStoryVisible).length;
        setActiveCount(count);
        setMaxActiveStories(plan.maxActiveStories);
        setPlanName(plan.planName);
        if (plan.maxActiveStories !== null && count >= plan.maxActiveStories) {
          Alert.alert(
            'Límite de plan alcanzado',
            `Tu plan ${plan.planName} permite hasta ${plan.maxActiveStories} historia(s) activa(s). Sube de plan para subir más.`
          );
          onClose();
        }
      })
      .catch((err) => console.error('load business story limits error', err));
  }, [visible, businessId, onClose]);

  useEffect(() => {
    if (actionType === 'service' && services.length === 0) {
      getActiveServices(businessId).then(setServices).catch((err) => console.error('load services error', err));
    }
    if (actionType === 'product' && products.length === 0) {
      getActiveProducts(businessId).then(setProducts).catch((err) => console.error('load products error', err));
    }
  }, [actionType, businessId, services.length, products.length]);

  function handleClose() {
    setImageUrl('');
    setCaption('');
    setActionType('none');
    setTargetId(null);
    onClose();
  }

  async function handlePickImage() {
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessStoryImage(businessId);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload story image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreate() {
    if (!imageUrl.trim()) {
      Alert.alert('Falta la imagen', 'Selecciona una foto para la historia.');
      return;
    }
    if ((actionType === 'service' || actionType === 'product') && !targetId) {
      Alert.alert('Falta elegir', actionType === 'service' ? 'Elige un servicio.' : 'Elige un producto.');
      return;
    }
    setSaving(true);
    try {
      const created = await createStory({
        businessId,
        imageUrl: imageUrl.trim(),
        caption: caption.trim() || undefined,
        actionType,
        actionTargetId: actionType === 'service' || actionType === 'product' ? targetId ?? undefined : undefined,
        isPinned: false,
      });
      onCreated(created);
      handleClose();
    } catch (err) {
      console.error('create story error', err);
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
            Foto visible 24h para tus clientes.{' '}
            {maxActiveStories === null
              ? 'Tu plan permite historias ilimitadas.'
              : `${activeCount}/${maxActiveStories} historias activas según tu plan ${planName}.`}
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
          <TextField label="Texto" placeholder="20% de descuento hoy" value={caption} onChangeText={setCaption} />

          <Text style={styles.fieldLabel}>Botón de acción</Text>
          <View style={styles.chipRow}>
            {actionOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setActionType(opt.value);
                  setTargetId(null);
                }}
                style={[styles.chip, actionType === opt.value && styles.chipSelected]}
              >
                <Text style={[styles.chipText, actionType === opt.value && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          {actionType === 'service' && (
            <View style={styles.chipRow}>
              {services.length === 0 ? (
                <Text style={styles.placeholder}>No tienes servicios activos.</Text>
              ) : (
                services.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setTargetId(s.id)}
                    style={[styles.chip, targetId === s.id && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, targetId === s.id && styles.chipTextSelected]}>{s.name}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {actionType === 'product' && (
            <View style={styles.chipRow}>
              {products.length === 0 ? (
                <Text style={styles.placeholder}>No tienes productos activos.</Text>
              ) : (
                products.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setTargetId(p.id)}
                    style={[styles.chip, targetId === p.id && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, targetId === p.id && styles.chipTextSelected]}>{p.name}</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

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
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
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
