import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPaymentHistory, type PaymentHistoryRow } from '../../services/payments';

const paymentTypeLabel: Record<PaymentHistoryRow['type'], string> = {
  subscription: 'Suscripción',
  advertising: 'Publicidad',
};

const paymentStatusLabel: Record<PaymentHistoryRow['status'], string> = {
  pending: 'Pendiente',
  completed: 'Pagado',
  failed: 'Rechazado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
};

const paymentStatusColor: Record<PaymentHistoryRow['status'], string> = {
  pending: colors.warning,
  completed: colors.success,
  failed: colors.danger,
  refunded: colors.textMuted,
  cancelled: colors.textMuted,
};

export default function HistorialPagosScreen() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<PaymentHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const didInitialLoadRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    setPayments(work?.business ? await getPaymentHistory(work.business.id) : []);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) {
        didInitialLoadRef.current = true;
        setLoading(true);
        load()
          .catch((err) => console.error('load historial pagos error', err))
          .finally(() => setLoading(false));
      } else {
        load().catch((err) => console.error('load historial pagos error', err));
      }
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {payments.length === 0 ? (
        <Text style={styles.helperText}>Todavía no tienes pagos registrados.</Text>
      ) : (
        <View style={styles.list}>
          {payments.map((payment) => (
            <View key={payment.id} style={styles.paymentRow}>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentType}>{paymentTypeLabel[payment.type] ?? payment.type}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(payment.created_at).toLocaleDateString('es-EC', { dateStyle: 'medium' })}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>
                {payment.currency} {payment.amount.toFixed(2)}
              </Text>
              <Text style={[styles.paymentStatus, { color: paymentStatusColor[payment.status] }]}>
                {paymentStatusLabel[payment.status] ?? payment.status}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors.background,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  list: {
    marginBottom: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  paymentDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 78,
    textAlign: 'right',
  },
});
