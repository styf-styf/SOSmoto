import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent, NativeSyntheticEvent, StyleProp, TextLayoutEventData, TextStyle } from 'react-native';
import { colors } from '../constants/colors';

const MAX_LINES = 3;
// Recorte de más (18 caracteres) a propósito -- es una estimación por
// cantidad de caracteres, no por ancho real de cada letra, así que
// conviene dejar margen de sobra: que falte un poco de texto visible se
// nota menos que "Ver más" cortado a la mitad por el clip de 3 líneas.
const TRIM_CHARS = 18;

// Texto que se corta a MAX_LINES con "Ver más"/"Ver menos" -- mismo
// comportamiento en todos lados (Inicio, producto, servicio, detalle de
// publicación) para que sea consistente en toda la app. Extraído de
// PostCard.tsx, que fue donde se probó primero este patrón.
export function ExpandableText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  // Primeras MAX_LINES líneas reales (medidas, no una cuenta de
  // caracteres) con un pequeño recorte al final para dejarle espacio a
  // "Ver más" en la misma línea -- ver handleMeasure.
  const [preview, setPreview] = useState('');

  // Mide el texto completo sin límite de líneas, de forma invisible y
  // superpuesta -- si mide más de MAX_LINES, arma el preview con el texto
  // REAL de esas líneas (cada línea medida trae su propio texto exacto, no
  // una estimación de caracteres) y recorta un poco el final para que
  // "Ver más" quede en la misma línea.
  function handleMeasure(e: NativeSyntheticEvent<TextLayoutEventData>) {
    const lines = e.nativeEvent.lines;
    if (lines.length <= MAX_LINES) return;
    setTruncated(true);
    const firstLines = lines.slice(0, MAX_LINES).map((l) => l.text).join('');
    setPreview(firstLines.trimEnd().slice(0, -TRIM_CHARS).trimEnd());
  }

  function handleExpand(e: GestureResponderEvent) {
    e.stopPropagation();
    setExpanded(true);
  }

  function handleCollapse(e: GestureResponderEvent) {
    e.stopPropagation();
    setExpanded(false);
  }

  if (expanded) {
    return (
      <Text style={style}>
        {text}
        <Text style={[style, styles.moreLink]} onPress={handleCollapse}>
          {'  Ver menos'}
        </Text>
      </Text>
    );
  }

  return (
    <View>
      <Text style={[style, styles.measure]} numberOfLines={MAX_LINES + 1} onTextLayout={handleMeasure}>
        {text}
      </Text>
      {truncated ? (
        <Text style={style} numberOfLines={MAX_LINES} ellipsizeMode="clip">
          {preview}
          <Text style={[style, styles.moreLink]} onPress={handleExpand}>
            {'... Ver más'}
          </Text>
        </Text>
      ) : (
        <Text style={style} numberOfLines={MAX_LINES}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  // Sin fontSize/lineHeight a propósito -- hereda del `style` de cada
  // caller (14 en producto/servicio, 15 en el detalle de publicación) en
  // vez de un tamaño fijo que quedaría desproporcionado según el caller.
  moreLink: {
    fontWeight: '600',
    color: colors.textMuted,
  },
});
