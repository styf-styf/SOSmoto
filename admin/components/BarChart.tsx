import type { ChartPoint } from '../lib/metrics';

export interface ChartSeriesDef {
  key: string;
  label: string;
  color: string;
}

const HEIGHT = 170;
const BUCKET_WIDTH = 56;
const BAR_GAP = 3;
const AXIS_PAD_BOTTOM = 22;
const TOP_PAD = 18;

// Gráfica de barras en SVG puro (sin librerías) -- se renderiza en el
// servidor, sin necesidad de "use client". El tooltip nativo (<title>) da
// el valor exacto al pasar el mouse, sin JS. Sigue el skill de dataviz:
// leyenda siempre visible con 2+ series (nunca solo color para identidad),
// etiquetas de valor directas sobre cada barra.
export function BarChart({
  data,
  series,
  valueFormatter = (n: number) => String(n),
}: {
  data: ChartPoint[];
  series: ChartSeriesDef[];
  valueFormatter?: (n: number) => string;
}) {
  if (data.length === 0 || data.every((d) => series.every((s) => (d.values[s.key] ?? 0) === 0))) {
    return <p className="py-6 text-center text-sm text-gray-400">Sin datos para este período.</p>;
  }

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const innerHeight = HEIGHT - TOP_PAD - AXIS_PAD_BOTTOM;
  const width = data.length * BUCKET_WIDTH;
  const barWidth = (BUCKET_WIDTH - BAR_GAP * (series.length + 1)) / series.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} preserveAspectRatio="none" style={{ width: '100%', height: HEIGHT }}>
        <line x1={0} y1={HEIGHT - AXIS_PAD_BOTTOM} x2={width} y2={HEIGHT - AXIS_PAD_BOTTOM} stroke="#E5E5EA" strokeWidth={1} />
        {data.map((d, i) => {
          const slotX = i * BUCKET_WIDTH;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const value = d.values[s.key] ?? 0;
                const barH = (value / max) * innerHeight;
                const x = slotX + BAR_GAP + si * (barWidth + BAR_GAP);
                const y = HEIGHT - AXIS_PAD_BOTTOM - barH;
                return (
                  <g key={s.key}>
                    <rect x={x} y={Math.max(y, TOP_PAD)} width={Math.max(barWidth, 1)} height={Math.max(barH, 0)} rx={2} fill={s.color}>
                      <title>{`${s.label} · ${d.label}: ${valueFormatter(value)}`}</title>
                    </rect>
                    {value > 0 && (
                      <text x={x + barWidth / 2} y={Math.max(y, TOP_PAD) - 3} fontSize={8} textAnchor="middle" fill="#6B6B7B">
                        {valueFormatter(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={slotX + BUCKET_WIDTH / 2} y={HEIGHT - 8} fontSize={9} textAnchor="middle" fill="#6B6B7B">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
