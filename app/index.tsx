import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session || !profile) {
    return <Redirect href="/(auth)/login" />;
  }

  if (profile.role === 'business') {
    return <Redirect href="/(business)" />;
  }

  return <Redirect href="/(client)" />;
}
