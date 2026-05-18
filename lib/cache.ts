const CACHE_KEY = 'mw_dashboard_cache';
const MAX_SIZE = 4 * 1024 * 1024; // 4MB

interface CacheEntry {
  hash: string;
  timestamp: number;
  fileName: string;
}

function hashCSV(csv: string): string {
  // Simple hash from content length + first/last 500 chars
  const prefix = csv.slice(0, 500);
  const suffix = csv.slice(-500);
  let hash = 0;
  const combined = `${csv.length}:${prefix}:${suffix}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(36);
}

export function getCachedHash(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export function setCachedData(csv: string, fileName: string, data: unknown): void {
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_SIZE) return;
    const entry: CacheEntry = {
      hash: hashCSV(csv),
      timestamp: Date.now(),
      fileName,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    localStorage.setItem(`${CACHE_KEY}_data`, serialized);
  } catch {
    // Storage full, silently skip
  }
}

export function getCachedData(csv: string): unknown | null {
  try {
    const entry = getCachedHash();
    if (!entry) return null;
    if (entry.hash !== hashCSV(csv)) return null;
    const raw = localStorage.getItem(`${CACHE_KEY}_data`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(`${CACHE_KEY}_data`);
}
