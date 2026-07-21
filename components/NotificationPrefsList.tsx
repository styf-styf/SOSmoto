import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import type { NotificationCategory, NotificationPrefs } from '../types/database';

export interface NotificationCategoryOption {
  key: NotificationCategory;
  label: string;
  hint: string;
}

// Ausencia de clave en prefs = activada (ver services/notifications.ts).
export function NotificationPrefsList({
  options,
  prefs,
  onToggle,
  disabled,
}: {
  options: NotificationCategoryOption[];
  prefs: NotificationPrefs;
  onToggle: (key: NotificationCategory, value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      {options.map((opt, i) => {
        const enabled = prefs[opt.key] !== false;
        return (
          <View key={opt.key} style={[styles.row, i < options.length - 1 && styles.rowBorder]}>
            <View style={styles.info}>
              <Text style={styles.label}>{opt.label}</Text>
              <Text style={styles.hint}>{opt.hint}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={(value) => onToggle(opt.key, value)}
              disabled={disabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
