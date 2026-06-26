import { useEffect } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../constants/colors';
import { registerAdClick, registerAdImpression } from '../services/ads';
import type { Ad } from '../types/database';

export function AdBanner({ ad }: { ad: Ad }) {
  useEffect(() => {
    registerAdImpression(ad.id).catch((err) => console.error('register ad impression error', err));
  }, [ad.id]);

  function handlePress() {
    registerAdClick(ad.id).catch((err) => console.error('register ad click error', err));
    if (ad.link_url) {
      Linking.openURL(ad.link_url).catch(() => {
        Alert.alert('No se pudo abrir el link', 'El link de este anuncio no es válido.');
      });
    }
  }

  return (
    <Pressable style={styles.banner} onPress={handlePress} disabled={!ad.link_url}>
      <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
      <Text style={styles.title} numberOfLines={1}>
        {ad.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 140,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    padding: 10,
  },
});
