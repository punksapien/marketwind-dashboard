'use client';

import { useState, useCallback, useMemo } from 'react';
import { TradeCall } from '@/lib/types';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS } from '@/lib/constants';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
} from 'recharts';

interface ValidationResult {
  _uid: string;
  id: string;
  market: string;
  result: string;
  detail: string;
  candlesProcessed: number;
  // Timing fields
  durationFromSignalMin: number | null;
  durationFromEntryMin: number | null;
  resolvedAtIST: string | null;
  enteredAtIST: string | null;
}

type ValidationMode = 'immediate' | 'entry_check';

const RESULT_COLORS: Record<string, string> = {
  TAKE_PROFIT: CHART_COLORS.green,
  STOP_LOSS: CHART_COLORS.red,
  BOTH: CHART_COLORS.orange,
  EXPIRED: CHART_COLORS.yellow,
  SIDEWAYS: CHART_COLORS.purple,
  NO_ENTRY: '#666',
  NO_DATA: '#444',
  ERROR: '#444',
  DATE_ERROR: '#444',
};

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}

export function ValidateTab({
  calls,
  onResultsReady,
}: {
  calls: TradeCall[];
  onResultsReady: (results: Map<string, string>) => void;
}) {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [mode, setMode] = useState<ValidationMode>('immediate');

  const validatable = useMemo(
    () =>
      calls.filter(
        (c) => c.take_profit > 0 && c.stop_loss > 0 && c.market && c.entry_time
      ),
    [calls]
  );

  const runValidation = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const total = validatable.length;
    setProgress({ current: 0, total });

    const newResults: ValidationResult[] = [];
    const resultMap = new Map<string, string>();

    for (let i = 0; i < validatable.length; i++) {
      const call = validatable[i];
      setProgress({ current: i + 1, total });

      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market: call.market,
            entry_time: call.entry_time,
            validity_date: call.validity_date,
            entry_from: call.entry_from,
            entry_to: call.entry_to,
            take_profit: call.take_profit,
            stop_loss: call.stop_loss,
            mode,
          }),
        });

        const data = await res.json();
        const vr: ValidationResult = {
          _uid: call._uid,
          id: call.id,
          market: call.market,
          result: data.result || 'ERROR',
          detail: data.detail || '',
          candlesProcessed: data.candlesProcessed || 0,
          durationFromSignalMin: data.durationFromSignalMin ?? null,
          durationFromEntryMin: data.durationFromEntryMin ?? null,
          resolvedAtIST: data.resolvedAtIST ?? null,
          enteredAtIST: data.enteredAtIST ?? null,
        };
        newResults.push(vr);
        resultMap.set(call._uid, vr.result);
        setResults([...newResults]);
      } catch (err) {
        newResults.push({
          _uid: call._uid,
          id: call.id,
          market: call.market,
          result: 'ERROR',
          detail: String(err),
          candlesProcessed: 0,
          durationFromSignalMin: null,
          durationFromEntryMin: null,
          resolvedAtIST: null,
          enteredAtIST: null,
        });
        setResults([...newResults]);
      }
    }

    onResultsReady(resultMap);
    setRunning(false);
  }, [validatable, mode, onResultsReady]);

  // Summary stats
  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.result] = (counts[r.result] || 0) + 1;
    }
    const tp = counts['TAKE_PROFIT'] || 0;
    const sl = counts['STOP_LOSS'] || 0;
    const resolved = tp + sl + (counts['BOTH'] || 0);
    return {
      total: results.length,
      counts,
      tp,
      sl,
      hitRate: resolved > 0 ? (tp / resolved) * 100 : 0,
    };
  }, [results]);

  // Resolution time analytics
  const timeAnalytics = useMemo(() => {
    const resolved = results.filter(
      (r) =>
        (r.result === 'TAKE_PROFIT' || r.result === 'STOP_LOSS') &&
        r.durationFromSignalMin !== null
    );
    if (resolved.length === 0) return null;

    const durations = resolved.map((r) => r.durationFromSignalMin!);
    const sorted = [...durations].sort((a, b) => a - b);

    const tpDurations = resolved
      .filter((r) => r.result === 'TAKE_PROFIT')
      .map((r) => r.durationFromSignalMin!);
    const slDurations = resolved
      .filter((r) => r.result === 'STOP_LOSS')
      .map((r) => r.durationFromSignalMin!);

    const median = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const pct = (arr: number[], p: number) => {
      const s = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(s.length * (p / 100));
      return s[Math.min(idx, s.length - 1)];
    };

    // Histogram buckets
    const histBuckets = [
      { min: 0, max: 60, label: '<1h' },
      { min: 60, max: 240, label: '1-4h' },
      { min: 240, max: 720, label: '4-12h' },
      { min: 720, max: 1440, label: '12-24h' },
      { min: 1440, max: 2880, label: '1-2d' },
      { min: 2880, max: 4320, label: '2-3d' },
      { min: 4320, max: Infinity, label: '3d+' },
    ];

    const histogram = histBuckets.map((b) => {
      const tpCount = tpDurations.filter((d) => d >= b.min && d < b.max).length;
      const slCount = slDurations.filter((d) => d >= b.min && d < b.max).length;
      return { label: b.label, tp: tpCount, sl: slCount, total: tpCount + slCount };
    });

    // Scatter data: duration vs outcome
    const scatterData = resolved.map((r) => {
      const call = calls.find((c) => c._uid === r._uid);
      return {
        duration: r.durationFromSignalMin!,
        durationHours: Math.round((r.durationFromSignalMin! / 60) * 10) / 10,
        token: call?.token || '?',
        result: r.result,
        leverage: call?.leverage || 0,
      };
    });

    return {
      medianAll: median(durations),
      avgAll: avg(durations),
      p90All: pct(durations, 90),
      medianTP: tpDurations.length > 0 ? median(tpDurations) : null,
      medianSL: slDurations.length > 0 ? median(slDurations) : null,
      avgTP: tpDurations.length > 0 ? avg(tpDurations) : null,
      avgSL: slDurations.length > 0 ? avg(slDurations) : null,
      fastest: sorted[0],
      slowest: sorted[sorted.length - 1],
      histogram,
      scatterData,
      resolvedCount: resolved.length,
      // Call duration categories: Short (<6h), Medium (6h-2d), Long (2d-7d)
      durationCategories: (() => {
        const SHORT_MAX = 360;   // 6 hours in minutes
        const MEDIUM_MAX = 2880; // 2 days in minutes

        const shortCalls = resolved.filter((r) => r.durationFromSignalMin! < SHORT_MAX);
        const medCalls = resolved.filter((r) => r.durationFromSignalMin! >= SHORT_MAX && r.durationFromSignalMin! < MEDIUM_MAX);
        const longCalls = resolved.filter((r) => r.durationFromSignalMin! >= MEDIUM_MAX);

        const hitRate = (arr: typeof resolved) =>
          arr.length > 0
            ? (arr.filter((r) => r.result === 'TAKE_PROFIT').length / arr.length) * 100
            : 0;

        return [
          { label: 'Short (<6h)', count: shortCalls.length, tp: shortCalls.filter((r) => r.result === 'TAKE_PROFIT').length, sl: shortCalls.filter((r) => r.result === 'STOP_LOSS').length, hitRate: hitRate(shortCalls) },
          { label: 'Medium (6h-2d)', count: medCalls.length, tp: medCalls.filter((r) => r.result === 'TAKE_PROFIT').length, sl: medCalls.filter((r) => r.result === 'STOP_LOSS').length, hitRate: hitRate(medCalls) },
          { label: 'Long (2d-7d)', count: longCalls.length, tp: longCalls.filter((r) => r.result === 'TAKE_PROFIT').length, sl: longCalls.filter((r) => r.result === 'STOP_LOSS').length, hitRate: hitRate(longCalls) },
        ];
      })(),
    };
  }, [results, calls]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'market', label: 'Market' },
    {
      key: 'result',
      label: 'Result',
      render: (row: Record<string, unknown>) => {
        const r = String(row.result);
        return (
          <span
            className="px-2 py-0.5 text-xs font-bold rounded"
            style={{
              backgroundColor: `${RESULT_COLORS[r] || '#666'}22`,
              color: RESULT_COLORS[r] || '#999',
            }}
          >
            {r}
          </span>
        );
      },
    },
    {
      key: 'durationFromSignalMin',
      label: 'Time to Close',
      align: 'right' as const,
      render: (row: Record<string, unknown>) =>
        formatDuration(row.durationFromSignalMin as number | null),
    },
    {
      key: 'resolvedAtIST',
      label: 'Closed At (IST)',
      render: (row: Record<string, unknown>) => {
        const v = row.resolvedAtIST;
        return v ? (
          <span className="text-xs text-zinc-400">{String(v)}</span>
        ) : (
          <span className="text-xs text-zinc-600">-</span>
        );
      },
    },
    { key: 'candlesProcessed', label: 'Candles', align: 'right' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white mb-1">
              Trade Validation (CoinDCX API)
            </h3>
            <p className="text-xs text-zinc-500">
              Fetches 1-minute candles to verify TP/SL outcomes and measures exact resolution
              time for each call.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(['immediate', 'entry_check'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={running}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    mode === m
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                  } ${running ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {m === 'immediate' ? 'Immediate' : 'Entry Check'}
                </button>
              ))}
            </div>
            <button
              onClick={runValidation}
              disabled={running || validatable.length === 0}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                running
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {running
                ? `Validating ${progress.current}/${progress.total}...`
                : `Validate ${validatable.length} Calls`}
            </button>
          </div>
        </div>

        <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg text-xs text-zinc-400">
          {mode === 'immediate' ? (
            <>
              <strong className="text-zinc-300">Immediate mode:</strong> Assumes entry at
              signal time and checks TP/SL from the start. Best for auditing system-reported
              results.
            </>
          ) : (
            <>
              <strong className="text-zinc-300">Entry check mode:</strong> First verifies
              price entered the entry zone, then checks TP/SL. More conservative — may show
              &quot;NO_ENTRY&quot; for calls where price never reached the entry range.
            </>
          )}
        </div>

        {running && (
          <div className="mt-3">
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Validated" value={summary.total} />
            <KPICard
              label="Real Hit Rate"
              value={`${summary.hitRate.toFixed(1)}%`}
              subtitle={`${summary.tp} TP / ${summary.sl} SL`}
              color={summary.hitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
            />
            <KPICard label="Take Profits" value={summary.tp} color={CHART_COLORS.green} />
            <KPICard label="Stop Losses" value={summary.sl} color={CHART_COLORS.red} />
          </div>

          {/* Resolution Time KPIs */}
          {timeAnalytics && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPICard
                label="Median Resolution"
                value={formatDuration(timeAnalytics.medianAll)}
                subtitle={`${timeAnalytics.resolvedCount} resolved calls`}
                color={CHART_COLORS.cyan}
              />
              <KPICard
                label="Median TP Time"
                value={formatDuration(timeAnalytics.medianTP)}
                subtitle="Signal → Take Profit"
                color={CHART_COLORS.green}
              />
              <KPICard
                label="Median SL Time"
                value={formatDuration(timeAnalytics.medianSL)}
                subtitle="Signal → Stop Loss"
                color={CHART_COLORS.red}
              />
              <KPICard
                label="P90 Resolution"
                value={formatDuration(timeAnalytics.p90All)}
                subtitle="90th percentile"
                color={CHART_COLORS.orange}
              />
              <KPICard
                label="Fastest / Slowest"
                value={`${formatDuration(timeAnalytics.fastest)} / ${formatDuration(timeAnalytics.slowest)}`}
                subtitle="Min / Max"
              />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Result Distribution */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">Result Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={RESULT_COLORS[entry.name] || '#666'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* System vs Real comparison — aggregate rates like the Python audit */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">
                System vs Real Hit Rate Audit
              </h3>
              <div className="space-y-4">
                {(() => {
                  // Match Python exactly:
                  // - System hits = terminal_reason contains target/take_profit/tp (from CSV, ALL calls)
                  // - Real hits = validation result === TAKE_PROFIT (NO_DATA counts as non-hit, NOT excluded)
                  // - Denominator = ALL calls (Python never excludes NO API DATA from denominator)

                  // Build a result lookup from validation (keyed by _uid for uniqueness)
                  const resultMap = new Map<string, string>();
                  for (const r of results) {
                    resultMap.set(r._uid, r.result);
                  }

                  // OVERALL: all calls that were validated
                  const allValidated = calls.filter((c) => resultMap.has(c._uid));
                  const overallCount = allValidated.length;
                  const sysHitsOverall = allValidated.filter(
                    (c) => /TAKE.?PROFIT|TARGET/i.test(c.terminal_reason)
                  ).length;
                  const realHitsOverall = allValidated.filter(
                    (c) => resultMap.get(c._uid) === 'TAKE_PROFIT'
                  ).length;

                  // APPROVED: approved + exclude active/cancelled (Python's strict filter)
                  const approvedValidated = allValidated.filter(
                    (c) =>
                      c.status === 'APPROVED' &&
                      c.moderated_status !== 'ACTIVE' &&
                      c.moderated_status !== 'CANCELLED'
                  );
                  const appCount = approvedValidated.length;
                  const sysHitsApp = approvedValidated.filter(
                    (c) => /TAKE.?PROFIT|TARGET/i.test(c.terminal_reason)
                  ).length;
                  const realHitsApp = approvedValidated.filter(
                    (c) => resultMap.get(c._uid) === 'TAKE_PROFIT'
                  ).length;

                  const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '-';

                  return (
                    <>
                      {/* Overall */}
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        Overall (Calls = {overallCount})
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">System Target</span>
                        <span className="text-white font-medium">
                          {sysHitsOverall}{' '}
                          <span className="text-zinc-500">| {pct(sysHitsOverall, overallCount)}</span>
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Real Target</span>
                        <span className="text-white font-medium">
                          {realHitsOverall}{' '}
                          <span className="text-zinc-500">| {pct(realHitsOverall, overallCount)}</span>
                        </span>
                      </div>

                      <div className="border-t border-zinc-800 my-2" />

                      {/* Approved */}
                      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                        Approved (Calls = {appCount})
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">System Target</span>
                        <span className="text-white font-medium">
                          {sysHitsApp}{' '}
                          <span className="text-zinc-500">| {pct(sysHitsApp, appCount)}</span>
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Real Target</span>
                        <span className="text-white font-medium">
                          {realHitsApp}{' '}
                          <span className="text-zinc-500">| {pct(realHitsApp, appCount)}</span>
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Resolution Time Charts */}
          {timeAnalytics && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Time-to-Close Histogram */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">
                  Time-to-Close Distribution (TP vs SL)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeAnalytics.histogram}>
                    <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Bar
                      dataKey="tp"
                      name="Take Profit"
                      stackId="a"
                      fill={CHART_COLORS.green}
                    />
                    <Bar
                      dataKey="sl"
                      name="Stop Loss"
                      stackId="a"
                      fill={CHART_COLORS.red}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Faster SL than TP = normal (adverse moves are sharper). Watch for SL clustering
                  under 1h — may indicate entries too close to support/resistance.
                </p>
              </div>

              {/* Duration Scatter Plot */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">
                  Resolution Time vs Outcome
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="durationHours"
                      name="Duration (hours)"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      label={{
                        value: 'Hours to resolve',
                        position: 'bottom',
                        fill: '#71717a',
                        fontSize: 10,
                      }}
                    />
                    <YAxis
                      dataKey="leverage"
                      name="Leverage"
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      label={{
                        value: 'Leverage',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#71717a',
                        fontSize: 10,
                      }}
                    />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((v: any, name: any) => [v, name]) as any}
                      labelFormatter={() => ''}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      content={({ payload }: any) => {
                        if (!payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="bg-zinc-900 border border-zinc-700 rounded p-2 text-xs">
                            <div className="text-white font-medium">{d.token}</div>
                            <div className="text-zinc-400">
                              {d.durationHours}h | {d.leverage}x |{' '}
                              <span
                                style={{
                                  color:
                                    d.result === 'TAKE_PROFIT'
                                      ? CHART_COLORS.green
                                      : CHART_COLORS.red,
                                }}
                              >
                                {d.result === 'TAKE_PROFIT' ? 'TP' : 'SL'}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Scatter
                      name="Take Profit"
                      data={timeAnalytics.scatterData.filter(
                        (d) => d.result === 'TAKE_PROFIT'
                      )}
                      fill={CHART_COLORS.green}
                      opacity={0.7}
                    />
                    <Scatter
                      name="Stop Loss"
                      data={timeAnalytics.scatterData.filter(
                        (d) => d.result === 'STOP_LOSS'
                      )}
                      fill={CHART_COLORS.red}
                      opacity={0.7}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Each dot is a resolved call. Green = TP, Red = SL. X = hours to resolve, Y =
                  leverage. Cluster patterns reveal time-leverage dynamics.
                </p>
              </div>
            </div>
          )}

          {/* TP vs SL Speed Comparison */}
          {timeAnalytics && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">
                TP vs SL Resolution Speed
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Avg TP Time</div>
                  <div className="text-lg font-bold text-green-400">
                    {formatDuration(timeAnalytics.avgTP)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Avg SL Time</div>
                  <div className="text-lg font-bold text-red-400">
                    {formatDuration(timeAnalytics.avgSL)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Median TP</div>
                  <div className="text-lg font-bold text-green-400">
                    {formatDuration(timeAnalytics.medianTP)}
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Median SL</div>
                  <div className="text-lg font-bold text-red-400">
                    {formatDuration(timeAnalytics.medianSL)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {timeAnalytics.medianTP !== null &&
                timeAnalytics.medianSL !== null &&
                timeAnalytics.medianSL < timeAnalytics.medianTP
                  ? 'SL resolves faster than TP on average — this is normal in crypto. Adverse moves are sharper than favorable ones. If the gap is extreme (>3x), consider widening SL or tightening TP.'
                  : timeAnalytics.medianTP !== null &&
                    timeAnalytics.medianSL !== null &&
                    timeAnalytics.medianTP < timeAnalytics.medianSL
                  ? 'TP resolves faster than SL — strong edge. Signals are entering with momentum, and winners run fast while losers take time to fail. This is the ideal pattern.'
                  : 'Similar resolution speed for TP and SL. Market is ranging — neither side has a decisive time advantage.'}
              </p>
            </div>
          )}

          {/* Call Duration Categories */}
          {timeAnalytics && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">
                  Call Duration Categories (TP vs SL)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeAnalytics.durationCategories}>
                    <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Bar dataKey="tp" name="Take Profit" stackId="a" fill={CHART_COLORS.green} />
                    <Bar
                      dataKey="sl"
                      name="Stop Loss"
                      stackId="a"
                      fill={CHART_COLORS.red}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-zinc-600 mt-2">
                  Short = resolves within 6h | Medium = 6h to 2 days | Long = 2 to 7 days
                </p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">
                  Hit Rate by Call Duration
                </h3>
                <div className="space-y-4 mt-2">
                  {timeAnalytics.durationCategories.map((cat) => (
                    <div key={cat.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-300 font-medium">{cat.label}</span>
                        <span className="text-zinc-400">
                          {cat.count} calls ({cat.tp} TP / {cat.sl} SL)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-5 relative overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${cat.hitRate}%`,
                            backgroundColor: cat.hitRate >= 60 ? CHART_COLORS.green : cat.hitRate >= 45 ? CHART_COLORS.orange : CHART_COLORS.red,
                          }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                          {cat.hitRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-4">
                  {(() => {
                    const cats = timeAnalytics.durationCategories;
                    const best = cats.reduce((a, b) => (b.hitRate > a.hitRate && b.count >= 3 ? b : a), cats[0]);
                    return `Best performing: ${best.label} at ${best.hitRate.toFixed(1)}% hit rate (${best.count} calls).`;
                  })()}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">
              Validation Results ({results.length})
            </h3>
            <button
              onClick={() => {
                const csv = [
                  'id,market,real_result,time_to_close_min,resolved_at_IST,entered_at_IST,detail,candles_processed',
                  ...results.map(
                    (r) =>
                      `${r.id},${r.market},${r.result},${r.durationFromSignalMin ?? ''},${r.resolvedAtIST ?? ''},${r.enteredAtIST ?? ''},"${r.detail}",${r.candlesProcessed}`
                  ),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `validation_results_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              Export Results
            </button>
          </div>
          <DataTable
            data={results as unknown as Record<string, unknown>[]}
            columns={columns}
          />
        </div>
      )}
    </div>
  );
}
