export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function pctRaw(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function advisorName(email: string): string {
  const local = email.split('@')[0] || email;
  return local
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatNumber(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}
