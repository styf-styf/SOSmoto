import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function EstadoCuentaScreen() {
  const { profile } = useAuth();
  const isLimited = profile?.is_limited ?? false;

  return (
    <View style={styles.container}>
      <View style={[styles.badge, isLimited ? styles.badgeLimited : styles.badgeActive]}>
        <Ionicons
          name={isLimited ? 'alert-circle' : 'checkmark-circle'}
          size={20}
          color={isLimited ? colors.danger : colors.success}
        />
        <Text style={[styles.badgeText, { color: isLimited ? colors.danger : colors.success }]}>
          {isLimited ? 'Limitado' : 'Activo'}
        </Text>
      </View>

      {isLimited ? (
        <>
          <Text style={styles.reasonLabel}>Motivo</Text>
          <Text style={styles.reasonText}>{profile?.limitation_reason || 'No se especificó un motivo.'}</Text>

          <Text style={styles.sectionTitle}>Mientras tu cuenta esté limitada no puedes:</Text>
          <View style={styles.list}>
            <ListItem text="Crear publicaciones" />
            <ListItem text="Subir historias" />
            <ListItem text="Buscar talleres" />
          </View>
          <Text style={styles.helperText}>
            El resto de la app sigue funcionando con normalidad, incluido el botón SOS para pedir auxilio en
            carretera.
          </Text>
        </>
      ) : (
        <Text style={styles.helperText}>Tu cuenta está activa, sin restricciones.</Text>
      )}
    </View>
  );
}

function ListItem({ text }: { text: string }) {
  return (
    <View style={styles.listItem}>
      <Ionicons name="close-circle" size={16} color={colors.danger} />
      <Text style={styles.listItemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
  },
  badgeActive: {
    backgroundColor: '#E6F4EA',
  },
  badgeLimited: {
    backgroundColor: '#FBE8E8',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  list: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  listItemText: {
    fontSize: 14,
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
