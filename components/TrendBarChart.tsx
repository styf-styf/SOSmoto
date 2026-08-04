import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';

// Grafica de barras agrupadas hecha con Views planos -- no hay libreria de
// graficas instalada en el proyecto, y para pocas barras/series esto
// alcanza sin agregar una dependencia nueva. Sigue el skill de dataviz
// adaptado a RN (sin hover): los colores se validan con el script del
// skill antes de usarse -- si el resultado queda en el rango "6-8" (legal
// solo con encoding secundario), SIEMPRE hay leyenda de texto + valor
// tocable por barra, nunca solo el color como identificador.
export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartPoint {
  label: string;
  values: Record<string, number>;
}

const CHART_HEIGHT = 120;
const BAR_GAP = 3;

export function TrendBarChart({ data, series }: { data: ChartPoint[]; series: ChartSeries[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(...series.map((s) => d.values[s.key] ?? 0))));

  return (
    <View>
      {series.length > 1 && (
        <View style={styles.legendRow}>
          {series.map((s) => (
            <LegendDot key={s.key} color={s.color} label={s.label} />
          ))}
        </View>
      )}
      <View style={styles.chart}>
        {data.map((point, i) => {
          const isSelected = selected === i;
          return (
            <Pressable key={i} style={styles.column} onPress={() => setSelected(isSelected ? null : i)}>
              {isSelected && (
                <Text style={styles.valueLabel}>
                  {series.map((s) => point.values[s.key] ?? 0).join(' · ')}
                </Text>
              )}
              <View style={styles.barsRow}>
                {series.map((s) => (
                  <View
                    key={s.key}
                    style={[
                      styles.bar,
                      { height: Math.max(2, ((point.values[s.key] ?? 0) / max) * CHART_HEIGHT), backgroundColor: s.color },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.axisLabel}>{point.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Toca una columna para ver los valores exactos.</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 36,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  valueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: {
    width: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
  hint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
