import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { Business } from '../types/database';

export function BusinessListItem({
  business,
  distanceKm,
}: {
  business: Business;
  distanceKm?: number | null;
}) {
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/(client)/business/${business.id}`)}>
      <View style={styles.icon}>
        <Ionicons name="storefront" size={20} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{business.name}</Text>
          {business.is_verified && <Ionicons name="checkmark-circle" size={14} color={colors.primary} />}
        </View>
        <Text style={styles.meta}>
          {business.city}
          {typeof distanceKm === 'number' ? ` · ${distanceKm.toFixed(1)} km` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
});
