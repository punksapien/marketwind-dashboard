'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
  ScatterChart, Scatter, ZAxis, LineChart, Line,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { runConfidenceBacktest, ConfidenceBacktest } from '@/lib/confidence';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS } from '@/lib/constants';

const BAND_COLORS: Record<string, string> = {
  High: CHART_COLORS.green,
  Medium: CHART_COLORS.orange,
  Standard: CHART_COLORS.red,
};

export function ConfidenceTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const bt: ConfidenceBacktest = useMemo(() => runConfidenceBacktest(calls), [calls]);

  const bandChartData = bt.bandStats.map((b) => ({
    band: b.band,
    systemHR: Number(b.systemHitRate.toFixed(1)),
    ...(hasReal ? { realHR: Number(b.realHitRate.toFixed(1)) } : {}),
    calls: b.totalCalls,
    expectedR: Number(b.expectedR.toFixed(3)),
  }));

  const calibrationData = bt.calibration
    .filter((c) => c.count > 0)
    .map((c) => ({
      predicted: c.predicted,
      actual: Number(c.actual.toFixed(1)),
      count: c.count,
    }));

  const featureData = bt.featureImportance
    .sort((a, b) => Math.abs(b.separation) - Math.abs(a.separation))
    .map((f) => ({
      name: f.label,
      correlation: Number((f.correlation * 100).toFixed(1)),
      separation: Number(f.separation.toFixed(1)),
    }));

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { min: 0, max: 20, label: '0-20' },
      { min: 20, max: 40, label: '20-40' },
      { min: 40, max: 60, label: '40-60' },
      { min: 60, max: 80, label: '60-80' },
      { min: 80, max: 100, label: '80-100' },
    ];
    return buckets.map((b) => {
      const inBucket = bt.scoredCalls.filter(
        (c) =>
          c.confidenceScore >= b.min &&
          c.confidenceScore < b.max &&
          c.status === 'APPROVED' &&
          c.moderated_status !== 'ACTIVE' &&
          c.moderated_status !== 'CANCELLED'
      );
      const hits = inBucket.filter((c) => c.is_system_hit).length;
      return {
        label: b.label,
        count: inBucket.length,
        hitRate: inBucket.length > 0 ? Number(((hits / inBucket.length) * 100).toFixed(1)) : 0,
      };
    });
  }, [bt.scoredCalls]);

  const bandColumns = [
    {
      key: 'band',
      label: 'Band',
      render: (row: Record<string, unknown>) => (
        <span
          className="px-2 py-0.5 text-xs font-bold rounded"
          style={{
            backgroundColor: `${BAND_COLORS[String(row.band)] || '#666'}22`,
            color: BAND_COLORS[String(row.band)] || '#999',
          }}
        >
          {String(row.band)}
        </span>
      ),
    },
    { key: 'totalCalls', label: 'Calls', align: 'right' as const },
    {
      key: 'systemHitRate',
      label: 'System HR%',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = Number(row.systemHitRate);
        return (
          <span style={{ color: v >= 50 ? CHART_COLORS.green : CHART_COLORS.red }}>
            {v.toFixed(1)}%
          </span>
        );
      },
    },
    ...(hasReal
      ? [
          {
            key: 'realHitRate',
            label: 'Real HR%',
            align: 'right' as const,
            render: (row: Record<string, unknown>) => {
              const v = Number(row.realHitRate);
              return (
                <span style={{ color: v >= 50 ? CHART_COLORS.green : CHART_COLORS.red }}>
                  {v.toFixed(1)}%
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: 'expectedR',
      label: 'Expected R',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = Number(row.expectedR);
        return (
          <span style={{ color: v >= 0 ? CHART_COLORS.green : CHART_COLORS.red }}>
            {v.toFixed(3)}R
          </span>
        );
      },
    },
  ];

  // Scored calls table (last 20)
  const recentScored = bt.scoredCalls
    .filter(
      (c) =>
        c.status === 'APPROVED' &&
        c.moderated_status !== 'ACTIVE' &&
        c.moderated_status !== 'CANCELLED'
    )
    .slice(-20)
    .reverse();

  const callColumns = [
    { key: 'id', label: 'ID' },
    { key: 'token', label: 'Token' },
    { key: 'email', label: 'Advisor',
      render: (row: Record<string, unknown>) => {
        const e = String(row.email);
        return <span className="text-xs">{e.split('@')[0]}</span>;
      },
    },
    {
      key: 'confidenceScore',
      label: 'Score',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = Number(row.confidenceScore);
        return <span className="font-mono font-bold">{v}</span>;
      },
    },
    {
      key: 'confidenceBand',
      label: 'Band',
      render: (row: Record<string, unknown>) => (
        <span
          className="px-2 py-0.5 text-xs font-bold rounded"
          style={{
            backgroundColor: `${BAND_COLORS[String(row.confidenceBand)] || '#666'}22`,
            color: BAND_COLORS[String(row.confidenceBand)] || '#999',
          }}
        >
          {String(row.confidenceBand)}
        </span>
      ),
    },
    {
      key: 'is_system_hit',
      label: 'Outcome',
      render: (row: Record<string, unknown>) => (
        <span style={{ color: row.is_system_hit ? CHART_COLORS.green : CHART_COLORS.red }}>
          {row.is_system_hit ? 'TP' : 'SL'}
        </span>
      ),
    },
    {
      key: 'rr_ratio',
      label: 'RR',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => Number(row.rr_ratio).toFixed(2),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header explanation */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-white mb-2">
          Confidence Score Backtest (v0 — Rule-Based)
        </h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Walk-forward backtest: each call is scored using <strong>only data from prior calls</strong>.
          The score estimates P(TP hits before SL) based on 6 features: advisor track record,
          RR quality, leverage band, token/category performance, direction alignment, and SL calibration.
          Bands map to expected R per trade at your 1:1.5 R:R structure.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="High Band HR"
          value={`${bt.overallStats.highHR.toFixed(1)}%`}
          subtitle="~0.75R expected"
          color={CHART_COLORS.green}
        />
        <KPICard
          label="Medium Band HR"
          value={`${bt.overallStats.mediumHR.toFixed(1)}%`}
          subtitle="~0.50R expected"
          color={CHART_COLORS.orange}
        />
        <KPICard
          label="Standard Band HR"
          value={`${bt.overallStats.standardHR.toFixed(1)}%`}
          subtitle="~0.25R expected"
          color={CHART_COLORS.red}
        />
        <KPICard
          label="Band Separation"
          value={`${bt.overallStats.separation.toFixed(1)}pp`}
          subtitle="High - Standard gap"
          color={bt.overallStats.separation > 10 ? CHART_COLORS.green : CHART_COLORS.orange}
        />
        <KPICard label="Total Scored" value={bt.overallStats.totalScored} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Band Performance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Hit Rate by Band</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bandChartData}>
              <XAxis dataKey="band" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend />
              <Bar dataKey="systemHR" name="System HR%" radius={[4, 4, 0, 0]}>
                {bandChartData.map((entry, i) => (
                  <Cell key={i} fill={BAND_COLORS[entry.band] || '#666'} />
                ))}
              </Bar>
              {hasReal && (
                <Bar dataKey="realHR" name="Real HR%" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Calibration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Calibration (Predicted vs Actual)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={calibrationData}>
              <XAxis
                dataKey="predicted"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                label={{ value: 'Predicted Score', position: 'bottom', fill: '#71717a', fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                domain={[0, 100]}
                label={{ value: 'Actual HR%', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) =>
                  name === 'actual' ? [`${value}%`, 'Actual HR'] : [value, name]
                ) as any}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={CHART_COLORS.green}
                strokeWidth={2}
                dot={{ r: 5 }}
              />
              {/* Perfect calibration line */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#555"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-zinc-600 mt-2">
            Dashed line = perfect calibration. Closer is better.
          </p>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Feature Importance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Feature Importance (Hit Rate Separation)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={featureData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                width={120}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any) => [`${value}pp`, 'HR Separation (top vs bottom third)']) as any}
              />
              <Bar dataKey="separation" radius={[0, 4, 4, 0]}>
                {featureData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.separation > 0 ? CHART_COLORS.green : CHART_COLORS.red}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-zinc-600 mt-2">
            Positive separation = high feature values correlate with more hits.
          </p>
        </div>

        {/* Score Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={scoreDistribution}>
              <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Call Count"
                fill={CHART_COLORS.blue}
                opacity={0.4}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="hitRate"
                name="Hit Rate %"
                fill={CHART_COLORS.green}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Band Stats Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Detailed Band Statistics
        </h3>
        <DataTable
          data={bt.bandStats as unknown as Record<string, unknown>[]}
          columns={bandColumns}
        />
      </div>

      {/* How the score is calculated */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Score Breakdown (v0 Rules)
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Advisor Track Record (0-35pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>70%+ HR → 35pts</div>
              <div>60-70% HR → 25pts</div>
              <div>50-60% HR → 15pts</div>
              <div>40-50% HR → 5pts</div>
              <div>&lt;3 calls → 12pts (cold start)</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">RR Quality (0-20pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>RR 1.0-1.2 → 20pts (tight, high prob)</div>
              <div>RR 1.2-1.5 → 15pts</div>
              <div>RR 1.5-1.8 → 10pts</div>
              <div>RR &gt;1.8 → 5pts (ambitious)</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Leverage Band (0-15pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>Low (2-7x) → 15pts</div>
              <div>Mid (8-14x) → 10pts</div>
              <div>High (15x+) → 3pts</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Token/Category HR (0-15pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>Token 65%+ HR → 15pts</div>
              <div>Token 55-65% → 10pts</div>
              <div>Token 45-55% → 5pts</div>
              <div>Falls back to category if &lt;3 calls</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">Direction Alignment (0-10pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>Direction 60%+ HR → 10pts</div>
              <div>Direction 50-60% → 6pts</div>
              <div>Below 50% → 2pts</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">SL Calibration (0-5pts)</div>
            <div className="space-y-1 text-zinc-400">
              <div>Within 1% of 20% → 5pts</div>
              <div>Within 2% → 3pts</div>
              <div>Outside → 1pt</div>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg text-xs text-zinc-500">
          <strong className="text-zinc-300">Bands:</strong> High (70-100) → ~0.75R | Medium
          (50-69) → ~0.50R | Standard (0-49) → ~0.25R.{' '}
          <strong className="text-zinc-300">Key insight:</strong> Band separation of{' '}
          {bt.overallStats.separation.toFixed(1)}pp means the score{' '}
          {bt.overallStats.separation > 10
            ? 'is doing real work — the bands predict meaningfully different outcomes.'
            : bt.overallStats.separation > 5
            ? 'shows some signal but needs more data or better features to be actionable.'
            : 'is not separating well — likely insufficient data or the features need rethinking.'}
        </div>
      </div>

      {/* Recent scored calls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Recent Scored Calls (last 20 terminated)
        </h3>
        <DataTable
          data={recentScored as unknown as Record<string, unknown>[]}
          columns={callColumns}
        />
      </div>
    </div>
  );
}
