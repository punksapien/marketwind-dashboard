export interface TradeCall {
  id: string;
  created_date: string;
  entry_time: string;
  validity_date: string;
  email: string;
  market: string;
  seller_pick_id: string;
  entry_from: number;
  entry_to: number;
  leverage: number;
  take_profit: number;
  stop_loss: number;
  status: string;
  moderated_status: string;
  terminal_reason: string;
  cancel_reason: string;
  call_duration_validity: number;
  call_duration_terminal: number;
  roi: number;
  // Computed or from validated CSV
  side: 'long' | 'short';
  real_result: string;
  // Internal unique ID (row index — handles duplicate CSV ids like "N.A")
  _uid: string;
  // Derived
  token: string;
  entry_mid: number;
  rr_ratio: number;
  is_system_hit: boolean;
  is_real_hit: boolean;
  sl_pct: number;
  category: string;
}

export interface OverviewStats {
  totalCalls: number;
  approvedCalls: number;
  rejectedCalls: number;
  activeCalls: number;
  terminatedCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  approvedSystemHitRate: number;
  approvedRealHitRate: number;
  terminalBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}

export interface AdvisorStats {
  email: string;
  displayName: string;
  totalCalls: number;
  approvedCalls: number;
  terminatedCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  avgRR: number;
  avgROI: number;
  score: number;
  tier: 'A' | 'B' | 'C';
}

export interface TokenStats {
  token: string;
  category: string;
  totalCalls: number;
  approvedCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  avgROI: number;
}

export interface DailyStats {
  date: string;
  totalCalls: number;
  approvedCalls: number;
  systemHitRate: number;
  realHitRate: number;
  approvedSystemHitRate: number;
  approvedRealHitRate: number;
}

export interface WeeklyStats {
  weekStart: string;
  totalCalls: number;
  approvedCalls: number;
  systemHitRate: number;
  realHitRate: number;
  approvedSystemHitRate: number;
  approvedRealHitRate: number;
}

export interface RRBucket {
  label: string;
  totalCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  avgROI: number;
}

export interface HeatmapData {
  advisors: string[];
  dates: string[];
  grid: (number | null)[][];
}
