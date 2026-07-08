import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors } from '../../../constants/colors';
import { getServiceReport, type ServiceReportWithBusiness } from '../../../services/serviceReports';
import { ServiceReportView } from '../../../components/ServiceReportView';
import { shareReportAsPdf } from '../../../utils/reportPdf';
import { Button } from '../../../components/Button';

export default function InformeNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<ServiceReportWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getServiceReport(id)
        .then((r) => setReport(r))
        .catch((err) => console.error('load report error', err))
        .finally(() => setLoading(false));
    }, [id])
  );

  async function handleShare() {
    if (!report) return;
    setSharing(true);
    try {
      await shareReportAsPdf(report);
    } catch (err) {
      console.error('share report error', err);
      Alert.alert('Error', 'No se pudo compartir el informe.');
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!report) return null;

  return (
    <ServiceReportView
      report={report}
      footer={
        <Button
          title={sharing ? 'Compartiendo…' : 'Compartir PDF del informe'}
          onPress={handleShare}
          loading={sharing}
          variant="secondary"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
