type CounterMap = Map<string, number>;

const counters: CounterMap = new Map();

function key(metric: string, labels?: Record<string, string | number | boolean>) {
  if (!labels || Object.keys(labels).length === 0) return metric;
  const entries = Object.entries(labels)
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort()
    .join(',');
  return `${metric}{${entries}}`;
}

export function increment(metric: string, labels?: Record<string, string | number | boolean>, by: number = 1) {
  const k = key(metric, labels);
  counters.set(k, (counters.get(k) || 0) + by);
}

export function timing(metric: string, ms: number, labels?: Record<string, string | number | boolean>) {
  increment(metric, labels, ms);
}

export function snapshotMetrics() {
  return Array.from(counters.entries()).map(([name, value]) => ({ name, value }));
}
