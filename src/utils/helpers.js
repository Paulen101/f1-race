/**
 * Format lap time from seconds to MM:SS.mmm
 */
export const formatLapTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '--:--.---';
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
};

/**
 * Format delta time with + or - prefix
 */
export const formatDelta = (seconds) => {
  if (!seconds || isNaN(seconds)) return '---';
  
  const sign = seconds >= 0 ? '+' : '-';
  const abs = Math.abs(seconds);
  
  return `${sign}${abs.toFixed(3)}`;
};

/**
 * Get color for tire compound
 */
export const getTireColor = (compound) => {
  const colors = {
    'SOFT': '#E10600',
    'MEDIUM': '#FFF200',
    'HARD': '#FFFFFF',
    'INTERMEDIATE': '#00A000',
    'WET': '#0000FF',
  };
  
  return colors[compound?.toUpperCase()] || '#999999';
};

/**
 * Get position ordinal (1st, 2nd, 3rd, etc.)
 */
export const getOrdinal = (position) => {
  if (!position) return '';
  
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = position % 100;
  
  return position + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

/**
 * Calculate percentage difference
 */
export const calculatePercentDiff = (value1, value2) => {
  if (!value2 || value2 === 0) return 0;
  return ((value1 - value2) / value2) * 100;
};

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Group data by key
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};
