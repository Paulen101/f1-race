/**
 * Shared Recharts styling so every chart matches the dark UI.
 */

// Distinct on the dark background; first two are the head-to-head pair
export const DRIVER_COLORS = ['#E10600', '#22D3EE', '#FACC15', '#A855F7', '#22C55E'];

export const gridProps = {
  stroke: 'rgba(255, 255, 255, 0.06)',
  strokeDasharray: '3 3',
};

export const axisProps = {
  stroke: 'rgba(255, 255, 255, 0.15)',
  tick: { fill: '#9ca3af', fontSize: 11 },
  tickLine: false,
};

export const axisLabel = (value, axis = 'x') =>
  axis === 'x'
    ? { value, position: 'insideBottom', offset: -4, fill: '#6b7280', fontSize: 11 }
    : { value, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 };

export const tooltipProps = {
  contentStyle: {
    backgroundColor: 'rgba(16, 16, 22, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    boxShadow: '0 12px 30px -10px rgba(0, 0, 0, 0.8)',
    fontSize: 12,
  },
  labelStyle: { color: '#9ca3af', marginBottom: 4 },
  itemStyle: { padding: 0 },
  cursor: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1 },
};

export const legendProps = {
  iconType: 'plainline',
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
};
