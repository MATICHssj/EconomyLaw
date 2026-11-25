/**
 * Colores de gráficas: fijos (no dependen del acento elegido) y validados para
 * daltonismo en modo claro y oscuro con el validador de paletas.
 */
export const CHART = {
  income: '#059669',
  spending: '#6366f1',
  single: '#6366f1',
  /** Escala secuencial (un solo tono, de claro a oscuro) para mapas de calor. */
  sequential: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'],
  grid: 'var(--line)',
  axis: 'var(--muted)',
};

export const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 12,
    color: 'var(--ink)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--muted)', fontWeight: 600 },
  itemStyle: { color: 'var(--ink)' },
  cursor: { fill: 'var(--surface-2)' },
};
