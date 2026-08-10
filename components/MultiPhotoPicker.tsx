import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// Fila horizontal de fotos ya elegidas (con botón para quitar cada una) +
// una tarjeta "Agregar" al final que desaparece al llegar al tope -- mismo
// patrón usado en publicaciones (composer del home y "Publicaciones") y en
// ProductForm/ServiceForm de catalogo.tsx. thumbSize/gap/borderRadius y
// addLabel son opcionales porque catalogo.tsx usa miniaturas más grandes
// (90px) con el texto "Agregar" bajo el ícono -- valores por defecto
// preservan el tamaño más compacto que ya usaba publicidad.tsx.
export function MultiPhotoPicker({
  photos,
  onRemove,
  onAdd,
  max,
  uploading,
  thumbSize = 70,
  gap = 8,
  borderRadius = 8,
  addLabel,
}: {
  photos: string[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  max: number;
  uploading: boolean;
  thumbSize?: number;
  gap?: number;
  borderRadius?: number;
  addLabel?: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const atLimit = photos.length >= max;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { gap }]}>
      {photos.map((url, index) => (
        <View key={`${url}-${index}`} style={styles.thumbWrap}>
          <Image
            source={{ uri: url }}
            style={[styles.thumb, { width: thumbSize, borderRadius }]}
            resizeMode="cover"
          />
          <Pressable style={styles.removeBtn} onPress={() => onRemove(index)}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      {!atLimit && (
        <Pressable
          style={[styles.addTile, { width: thumbSize, borderRadius, gap: addLabel ? 4 : 0 }]}
          onPress={onAdd}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="add" size={22} color={colors.primary} />
              {addLabel && <Text style={styles.addTileText}>{addLabel}</Text>}
            </>
          )}
        </Pressable>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    row: {
      paddingTop: 8,
    },
    thumbWrap: {
      position: 'relative',
    },
    thumb: {
      aspectRatio: 3 / 4,
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
      aspectRatio: 3 / 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTileText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
