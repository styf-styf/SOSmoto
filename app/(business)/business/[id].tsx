import { useLocalSearchParams } from 'expo-router';
import { BusinessProfileView } from '../../../components/BusinessProfileView';

export default function BusinessViewBusinessProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BusinessProfileView mode="public" businessId={id} />;
}
