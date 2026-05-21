import { TradeCall } from './types';
import { safeDiv } from './utils';

// ============================================
// Expert Picks Confidence Score Framework V1
//
// Three inputs, weighted:
//   1. MarketWind Internal Confidence (40%)
//   2. Advisor 14-Day Rolling Hit Rate (35%)
//   3. Token-Level Historical Performance (25%)
//
// Weighted score range: 1.0 – 3.0
//   ≥2.5  → Top Pick (High Conviction)
//   1.8–2.49 → Standard Pick
//   <1.8  → Aggressive Pick (Moderate)
//
// Walk-forward: each call scored using ONLY prior data.
// ============================================

export interface ConfidenceInputs {
  mwConfidence: 'High' | 'Medium' | 'Low';
  mwScore: number;                // 1-3
  advisor14dHR: number;           // Percentage
  advisor14dCallCount: number;    // How many calls in 14d window
  advisorHRScore: number;         // 1-3
  tokenHR: number;                // Percentage
  tokenCallCount: number;         // Historical calls by this advisor on this token
  tokenHRScore: number;           // 1-3
}

export interface ScoredCall extends TradeCall {
  weightedScore: number;          // 1.0 - 3.0
  classification: 'Top Pick' | 'Standard Pick' | 'Aggressive Pick';
  userLabel: 'High Conviction' | 'Standard' | 'Moderate';
  inputs: ConfidenceInputs;
}

export interface TierStats {
  tier: string;
  userLabel: string;
  totalCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  avgROI: number;
  avgResolutionMin: number | null;
}

export interface ConfidenceBacktest {
  scoredCalls: ScoredCall[];
  tierStats: TierStats[];
  inputBreakdown: {
    label: string;
    separation: number; // HR spread between score=3 and score=1 groups
  }[];
  overallStats: {
    topPickHR: number;
    standardHR: number;
    aggressiveHR: number;
    separation: number; // Top Pick HR - Aggressive HR
    totalScored: number;
  };
}

// ============================================
// MW Confidence: from CSV column or default
// ============================================

const MW_CONFIDENCE_COLUMN = 'mw_confidence'; // Column name to look for in CSV

function getMWConfidence(call: TradeCall): { level: 'High' | 'Medium' | 'Low'; score: number } {
  // Check if the call has mw_confidence data (from CSV)
  const raw = ((call as unknown as Record<string, unknown>)[MW_CONFIDENCE_COLUMN] as string || '').toUpperCase().trim();
  if (raw === 'HIGH' || raw === 'H' || raw === '3') return { level: 'High', score: 3 };
  if (raw === 'LOW' || raw === 'L' || raw === '1') return { level: 'Low', score: 1 };
  // Default to Medium when column is missing or value is Medium
  return { level: 'Medium', score: 2 };
}

// ============================================
// Advisor 14-Day Rolling HR
// ============================================

function getAdvisor14dHR(
  call: TradeCall,
  priorTerminated: TradeCall[]
): { hr: number; callCount: number; score: number } {
  const callDate = new Date(call.created_date);
  const fourteenDaysAgo = new Date(callDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const window = priorTerminated.filter((c) => {
    if (c.email !== call.email) return false;
    const d = new Date(c.created_date);
    return d >= fourteenDaysAgo && d < callDate;
  });

  const callCount = window.length;
  if (callCount === 0) return { hr: 0, callCount: 0, score: 2 }; // Default neutral

  const hits = window.filter((c) => c.is_system_hit).length;
  const hr = (hits / callCount) * 100;

  let score = 1;
  if (hr >= 65) score = 3;
  else if (hr >= 55) score = 2;

  return { hr, callCount, score };
}

// ============================================
// Token-Level Historical HR (by advisor)
// ============================================

function getTokenHR(
  call: TradeCall,
  priorTerminated: TradeCall[]
): { hr: number; callCount: number; score: number } {
  const tokenCalls = priorTerminated.filter(
    (c) => c.email === call.email && c.token === call.token
  );

  const callCount = tokenCalls.length;

  // Min 10 calls required, otherwise default neutral
  if (callCount < 10) return { hr: 0, callCount, score: 2 };

  const hits = tokenCalls.filter((c) => c.is_system_hit).length;
  const hr = (hits / callCount) * 100;

  let score = 1;
  if (hr >= 65) score = 3;
  else if (hr >= 55) score = 2;

  return { hr, callCount, score };
}

// ============================================
// Weighted Score & Classification
// ============================================

const WEIGHTS = { mw: 0.4, advisorHR: 0.35, tokenHR: 0.25 };

function computeWeightedScore(mw: number, advisor: number, token: number): number {
  return WEIGHTS.mw * mw + WEIGHTS.advisorHR * advisor + WEIGHTS.tokenHR * token;
}

function classify(score: number): { classification: ScoredCall['classification']; userLabel: ScoredCall['userLabel'] } {
  if (score >= 2.5) return { classification: 'Top Pick', userLabel: 'High Conviction' };
  if (score >= 1.8) return { classification: 'Standard Pick', userLabel: 'Standard' };
  return { classification: 'Aggressive Pick', userLabel: 'Moderate' };
}

// ============================================
// Walk-forward scoring
// ============================================

function scoreAllCalls(calls: TradeCall[]): ScoredCall[] {
  const sorted = [...calls].sort((a, b) =>
    a.created_date.localeCompare(b.created_date) ||
    a.entry_time.localeCompare(b.entry_time)
  );

  const scoredCalls: ScoredCall[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const call = sorted[i];
    const priorCalls = sorted.slice(0, i);
    const priorTerminated = priorCalls.filter(
      (c) =>
        c.status === 'APPROVED' &&
        c.moderated_status !== 'ACTIVE' &&
        c.moderated_status !== 'CANCELLED'
    );

    const mw = getMWConfidence(call);
    const advisor = getAdvisor14dHR(call, priorTerminated);
    const token = getTokenHR(call, priorTerminated);

    const weightedScore = computeWeightedScore(mw.score, advisor.score, token.score);
    const { classification, userLabel } = classify(weightedScore);

    scoredCalls.push({
      ...call,
      weightedScore: Math.round(weightedScore * 100) / 100,
      classification,
      userLabel,
      inputs: {
        mwConfidence: mw.level,
        mwScore: mw.score,
        advisor14dHR: Math.round(advisor.hr * 10) / 10,
        advisor14dCallCount: advisor.callCount,
        advisorHRScore: advisor.score,
        tokenHR: Math.round(token.hr * 10) / 10,
        tokenCallCount: token.callCount,
        tokenHRScore: token.score,
      },
    });
  }

  return scoredCalls;
}

// ============================================
// Compute tier statistics
// ============================================

function computeTierStats(calls: ScoredCall[]): TierStats[] {
  const terminated = calls.filter(
    (c) =>
      c.status === 'APPROVED' &&
      c.moderated_status !== 'ACTIVE' &&
      c.moderated_status !== 'CANCELLED'
  );

  const tiers: { tier: ScoredCall['classification']; userLabel: string }[] = [
    { tier: 'Top Pick', userLabel: 'High Conviction' },
    { tier: 'Standard Pick', userLabel: 'Standard' },
    { tier: 'Aggressive Pick', userLabel: 'Moderate' },
  ];

  return tiers.map(({ tier, userLabel }) => {
    const tierCalls = terminated.filter((c) => c.classification === tier);
    const sysHits = tierCalls.filter((c) => c.is_system_hit).length;
    const realHits = tierCalls.filter((c) => c.is_real_hit).length;
    const rois = tierCalls.map((c) => c.roi).filter((r) => isFinite(r));

    return {
      tier,
      userLabel,
      totalCalls: tierCalls.length,
      systemHits: sysHits,
      systemHitRate: safeDiv(sysHits, tierCalls.length) * 100,
      realHits,
      realHitRate: safeDiv(realHits, tierCalls.length) * 100,
      avgROI: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0,
      avgResolutionMin: null, // Filled by caller if validation data exists
    };
  });
}

// ============================================
// Input-level separation analysis
// ============================================

function computeInputBreakdown(calls: ScoredCall[]): { label: string; separation: number }[] {
  const terminated = calls.filter(
    (c) =>
      c.status === 'APPROVED' &&
      c.moderated_status !== 'ACTIVE' &&
      c.moderated_status !== 'CANCELLED'
  );

  if (terminated.length < 5) return [];

  const inputs: { label: string; getScore: (c: ScoredCall) => number }[] = [
    { label: 'MW Confidence', getScore: (c) => c.inputs.mwScore },
    { label: 'Advisor 14D HR', getScore: (c) => c.inputs.advisorHRScore },
    { label: 'Token HR', getScore: (c) => c.inputs.tokenHRScore },
  ];

  return inputs.map(({ label, getScore }) => {
    const score3 = terminated.filter((c) => getScore(c) === 3);
    const score1 = terminated.filter((c) => getScore(c) === 1);

    const hr3 = score3.length > 0
      ? safeDiv(score3.filter((c) => c.is_system_hit).length, score3.length) * 100
      : 0;
    const hr1 = score1.length > 0
      ? safeDiv(score1.filter((c) => c.is_system_hit).length, score1.length) * 100
      : 0;

    return { label, separation: hr3 - hr1 };
  });
}

// ============================================
// Main backtest runner
// ============================================

export function runConfidenceBacktest(
  calls: TradeCall[],
  scope: 'all' | 'last100' = 'all'
): ConfidenceBacktest {
  // Score ALL calls walk-forward first
  const allScored = scoreAllCalls(calls);

  // Then slice for the requested scope
  const scoredCalls = scope === 'last100' ? allScored.slice(-100) : allScored;

  const tierStats = computeTierStats(scoredCalls);
  const inputBreakdown = computeInputBreakdown(scoredCalls);

  const topStats = tierStats.find((t) => t.tier === 'Top Pick');
  const stdStats = tierStats.find((t) => t.tier === 'Standard Pick');
  const aggStats = tierStats.find((t) => t.tier === 'Aggressive Pick');

  return {
    scoredCalls,
    tierStats,
    inputBreakdown,
    overallStats: {
      topPickHR: topStats?.systemHitRate ?? 0,
      standardHR: stdStats?.systemHitRate ?? 0,
      aggressiveHR: aggStats?.systemHitRate ?? 0,
      separation: (topStats?.systemHitRate ?? 0) - (aggStats?.systemHitRate ?? 0),
      totalScored: tierStats.reduce((sum, t) => sum + t.totalCalls, 0),
    },
  };
}
