import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

// Título de marca del Home (cliente y negocio): el logo reemplaza las letras
// "SOS" y "moto" sigue como texto normal, para que junto se lea "SOSmoto"
// pero con el ícono de la app en vez de las 3 letras.
export function BrandTitle({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      <Image source={require('../assets/icon_header.png')} style={styles.icon} resizeMode="contain" />
      <Text style={styles.moto}>moto</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 42,
    height: 26,
    marginRight: 1,
  },
  moto: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
});
