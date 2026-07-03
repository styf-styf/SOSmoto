import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { addPortfolioPhoto, deletePortfolioPhoto, getPortfolioPhotos, type PortfolioPhoto } from '../../services/portfolio';

const GAP = 8;
const COLS = 3;
const CELL = Math.floor((Dimensions.get('window').width - 40 - GAP * (COLS - 1)) / COLS);

export default function PortafolioScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [caption, setCaption] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusinessId(work.business.id);
    setIsOwner(work.isOwner);
    const data = await getPortfolioPhotos(work.business.id);
    setPhotos(data);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch((err) => console.error('load portafolio error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handleAdd() {
    if (!businessId) return;
    setAdding(true);
    try {
      const photo = await addPortfolioPhoto(businessId, caption.trim() || undefined);
      if (photo) {
        setPhotos((prev) => [photo, ...prev]);
        setCaption('');
        setShowCaptionInput(false);
      }
    } catch (err) {
      console.error('add portfolio photo error', err);
      Alert.alert('Error', 'No se pudo subir la foto.');
    } finally {
      setAdding(false);
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto del portafolio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePortfolioPhoto(id);
            setPhotos((prev) => prev.filter((p) => p.id !== id));
          } catch (err) {
            console.error('delete portfolio photo error', err);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {isOwner && (
        <View style={styles.addSection}>
          {showCaptionInput && (
            <TextField
              label="Pie de foto (opcional)"
              value={caption}
              onChangeText={setCaption}
              style={styles.captionField}
            />
          )}
          <View style={styles.addRow}>
            <Button
              title={showCaptionInput ? 'Agregar foto' : 'Agregar foto al portafolio'}
              onPress={showCaptionInput ? handleAdd : () => setShowCaptionInput(true)}
              loading={adding}
              style={styles.addBtn}
            />
            {showCaptionInput && (
              <Button
                title="Sin pie"
                variant="secondary"
                onPress={() => { setShowCaptionInput(false); setCaption(''); handleAdd(); }}
                style={styles.skipBtn}
              />
            )}
          </View>
        </View>
      )}

      {photos.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="images-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            {isOwner
              ? 'Sube fotos de tus trabajos para que los clientes vean tu calidad.'
              : 'Este negocio aún no ha publicado fotos de trabajos.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</Text>
          <View style={styles.grid}>
            {photos.map((photo) => (
              <View key={photo.id} style={styles.cell}>
                <Image source={{ uri: photo.image_url }} style={styles.image} />
                {photo.caption && (
                  <Text style={styles.caption} numberOfLines={2}>{photo.caption}</Text>
                )}
                {isOwner && (
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(photo.id)}>
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  addSection: {
    marginBottom: 16,
  },
  captionField: {
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    flex: 1,
  },
  skipBtn: {
    flex: 0,
    paddingHorizontal: 14,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  count: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL,
  },
  image: {
    width: CELL,
    height: CELL,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  caption: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
