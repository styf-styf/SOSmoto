import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '../constants/colors';

interface ChatHeaderProps {
  name: string;
  avatarUrl?: string | null;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  onPressName?: () => void;
}

export function ChatHeader({ name, avatarUrl, fallbackIcon = 'person', onPressName }: ChatHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Pressable style={styles.identity} onPress={onPressName} disabled={!onPressName}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name={fallbackIcon} size={18} color={colors.primary} />
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 6,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
});
