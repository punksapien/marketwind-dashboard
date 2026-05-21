import * as XLSX from 'xlsx';
import { TradeCall } from './types';
import {
  computeOverview,
  computeAdvisorStats,
  computeTokenStats,
  computeDailyTrends,
  computeWeeklyTrends,
  computeRRBuckets,
  computeBacktest,
  computeMonthlyDistribution,
} from './analytics';
import { runConfidenceBacktest } from './confidence';
import { advisorName } from './utils';

export function exportFullReport(calls: TradeCall[], fileName: string) {
  const wb = XLSX.utils.book_new();

  // ============================================
  // 1. Summary Sheet
  // ============================================
  const overview = computeOverview(calls);
  const summaryData = [
    ['Marketwind Analytics Report'],
    ['Generated', new Date().toISOString().slice(0, 19)],
    ['Source File', fileName],
    [],
    ['OVERVIEW'],
    ['Total Calls', overview.totalCalls],
    ['Approved', overview.approvedCalls],
    ['Rejected', overview.rejectedCalls],
    ['Active (Running)', overview.activeCalls],
    ['Terminated', overview.terminatedCalls],
    [],
    ['HIT RATES'],
    ['System Hit Rate (Overall)', `${overview.systemHitRate.toFixed(1)}%`],
    ['System Hit Rate (Approved)', `${overview.approvedSystemHitRate.toFixed(1)}%`],
    ['Real Hit Rate (Overall)', `${overview.realHitRate.toFixed(1)}%`],
    ['Real Hit Rate (Approved)', `${overview.approvedRealHitRate.toFixed(1)}%`],
    [],
    ['TERMINAL REASONS'],
    ...Object.entries(overview.terminalBreakdown).map(([reason, count]) => [reason, count]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // ============================================
  // 2. All Trades Sheet
  // ============================================
  const tradesData = calls.map((c) => ({
    ID: c.id,
    'Created Date': c.created_date,
    'Entry Time': c.entry_time,
    'Validity Date': c.validity_date,
    Advisor: c.email,
    Market: c.market,
    Token: c.token,
    Category: c.category,
    'Entry From': c.entry_from,
    'Entry To': c.entry_to,
    'Entry Mid': c.entry_mid,
    Leverage: c.leverage,
    'Take Profit': c.take_profit,
    'Stop Loss': c.stop_loss,
    Side: c.side,
    'RR Ratio': Math.round(c.rr_ratio * 100) / 100,
    'Leveraged SL%': Math.round(c.sl_pct * c.leverage * 100) / 100,
    Status: c.status,
    'Moderated Status': c.moderated_status,
    'Terminal Reason': c.terminal_reason,
    'System Hit': c.is_system_hit ? 'YES' : 'NO',
    'Real Result': c.real_result || '',
    'Real Hit': c.is_real_hit ? 'YES' : 'NO',
    ROI: c.roi,
  }));
  const tradesSheet = XLSX.utils.json_to_sheet(tradesData);
  tradesSheet['!cols'] = Object.keys(tradesData[0] || {}).map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, tradesSheet, 'All Trades');

  // ============================================
  // 3. Advisor Performance Sheet
  // ============================================
  const advisorStats = computeAdvisorStats(calls);
  const advisorData = advisorStats.map((a) => ({
    Advisor: advisorName(a.email),
    Email: a.email,
    'Total Calls': a.totalCalls,
    Approved: a.approvedCalls,
    Terminated: a.terminatedCalls,
    'System Hits': a.systemHits,
    'System HR%': Math.round(a.systemHitRate * 10) / 10,
    'Real Hits': a.realHits,
    'Real HR%': Math.round(a.realHitRate * 10) / 10,
    'Avg RR': Math.round(a.avgRR * 100) / 100,
    Score: Math.round(a.score * 10) / 10,
    Tier: a.tier,
  }));
  const advisorSheet = XLSX.utils.json_to_sheet(advisorData);
  advisorSheet['!cols'] = Object.keys(advisorData[0] || {}).map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, advisorSheet, 'Advisors');

  // ============================================
  // 4. Token Performance Sheet
  // ============================================
  const tokenStats = computeTokenStats(calls);
  const tokenData = tokenStats.map((t) => ({
    Token: t.token,
    Category: t.category,
    'Total Calls': t.totalCalls,
    Approved: t.approvedCalls,
    'System Hits': t.systemHits,
    'System HR%': Math.round(t.systemHitRate * 10) / 10,
    'Real Hits': t.realHits,
    'Real HR%': Math.round(t.realHitRate * 10) / 10,
    'Avg ROI': Math.round(t.avgROI * 10000) / 100,
  }));
  const tokenSheet = XLSX.utils.json_to_sheet(tokenData);
  XLSX.utils.book_append_sheet(wb, tokenSheet, 'Tokens');

  // ============================================
  // 5. Daily Trends Sheet
  // ============================================
  const daily = computeDailyTrends(calls);
  const dailyData = daily.map((d) => ({
    Date: d.date,
    'Total Calls': d.totalCalls,
    'Approved Calls': d.approvedCalls,
    'System HR% (Overall)': Math.round(d.systemHitRate * 10) / 10,
    'System HR% (Approved)': Math.round(d.approvedSystemHitRate * 10) / 10,
    'Real HR% (Overall)': Math.round(d.realHitRate * 10) / 10,
    'Real HR% (Approved)': Math.round(d.approvedRealHitRate * 10) / 10,
  }));
  const dailySheet = XLSX.utils.json_to_sheet(dailyData);
  XLSX.utils.book_append_sheet(wb, dailySheet, 'Daily Trends');

  // ============================================
  // 6. Weekly Trends Sheet
  // ============================================
  const weekly = computeWeeklyTrends(calls);
  const weeklyData = weekly.map((w) => ({
    'Week Start': w.weekStart,
    'Total Calls': w.totalCalls,
    'Approved Calls': w.approvedCalls,
    'System HR% (Overall)': Math.round(w.systemHitRate * 10) / 10,
    'System HR% (Approved)': Math.round(w.approvedSystemHitRate * 10) / 10,
    'Real HR% (Overall)': Math.round(w.realHitRate * 10) / 10,
    'Real HR% (Approved)': Math.round(w.approvedRealHitRate * 10) / 10,
  }));
  const weeklySheet = XLSX.utils.json_to_sheet(weeklyData);
  XLSX.utils.book_append_sheet(wb, weeklySheet, 'Weekly Trends');

  // ============================================
  // 7. RR Buckets Sheet
  // ============================================
  const rrBuckets = computeRRBuckets(calls);
  const rrData = rrBuckets.map((b) => ({
    'RR Bucket': b.label,
    Calls: b.totalCalls,
    'System Hits': b.systemHits,
    'System HR%': Math.round(b.systemHitRate * 10) / 10,
    'Real Hits': b.realHits,
    'Real HR%': Math.round(b.realHitRate * 10) / 10,
    'Avg ROI': Math.round(b.avgROI * 10000) / 100,
  }));
  const rrSheet = XLSX.utils.json_to_sheet(rrData);
  XLSX.utils.book_append_sheet(wb, rrSheet, 'RR Analysis');

  // ============================================
  // 8. Backtest Sheet
  // ============================================
  const bt = computeBacktest(calls);
  const btData = [
    ['FRAMEWORK BACKTEST'],
    [],
    ['Framework', 'Rules', 'Volume', 'System HR%', 'Real HR%'],
    [bt.old.label, bt.old.rules, bt.old.volume, `${bt.old.systemHitRate.toFixed(1)}%`, `${bt.old.realHitRate.toFixed(1)}%`],
    [bt.new.label, bt.new.rules, bt.new.volume, `${bt.new.systemHitRate.toFixed(1)}%`, `${bt.new.realHitRate.toFixed(1)}%`],
    [],
    ['Fake RR Calls Blocked', bt.fakeRRCount],
    ['Fake RR Hit Rate', `${bt.fakeRRHitRate.toFixed(1)}%`],
  ];
  const btSheet = XLSX.utils.aoa_to_sheet(btData);
  btSheet['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, btSheet, 'Backtest');

  // ============================================
  // 9. Monthly Distribution Sheet
  // ============================================
  const monthlyDist = computeMonthlyDistribution(calls);
  if (monthlyDist.length > 0) {
    const monthlySheet = XLSX.utils.json_to_sheet(monthlyDist);
    XLSX.utils.book_append_sheet(wb, monthlySheet, 'Monthly Distribution');
  }

  // ============================================
  // 10. Confidence Score Sheet
  // ============================================
  const conf = runConfidenceBacktest(calls, 'all');
  const confTierData = [
    ['CONFIDENCE SCORE - TIER PERFORMANCE'],
    [],
    ['Tier', 'User Label', 'Calls', 'System Hits', 'System HR%', 'Real Hits', 'Real HR%'],
    ...conf.tierStats.map((t) => [
      t.tier, t.userLabel, t.totalCalls, t.systemHits,
      `${t.systemHitRate.toFixed(1)}%`, t.realHits, `${t.realHitRate.toFixed(1)}%`,
    ]),
    [],
    ['Tier Separation (Top - Aggressive)', `${conf.overallStats.separation.toFixed(1)}pp`],
    [],
    ['INPUT EFFECTIVENESS'],
    ['Input', 'HR Separation (score 3 vs 1)'],
    ...conf.inputBreakdown.map((ib) => [ib.label, `${ib.separation.toFixed(1)}pp`]),
  ];
  const confSheet = XLSX.utils.aoa_to_sheet(confTierData);
  confSheet['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, confSheet, 'Confidence Score');

  // Scored calls detail
  const confCallsData = conf.scoredCalls
    .filter((c) => c.status === 'APPROVED' && c.moderated_status !== 'ACTIVE' && c.moderated_status !== 'CANCELLED')
    .map((c) => ({
      ID: c.id,
      Token: c.token,
      Advisor: c.email,
      'Weighted Score': c.weightedScore,
      Classification: c.classification,
      'User Label': c.userLabel,
      'MW Score': c.inputs.mwScore,
      'Advisor 14D HR': c.inputs.advisor14dHR,
      'Advisor HR Score': c.inputs.advisorHRScore,
      'Token HR': c.inputs.tokenHR,
      'Token Calls': c.inputs.tokenCallCount,
      'Token HR Score': c.inputs.tokenHRScore,
      'System Hit': c.is_system_hit ? 'YES' : 'NO',
      'Real Hit': c.is_real_hit ? 'YES' : 'NO',
    }));
  if (confCallsData.length > 0) {
    const confCallsSheet = XLSX.utils.json_to_sheet(confCallsData);
    confCallsSheet['!cols'] = Object.keys(confCallsData[0]).map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, confCallsSheet, 'Confidence Calls');
  }

  // ============================================
  // Download
  // ============================================
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Marketwind_Report_${timestamp}.xlsx`);
}
