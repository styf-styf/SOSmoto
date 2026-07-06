import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import type { AppointmentStatus } from '../types/database';

interface CalendarAppointment {
  id: string;
  requested_at: string | null;
  status: AppointmentStatus;
}

interface Props {
  appointments: CalendarAppointment[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function dotColor(status: AppointmentStatus): string {
  if (status === 'confirmed') return colors.success;
  if (status === 'scheduled') return colors.primary;
  if (status === 'pending') return '#F59E0B';
  return 'transparent';
}

function toYMD(iso: string): string {
  return iso.slice(0, 10);
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function AppointmentCalendar({ appointments, selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  // Dots por fecha: Map<'YYYY-MM-DD', Set<color>>
  const dotsByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    appointments.forEach((a) => {
      if (!a.requested_at) return;
      const key = toYMD(a.requested_at);
      const color = dotColor(a.status);
      if (color === 'transparent') return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(color);
    });
    return map;
  }, [appointments]);

  // Construir grilla del mes
  const weeks = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0=dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // Rellenar última fila
    while (cells.length % 7 !== 0) cells.push(null);
    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  const todayYMD = toYMD(today.toISOString());

  const countForSelected = selectedDate
    ? appointments.filter((a) => a.requested_at && toYMD(a.requested_at) === selectedDate).length
    : 0;

  return (
    <View style={styles.wrapper}>
      {/* Header del mes */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </Pressable>
        <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={12}>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Etiquetas de días */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Grilla de días */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const dateStr = ymd(year, month, day);
            const isToday = dateStr === todayYMD;
            const isSelected = dateStr === selectedDate;
            const dots = dotsByDate.get(dateStr);

            return (
              <Pressable
                key={di}
                style={[
                  styles.cell,
                  isSelected && styles.cellSelected,
                  isToday && !isSelected && styles.cellToday,
                ]}
                onPress={() => onSelectDate(isSelected ? null : dateStr)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    isToday && !isSelected && styles.dayNumberToday,
                  ]}
                >
                  {day}
                </Text>
                {dots && dots.size > 0 && (
                  <View style={styles.dotsRow}>
                    {Array.from(dots).slice(0, 3).map((color, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                    ))}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Leyenda */}
      <View style={styles.legend}>
        <LegendDot color={colors.success} label="Confirmada" />
        <LegendDot color={colors.primary} label="Propuesta" />
        <LegendDot color="#F59E0B" label="Pendiente" />
      </View>

      {/* Filtro activo */}
      {selectedDate && (
        <View style={styles.filterRow}>
          <Text style={styles.filterText} numberOfLines={1}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
            {'  '}
            <Text style={styles.filterCount}>{countForSelected} cita{countForSelected !== 1 ? 's' : ''}</Text>
          </Text>
          <Pressable style={styles.clearBtn} onPress={() => onSelectDate(null)}>
            <Text style={styles.clearBtnText}>Ver todas</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dayLabels: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  week: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cellSelected: {
    backgroundColor: colors.primary,
  },
  cellToday: {
    backgroundColor: '#FFF1E6',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  dayNumberSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayNumberToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  filterText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    textTransform: 'capitalize',
  },
  filterCount: {
    color: colors.primary,
    fontWeight: '700',
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEF4FF',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
