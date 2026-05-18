import {
  TradeCall,
  OverviewStats,
  AdvisorStats,
  TokenStats,
  DailyStats,
  WeeklyStats,
  RRBucket,
  HeatmapData,
} from './types';
import { RR_BUCKETS } from './constants';
import { advisorName, safeDiv, getWeekStart } from './utils';

// Helpers
function terminated(calls: TradeCall[]): TradeCall[] {
  return calls.filter(
    (c) => c.moderated_status !== 'ACTIVE' && c.moderated_status !== 'CANCELLED'
  );
}

function approved(calls: TradeCall[]): TradeCall[] {
  return calls.filter((c) => c.status === 'APPROVED');
}

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

// 1. Overview
export function computeOverview(calls: TradeCall[]): OverviewStats {
  const total = calls.length;
  const approvedCalls = calls.filter((c) => c.status === 'APPROVED');
  const rejectedCalls = calls.filter((c) => c.status === 'REJECTED');
  const activeCalls = calls.filter((c) => c.moderated_status === 'ACTIVE');
  const term = terminated(calls);
  const appTerm = terminated(approvedCalls);

  const systemHits = term.filter((c) => c.is_system_hit).length;
  const realHits = term.filter((c) => c.is_real_hit).length;
  const appSystemHits = appTerm.filter((c) => c.is_system_hit).length;
  const appRealHits = appTerm.filter((c) => c.is_real_hit).length;

  const terminalBreakdown: Record<string, number> = {};
  for (const c of term) {
    const reason = c.terminal_reason || 'UNKNOWN';
    terminalBreakdown[reason] = (terminalBreakdown[reason] || 0) + 1;
  }

  const statusBreakdown: Record<string, number> = {};
  for (const c of calls) {
    const s = c.status || 'UNKNOWN';
    statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
  }

  return {
    totalCalls: total,
    approvedCalls: approvedCalls.length,
    rejectedCalls: rejectedCalls.length,
    activeCalls: activeCalls.length,
    terminatedCalls: term.length,
    systemHits,
    systemHitRate: safeDiv(systemHits, term.length) * 100,
    realHits,
    realHitRate: safeDiv(realHits, term.length) * 100,
    approvedSystemHitRate: safeDiv(appSystemHits, appTerm.length) * 100,
    approvedRealHitRate: safeDiv(appRealHits, appTerm.length) * 100,
    terminalBreakdown,
    statusBreakdown,
  };
}

// 2. Advisor Performance
export function computeAdvisorStats(calls: TradeCall[]): AdvisorStats[] {
  const grouped = groupBy(calls, (c) => c.email);
  const stats: AdvisorStats[] = [];

  for (const [email, advisorCalls] of grouped) {
    const app = approved(advisorCalls);
    const term = terminated(advisorCalls);
    const appTerm = terminated(app);
    const sysHits = appTerm.filter((c) => c.is_system_hit).length;
    const realHits = appTerm.filter((c) => c.is_real_hit).length;
    const rrs = appTerm.map((c) => c.rr_ratio).filter((r) => r > 0 && isFinite(r));
    const rois = appTerm.map((c) => c.roi).filter((r) => isFinite(r));

    const realHitRate = safeDiv(realHits, appTerm.length) * 100;
    const callCount = appTerm.length;

    // Score: (hitRate/10) * volume_multiplier
    let multiplier = 1.0;
    if (callCount < 10) multiplier = 0.75;
    else if (callCount < 25) multiplier = 0.9;
    const score = (realHitRate / 10) * multiplier;

    let tier: 'A' | 'B' | 'C' = 'C';
    if (score >= 6.0) tier = 'A';
    else if (score >= 4.0) tier = 'B';

    stats.push({
      email,
      displayName: advisorName(email),
      totalCalls: advisorCalls.length,
      approvedCalls: app.length,
      terminatedCalls: appTerm.length,
      systemHits: sysHits,
      systemHitRate: safeDiv(sysHits, appTerm.length) * 100,
      realHits,
      realHitRate,
      avgRR: rrs.length > 0 ? rrs.reduce((a, b) => a + b, 0) / rrs.length : 0,
      avgROI: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0,
      score,
      tier,
    });
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls);
}

// 3. Token Performance
export function computeTokenStats(calls: TradeCall[]): TokenStats[] {
  const grouped = groupBy(calls, (c) => c.token);
  const stats: TokenStats[] = [];

  for (const [token, tokenCalls] of grouped) {
    const app = approved(tokenCalls);
    const term = terminated(tokenCalls);
    const appTerm = terminated(app);
    const sysHits = appTerm.filter((c) => c.is_system_hit).length;
    const realHits = appTerm.filter((c) => c.is_real_hit).length;
    const rois = appTerm.map((c) => c.roi).filter((r) => isFinite(r));

    stats.push({
      token,
      category: tokenCalls[0]?.category || 'Altcoin',
      totalCalls: tokenCalls.length,
      approvedCalls: app.length,
      systemHits: sysHits,
      systemHitRate: safeDiv(sysHits, appTerm.length) * 100,
      realHits,
      realHitRate: safeDiv(realHits, appTerm.length) * 100,
      avgROI: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0,
    });
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls);
}

// 4. Daily Trends
export function computeDailyTrends(calls: TradeCall[]): DailyStats[] {
  const grouped = groupBy(calls, (c) => c.created_date.split(' ')[0]);
  const stats: DailyStats[] = [];

  for (const [date, dayCalls] of grouped) {
    if (!date) continue;
    const app = approved(dayCalls);
    const term = terminated(dayCalls);
    const appTerm = terminated(app);

    stats.push({
      date,
      totalCalls: dayCalls.length,
      approvedCalls: app.length,
      systemHitRate: safeDiv(term.filter((c) => c.is_system_hit).length, term.length) * 100,
      realHitRate: safeDiv(term.filter((c) => c.is_real_hit).length, term.length) * 100,
      approvedSystemHitRate: safeDiv(appTerm.filter((c) => c.is_system_hit).length, appTerm.length) * 100,
      approvedRealHitRate: safeDiv(appTerm.filter((c) => c.is_real_hit).length, appTerm.length) * 100,
    });
  }

  return stats.sort((a, b) => a.date.localeCompare(b.date));
}

// 5. Weekly Trends
export function computeWeeklyTrends(calls: TradeCall[]): WeeklyStats[] {
  const grouped = groupBy(calls, (c) => getWeekStart(c.created_date));
  const stats: WeeklyStats[] = [];

  for (const [weekStart, weekCalls] of grouped) {
    if (!weekStart || weekStart === 'Invalid Date') continue;
    const app = approved(weekCalls);
    const term = terminated(weekCalls);
    const appTerm = terminated(app);

    stats.push({
      weekStart,
      totalCalls: weekCalls.length,
      approvedCalls: app.length,
      systemHitRate: safeDiv(term.filter((c) => c.is_system_hit).length, term.length) * 100,
      realHitRate: safeDiv(term.filter((c) => c.is_real_hit).length, term.length) * 100,
      approvedSystemHitRate: safeDiv(appTerm.filter((c) => c.is_system_hit).length, appTerm.length) * 100,
      approvedRealHitRate: safeDiv(appTerm.filter((c) => c.is_real_hit).length, appTerm.length) * 100,
    });
  }

  return stats.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// 6. RR Buckets
export function computeRRBuckets(calls: TradeCall[]): RRBucket[] {
  const term = terminated(approved(calls));

  return RR_BUCKETS.map((bucket) => {
    const inBucket = term.filter(
      (c) => c.rr_ratio >= bucket.min && c.rr_ratio < bucket.max
    );
    const sysHits = inBucket.filter((c) => c.is_system_hit).length;
    const realHits = inBucket.filter((c) => c.is_real_hit).length;
    const rois = inBucket.map((c) => c.roi).filter((r) => isFinite(r));

    return {
      label: bucket.label,
      totalCalls: inBucket.length,
      systemHits: sysHits,
      systemHitRate: safeDiv(sysHits, inBucket.length) * 100,
      realHits,
      realHitRate: safeDiv(realHits, inBucket.length) * 100,
      avgROI: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : 0,
    };
  });
}

// 7. Heatmap
export function computeHeatmap(calls: TradeCall[]): HeatmapData {
  const appTerm = terminated(approved(calls));
  const advisorGroup = groupBy(appTerm, (c) => c.email);

  // Only include advisors with >= 3 calls
  const advisors = [...advisorGroup.entries()]
    .filter(([, v]) => v.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15)
    .map(([k]) => k);

  const dates = [...new Set(appTerm.map((c) => c.created_date.split(' ')[0]))]
    .filter(Boolean)
    .sort();

  const grid: (number | null)[][] = advisors.map((adv) => {
    return dates.map((date) => {
      const dayCalls = appTerm.filter(
        (c) => c.email === adv && c.created_date.split(' ')[0] === date
      );
      if (dayCalls.length === 0) return null;
      const hits = dayCalls.filter((c) => c.is_real_hit).length;
      return (hits / dayCalls.length) * 100;
    });
  });

  return { advisors, dates, grid };
}

// 8. Backtest (Old vs New Framework)
export function computeBacktest(calls: TradeCall[]) {
  const term = terminated(calls);

  // Old framework: approve all with leverage 2-15, RR >= 1.5 (using entry_from)
  const oldApproved = term.filter((c) => {
    const risk = Math.abs(c.entry_from - c.stop_loss);
    const reward = Math.abs(c.entry_from - c.take_profit);
    const oldRR = risk > 0 ? reward / risk : 0;
    return c.leverage >= 2 && c.leverage <= 15 && oldRR >= 1.5;
  });

  // New framework: True RR >= 1.3 (using midpoint) + entry range 0.5-1.5% + SL 18-22% leveraged
  const newApproved = term.filter((c) => {
    const entryRangePct =
      c.entry_from > 0
        ? (Math.abs(c.entry_from - c.entry_to) / c.entry_from) * 100
        : 0;
    const slPctLeveraged = c.sl_pct * c.leverage;
    return (
      c.rr_ratio >= 1.3 &&
      c.leverage >= 2 &&
      c.leverage <= 15 &&
      entryRangePct >= 0.5 &&
      entryRangePct <= 1.5 &&
      slPctLeveraged >= 18 &&
      slPctLeveraged <= 22
    );
  });

  const oldSysHR = safeDiv(oldApproved.filter((c) => c.is_system_hit).length, oldApproved.length) * 100;
  const oldRealHR = safeDiv(oldApproved.filter((c) => c.is_real_hit).length, oldApproved.length) * 100;
  const newSysHR = safeDiv(newApproved.filter((c) => c.is_system_hit).length, newApproved.length) * 100;
  const newRealHR = safeDiv(newApproved.filter((c) => c.is_real_hit).length, newApproved.length) * 100;

  // Fake RR calls: approved by old but rejected by new
  const fakeRR = oldApproved.filter(
    (c) => !newApproved.includes(c)
  );

  return {
    old: {
      label: 'Legacy Framework',
      rules: 'entry_from RR >= 1.5, leverage 2-15',
      volume: oldApproved.length,
      systemHitRate: oldSysHR,
      realHitRate: oldRealHR,
    },
    new: {
      label: 'New Framework',
      rules: 'True RR >= 1.3, entry range 0.5-1.5%, SL 18-22% leveraged',
      volume: newApproved.length,
      systemHitRate: newSysHR,
      realHitRate: newRealHR,
    },
    fakeRRCount: fakeRR.length,
    fakeRRHitRate: safeDiv(fakeRR.filter((c) => c.is_real_hit).length, fakeRR.length) * 100,
  };
}

// 9. Monthly Distribution
export function computeMonthlyDistribution(calls: TradeCall[]) {
  const app = approved(calls);
  const grouped = groupBy(app, (c) => {
    const d = new Date(c.created_date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const months = [...grouped.keys()].sort();
  const categories = ['Bluechip', 'Meme', 'Altcoin', 'Commodity'];

  return months.map((month) => {
    const monthCalls = grouped.get(month) || [];
    const row: Record<string, string | number> = { month };
    for (const cat of categories) {
      row[cat] = monthCalls.filter((c) => c.category === cat).length;
    }
    return row;
  });
}
