import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { createReview, getServiceHistory, type ServiceHistoryItem } from '../../services/reviews';
import { getClientReportIdsByAppointments } from '../../services/serviceReports';

type FilterKey = 'all' | 'appointment' | 'help_request' | 'report' | 'product_purchase';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'appointment', label: 'Citas' },
  { key: 'help_request', label: 'Auxilios' },
  { key: 'report', label: 'Informes' },
  { key: 'product_purchase', label: 'Compras' },
];

const statusLabel: Record<string, string> = {
  completed: 'Completado',
  cancelled: 'Cancelado',
  received: 'Recibido',
  confirmed: 'Confirmado',
};

const kindLabel: Record<ServiceHistoryItem['kind'], string> = {
  help_request: 'Auxilio',
  appointment: 'Cita',
  maintenance: 'Mantenimiento',
  report: 'Informe',
  product_purchase: 'Compra',
};

function matchesFilter(
  item: ServiceHistoryItem,
  filter: FilterKey,
  reportIds: Map<string, string>
): boolean {
  if (filter === 'all') return true;
  if (filter === 'report') {
    return (
      item.kind === 'report' ||
      (item.kind === 'appointment' && !!item.appointmentId && reportIds.has(item.appointmentId))
    );
  }
  return item.kind === filter;
}

interface HistorialData {
  items: ServiceHistoryItem[];
  reportIds: Map<string, string>;
}

export default function HistorialScreen() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `historial-${profile.id}` : null;
  const { data, loading, reload } = useCachedLoad<HistorialData>(cacheKey, async () => {
    if (!profile) return { items: [], reportIds: new Map() };
    const [history, reportMap] = await Promise.all([
      getServiceHistory(profile.id),
      getClientReportIdsByAppointments(profile.id),
    ]);
    return { items: history, reportIds: reportMap };
  });
  const items = data?.items ?? [];
  const reportIds = data?.reportIds ?? new Map<string, string>();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load historial error', err);
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = items.filter((item) => matchesFilter(item, filter, reportIds));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      {/* Filtros */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.placeholder}>
          {filter === 'all'
            ? 'Aún no tienes servicios en tu historial.'
            : `No tienes ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} en tu historial.`}
        </Text>
      ) : (
        filtered.map((item) => {
          const reportId =
            item.kind === 'report'
              ? item.id
              : item.appointmentId
              ? reportIds.get(item.appointmentId)
              : undefined;
          return (
            <HistoryCard
              key={`${item.kind}_${item.id}`}
              item={item}
              reportId={reportId}
              onReviewed={reload}
            />
          );
        })
      )}
    </ScrollView>
  );
}

function HistoryCard({
  item,
  reportId,
  onReviewed,
}: {
  item: ServiceHistoryItem;
  reportId?: string;
  onReviewed: () => void;
}) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!profile || !item.business) return;
    setSaving(true);
    try {
      await createReview({
        reviewerId: profile.id,
        businessId: item.business.id,
        helpRequestId: item.helpRequestId,
        appointmentId: item.appointmentId,
        productIntentId: item.productIntentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setShowForm(false);
      onReviewed();
    } catch (err) {
      console.error('create review error', err);
      Alert.alert('Error', 'No se pudo enviar la calificación.');
    } finally {
      setSaving(false);
    }
  }

  const isReport = item.kind === 'report';

  const cardContent = (
    <>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>
        {kindLabel[item.kind]} · {statusLabel[item.status] ?? item.status} ·{' '}
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      {item.description && <Text style={styles.cardMeta}>{item.description}</Text>}

      {reportId && (
        <View style={styles.reportBtn}>
          <Ionicons name="document-text-outline" size={15} color={colors.primary} />
          <Text style={styles.reportBtnText}>Ver informe de servicio</Text>
        </View>
      )}

      {!isReport && item.status === 'cancelled' && item.business && !item.review && (
        <Text style={styles.cardMeta}>
          El taller fue asignado pero la solicitud se canceló. Si no se presentó, puedes calificarlo.
        </Text>
      )}

      {!isReport &&
        (item.status === 'completed' || item.status === 'cancelled') &&
        item.business &&
        (item.review ? (
          <View style={styles.reviewDone}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.reviewDoneText}>Calificaste con {item.review.rating} estrellas</Text>
          </View>
        ) : showForm ? (
          <View style={styles.reviewForm}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)}>
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={24}
                    color={colors.warning}
                  />
                </Pressable>
              ))}
            </View>
            <TextField label="Comentario (opcional)" value={comment} onChangeText={setComment} />
            <View style={styles.actionsRow}>
              <Button title="Enviar" onPress={handleSubmit} loading={saving} style={styles.flexButton} />
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setShowForm(false)}
                style={styles.flexButton}
              />
            </View>
          </View>
        ) : (
          <Button title="Calificar" variant="secondary" onPress={() => setShowForm(true)} style={styles.reviewButton} />
        ))}
    </>
  );

  if (reportId) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/(client)/informe/${reportId}`)}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      {cardContent}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 12,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reviewDoneText: {
    fontSize: 13,
    color: colors.text,
  },
  reviewForm: {
    marginTop: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  reviewButton: {
    marginTop: 12,
  },
  cardPressed: {
    opacity: 0.75,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reportBtnText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
});
