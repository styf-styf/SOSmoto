import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { getServiceReport, type ServiceReportWithBusiness } from '../../../services/serviceReports';
import { ServiceReportView } from '../../../components/ServiceReportView';
import { shareReportAsPdf } from '../../../utils/reportPdf';

export default function InformeNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
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

  useLayoutEffect(() => {
    if (!report) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          hitSlop={10}
          style={{ marginRight: 4, opacity: sharing ? 0.4 : 1 }}
        >
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [report, sharing]);

  async function handleShare() {
    if (!report) return;
    setSharing(true);
    try {
      await shareReportAsPdf(report);
    } catch (err) {
      console.error('share report error', err);
      Alert.alert('Error', 'No se pudo generar el PDF del informe.');
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

  if (!report) {
    return null;
  }

  return <ServiceReportView report={report} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
