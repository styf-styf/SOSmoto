import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

// Fila horizontal de fotos ya elegidas (con botón para quitar cada una) +
// una tarjeta "Agregar" al final que desaparece al llegar al tope -- mismo
// patrón que ProductForm/ServiceForm en catalogo.tsx, reutilizado acá para
// publicaciones (composer del home y de la pantalla "Publicaciones").
export function MultiPhotoPicker({
  photos,
  onRemove,
  onAdd,
  max,
  uploading,
}: {
  photos: string[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  max: number;
  uploading: boolean;
}) {
  const atLimit = photos.length >= max;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {photos.map((url, index) => (
        <View key={`${url}-${index}`} style={styles.thumbWrap}>
          <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
          <Pressable style={styles.removeBtn} onPress={() => onRemove(index)}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      {!atLimit && (
        <Pressable style={styles.addTile} onPress={onAdd} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="add" size={22} color={colors.primary} />
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 70,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  addTile: {
    width: 70,
    aspectRatio: 3 / 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
