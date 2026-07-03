import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { getPortfolioPhotos, type PortfolioPhoto } from '../../../services/portfolio';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 2;
const CELL = Math.floor((SCREEN_WIDTH - GAP * 2) / 3);

export default function PortafolioViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PortfolioPhoto | null>(null);

  useEffect(() => {
    if (!id) return;
    getPortfolioPhotos(id)
      .then(setPhotos)
      .catch((err) => console.error('load portfolio error', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Portafolio de trabajos' }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Portafolio de trabajos' }} />

      {photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.placeholder}>Este negocio aún no tiene fotos de trabajos.</Text>
        </View>
      ) : (
        <ScrollView>
          <View style={styles.grid}>
            {photos.map((photo) => (
              <Pressable key={photo.id} style={styles.cell} onPress={() => setSelected(photo)}>
                <Image source={{ uri: photo.image_url }} style={styles.cellImage} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.count}>{photos.length} foto{photos.length !== 1 ? 's' : ''}</Text>
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayClose} onPress={() => setSelected(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {selected && (
            <>
              <Image source={{ uri: selected.image_url }} style={styles.fullImage} resizeMode="contain" />
              {selected.caption ? (
                <Text style={styles.caption}>{selected.caption}</Text>
              ) : null}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
  },
  cellImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
  },
  count: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  caption: {
    marginTop: 16,
    paddingHorizontal: 24,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
});
