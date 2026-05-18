export const BLUECHIPS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK'];

export const MEMES = [
  'DOGE', 'SHIB', 'PEPE', 'WIF', 'FLOKI', 'BONK', 'BOME', 'MEME',
  '1000PEPE', '1000FLOKI', '1000SHIB', '1000BONK', 'TURTLE', 'SOMI',
  'BAN', 'WLFI',
];

export const COMMODITIES = ['CL', 'NATGAS', 'BZ', 'XAU', 'XAG', 'PAXG', 'XAUT'];

export function categorizeToken(token: string): string {
  const t = token.toUpperCase();
  if (BLUECHIPS.includes(t)) return 'Bluechip';
  if (MEMES.includes(t)) return 'Meme';
  if (COMMODITIES.includes(t)) return 'Commodity';
  return 'Altcoin';
}

export const RR_BUCKETS = [
  { min: 0, max: 1.0, label: '< 1.0' },
  { min: 1.0, max: 1.3, label: '1.0 - 1.3' },
  { min: 1.3, max: 1.5, label: '1.3 - 1.5' },
  { min: 1.5, max: 2.0, label: '1.5 - 2.0' },
  { min: 2.0, max: Infinity, label: '> 2.0' },
];

export const CHART_COLORS = {
  green: '#00E676',
  red: '#FF1744',
  blue: '#2979FF',
  orange: '#FF9100',
  purple: '#AA00FF',
  cyan: '#00E5FF',
  yellow: '#FFD600',
  pink: '#FF4081',
};

export const CATEGORY_COLORS: Record<string, string> = {
  Bluechip: '#2979FF',
  Meme: '#FF4081',
  Altcoin: '#AA00FF',
  Commodity: '#FFD600',
};
