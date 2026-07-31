import { useLocalSearchParams } from 'expo-router';
import { NegocioCatalogoView } from '../../../components/NegocioCatalogoView';

export default function NegocioCatalogoBusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NegocioCatalogoView businessId={id} hrefBase="/(business)" />;
}
