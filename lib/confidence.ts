import { TradeCall } from './types';
import { safeDiv } from './utils';

// ============================================
// CONFIDENCE SCORE ENGINE v0
//
// Rule-based scoring using features available
// from the CSV data. Walk-forward: each call
// is scored using ONLY data from prior calls.
// ============================================

export interface ConfidenceFeatures {
  advisorRollingHR: number;       // Advisor's hit rate on prior N calls
  advisorCallCount: number;       // How many prior calls the advisor had
  rrQuality: number;              // RR ratio vs minimum (1.5)
  leverageBand: 'low' | 'mid' | 'high';
  leveragedSLPct: number;         // Actual leveraged SL %
  tokenCategoryHR: number;        // Category historical hit rate
  tokenSpecificHR: number;        // Token-specific historical hit rate
  tokenCallCount: number;         // Prior calls on this token
  direction: 'long' | 'short';
  directionHR: number;            // Historical hit rate for this direction
}

export interface ScoredCall extends TradeCall {
  confidenceScore: number;        // 0-100
  confidenceBand: 'High' | 'Medium' | 'Standard';
  expectedR: number;              // Expected R per trade
  features: ConfidenceFeatures;
}

export interface ConfidenceBandStats {
  band: string;
  totalCalls: number;
  systemHits: number;
  systemHitRate: number;
  realHits: number;
  realHitRate: number;
  avgROI: number;
  expectedR: number;
}

export interface FeatureImportance {
  feature: string;
  label: string;
  correlation: number;            // Correlation with hit outcome
  separation: number;             // Hit rate spread between high/low values
}

export interface ConfidenceBacktest {
  scoredCalls: ScoredCall[];
  bandStats: ConfidenceBandStats[];
  featureImportance: FeatureImportance[];
  calibration: { predicted: number; actual: number; count: number }[];
  overallStats: {
    highHR: number;
    mediumHR: number;
    standardHR: number;
    separation: number;           // High HR - Standard HR
    totalScored: number;
  };
}

// ============================================
// Feature computation (walk-forward)
// ============================================

function computeFeatures(
  call: TradeCall,
  priorCalls: TradeCall[]
): ConfidenceFeatures {
  // Filter to terminated prior calls for hit rate computation
  const priorTerminated = priorCalls.filter(
    (c) =>
      c.status === 'APPROVED' &&
      c.moderated_status !== 'ACTIVE' &&
      c.moderated_status !== 'CANCELLED'
  );

  // Advisor rolling hit rate (last 30 calls or all if fewer)
  const advisorPrior = priorTerminated
    .filter((c) => c.email === call.email)
    .slice(-30);
  const advisorHits = advisorPrior.filter((c) => c.is_system_hit).length;
  const advisorRollingHR =
    advisorPrior.length >= 3
      ? safeDiv(advisorHits, advisorPrior.length) * 100
      : 50; // Prior: assume 50% if insufficient data

  // RR quality: how far above minimum 1.5
  const rrQuality = Math.max(0, call.rr_ratio - 1.0);

  // Leverage band
  const lev = call.leverage;
  const leverageBand: 'low' | 'mid' | 'high' =
    lev <= 7 ? 'low' : lev <= 14 ? 'mid' : 'high';

  // Leveraged SL %
  const leveragedSLPct = call.sl_pct * call.leverage;

  // Token category historical HR
  const categoryPrior = priorTerminated.filter(
    (c) => c.category === call.category
  );
  const categoryHits = categoryPrior.filter((c) => c.is_system_hit).length;
  const tokenCategoryHR =
    categoryPrior.length >= 5
      ? safeDiv(categoryHits, categoryPrior.length) * 100
      : 50;

  // Token-specific HR
  const tokenPrior = priorTerminated.filter((c) => c.token === call.token);
  const tokenHits = tokenPrior.filter((c) => c.is_system_hit).length;
  const tokenSpecificHR =
    tokenPrior.length >= 3
      ? safeDiv(tokenHits, tokenPrior.length) * 100
      : tokenCategoryHR; // Fall back to category

  // Direction HR
  const dirPrior = priorTerminated.filter((c) => c.side === call.side);
  const dirHits = dirPrior.filter((c) => c.is_system_hit).length;
  const directionHR =
    dirPrior.length >= 5
      ? safeDiv(dirHits, dirPrior.length) * 100
      : 50;

  return {
    advisorRollingHR,
    advisorCallCount: advisorPrior.length,
    rrQuality,
    leverageBand,
    leveragedSLPct,
    tokenCategoryHR,
    tokenSpecificHR,
    tokenCallCount: tokenPrior.length,
    direction: call.side,
    directionHR,
  };
}

// ============================================
// Score computation (rule-based v0)
// ============================================

function computeScore(features: ConfidenceFeatures): number {
  let score = 0;

  // 1. Advisor track record (0-35 points)
  // Strong weight — advisor skill is the highest-signal feature
  if (features.advisorCallCount >= 3) {
    if (features.advisorRollingHR >= 70) score += 35;
    else if (features.advisorRollingHR >= 60) score += 25;
    else if (features.advisorRollingHR >= 50) score += 15;
    else if (features.advisorRollingHR >= 40) score += 5;
    // Below 40%: 0 points
  } else {
    score += 12; // Cold start: neutral
  }

  // 2. RR quality (0-20 points)
  // Higher RR = wider TP distance = harder to reach but more rewarding
  // For hit probability, lower RR is actually easier to hit
  // But the requirement is 1.5 min, so being at 1.5 is "just passing"
  if (features.rrQuality <= 0.2) score += 20; // RR 1.0-1.2: tight, high prob
  else if (features.rrQuality <= 0.5) score += 15; // RR 1.2-1.5: solid
  else if (features.rrQuality <= 0.8) score += 10; // RR 1.5-1.8: moderate
  else score += 5; // RR > 1.8: ambitious

  // 3. Leverage band (0-15 points)
  // Lower leverage = wider underlying SL = more room to breathe
  if (features.leverageBand === 'low') score += 15;
  else if (features.leverageBand === 'mid') score += 10;
  else score += 3; // High leverage = tight underlying SL

  // 4. Token/category track record (0-15 points)
  if (features.tokenCallCount >= 3) {
    if (features.tokenSpecificHR >= 65) score += 15;
    else if (features.tokenSpecificHR >= 55) score += 10;
    else if (features.tokenSpecificHR >= 45) score += 5;
  } else {
    // Fall back to category
    if (features.tokenCategoryHR >= 60) score += 10;
    else if (features.tokenCategoryHR >= 50) score += 6;
    else score += 3;
  }

  // 5. Direction alignment (0-10 points)
  if (features.directionHR >= 60) score += 10;
  else if (features.directionHR >= 50) score += 6;
  else score += 2;

  // 6. Leveraged SL sweet spot (0-5 points)
  // 18-22% band — center (20%) is ideal
  const slDeviation = Math.abs(features.leveragedSLPct - 20);
  if (slDeviation <= 1) score += 5;
  else if (slDeviation <= 2) score += 3;
  else score += 1;

  return Math.min(100, Math.max(0, score));
}

function scoreToBand(score: number): 'High' | 'Medium' | 'Standard' {
  if (score >= 70) return 'High';
  if (score >= 50) return 'Medium';
  return 'Standard';
}

function scoreToExpectedR(score: number): number {
  // Map score to expected R based on the 1:1.5 R:R structure
  // At 65% HR: EV = 0.65*1.5 - 0.35*1 = 0.625R
  // Confidence maps to estimated P(TP)
  const estimatedP = 0.4 + (score / 100) * 0.4; // Range: 40% to 80%
  return estimatedP * 1.5 - (1 - estimatedP) * 1;
}

// ============================================
// Walk-forward backtest
// ============================================

export function runConfidenceBacktest(calls: TradeCall[]): ConfidenceBacktest {
  // Sort calls chronologically
  const sorted = [...calls].sort((a, b) =>
    a.created_date.localeCompare(b.created_date) ||
    a.entry_time.localeCompare(b.entry_time)
  );

  const scoredCalls: ScoredCall[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const call = sorted[i];
    const priorCalls = sorted.slice(0, i); // Walk-forward: only use prior data

    const features = computeFeatures(call, priorCalls);
    const score = computeScore(features);
    const band = scoreToBand(score);
    const expectedR = scoreToExpectedR(score);

    scoredCalls.push({
      ...call,
      confidenceScore: score,
      confidenceBand: band,
      expectedR,
      features,
    });
  }

  // Compute band statistics (only on terminated approved calls)
  const terminated = scoredCalls.filter(
    (c) =>
      c.status === 'APPROVED' &&
      c.moderated_status !== 'ACTIVE' &&
      c.moderated_status !== 'CANCELLED'
  );

  const bands = ['High', 'Medium', 'Standard'] as const;
  const bandStats: ConfidenceBandStats[] = bands.map((band) => {
    const bandCalls = terminated.filter((c) => c.confidenceBand === band);
    const sysHits = bandCalls.filter((c) => c.is_system_hit).length;
    const realHits = bandCalls.filter((c) => c.is_real_hit).length;
    const rois = bandCalls.map((c) => c.roi).filter((r) => isFinite(r));
    const hitRate = safeDiv(sysHits, bandCalls.length) * 100;

    return {
      band,
      totalCalls: bandCalls.length,
      systemHits: sysHits,
      systemHitRate: hitRate,
      realHits,
      realHitRate: safeDiv(realHits, bandCalls.length) * 100,
      avgROI:
        rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0,
      expectedR: hitRate > 0 ? (hitRate / 100) * 1.5 - (1 - hitRate / 100) : 0,
    };
  });

  // Feature importance: correlation of each feature with hit outcome
  const featureImportance = computeFeatureImportance(terminated);

  // Calibration: bucket by score deciles and compare predicted vs actual
  const calibration = computeCalibration(terminated);

  const highStats = bandStats.find((b) => b.band === 'High');
  const medStats = bandStats.find((b) => b.band === 'Medium');
  const stdStats = bandStats.find((b) => b.band === 'Standard');

  return {
    scoredCalls,
    bandStats,
    featureImportance,
    calibration,
    overallStats: {
      highHR: highStats?.systemHitRate ?? 0,
      mediumHR: medStats?.systemHitRate ?? 0,
      standardHR: stdStats?.systemHitRate ?? 0,
      separation: (highStats?.systemHitRate ?? 0) - (stdStats?.systemHitRate ?? 0),
      totalScored: terminated.length,
    },
  };
}

// ============================================
// Feature importance via point-biserial corr
// ============================================

function computeFeatureImportance(
  calls: ScoredCall[]
): FeatureImportance[] {
  if (calls.length < 5) return [];

  const features: {
    key: keyof ConfidenceFeatures;
    label: string;
    extract: (c: ScoredCall) => number;
  }[] = [
    {
      key: 'advisorRollingHR',
      label: 'Advisor Rolling Hit Rate',
      extract: (c) => c.features.advisorRollingHR,
    },
    {
      key: 'rrQuality',
      label: 'RR Quality (above min)',
      extract: (c) => c.features.rrQuality,
    },
    {
      key: 'leveragedSLPct',
      label: 'Leveraged SL %',
      extract: (c) => c.features.leveragedSLPct,
    },
    {
      key: 'tokenSpecificHR',
      label: 'Token Historical HR',
      extract: (c) => c.features.tokenSpecificHR,
    },
    {
      key: 'tokenCategoryHR',
      label: 'Category Historical HR',
      extract: (c) => c.features.tokenCategoryHR,
    },
    {
      key: 'directionHR',
      label: 'Direction Historical HR',
      extract: (c) => c.features.directionHR,
    },
  ];

  return features.map(({ key, label, extract }) => {
    const values = calls.map(extract);
    const outcomes = calls.map((c) => (c.is_system_hit ? 1 : 0));

    const corr = pearsonCorrelation(values, outcomes);

    // Separation: hit rate in top third vs bottom third
    const sortedByFeature = [...calls].sort(
      (a, b) => extract(a) - extract(b)
    );
    const third = Math.floor(calls.length / 3);
    const bottomThird = sortedByFeature.slice(0, third);
    const topThird = sortedByFeature.slice(-third);
    const bottomHR =
      safeDiv(
        bottomThird.filter((c) => c.is_system_hit).length,
        bottomThird.length
      ) * 100;
    const topHR =
      safeDiv(
        topThird.filter((c) => c.is_system_hit).length,
        topThird.length
      ) * 100;

    return {
      feature: key,
      label,
      correlation: corr,
      separation: topHR - bottomHR,
    };
  });
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// ============================================
// Calibration (predicted vs actual)
// ============================================

function computeCalibration(
  calls: ScoredCall[]
): { predicted: number; actual: number; count: number }[] {
  // Bucket by score ranges (0-20, 20-40, 40-60, 60-80, 80-100)
  const buckets = [
    { min: 0, max: 20 },
    { min: 20, max: 40 },
    { min: 40, max: 60 },
    { min: 60, max: 80 },
    { min: 80, max: 100 },
  ];

  return buckets.map(({ min, max }) => {
    const bucket = calls.filter(
      (c) => c.confidenceScore >= min && c.confidenceScore < max
    );
    const predicted = (min + max) / 2;
    const actual =
      bucket.length > 0
        ? safeDiv(
            bucket.filter((c) => c.is_system_hit).length,
            bucket.length
          ) * 100
        : 0;
    return { predicted, actual, count: bucket.length };
  });
}
