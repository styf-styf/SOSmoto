import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/colors';

// Header compacto (44px de barra + safe area) que reemplaza el nativo de
// NativeStack, cuya altura no es configurable directamente desde JS.
export function AppHeader({ navigation, options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {back ? (
          <Pressable onPress={navigation.goBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {options.title ?? ''}
        </Text>
        <View style={styles.side}>
          {options.headerRight?.({ canGoBack: !!back })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  backButton: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  side: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
});
