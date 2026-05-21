'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { runConfidenceBacktest, ConfidenceBacktest } from '@/lib/confidence';
import { KPICard } from '@/components/ui/KPICard';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS } from '@/lib/constants';

const TIER_COLORS: Record<string, string> = {
  'Top Pick': CHART_COLORS.green,
  'Standard Pick': CHART_COLORS.blue,
  'Aggressive Pick': CHART_COLORS.orange,
};

const TIER_LABELS: Record<string, string> = {
  'Top Pick': 'High Conviction',
  'Standard Pick': 'Standard',
  'Aggressive Pick': 'Moderate',
};

function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] || '#666';
  return (
    <span
      className="px-2 py-0.5 text-xs font-bold rounded"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {TIER_LABELS[tier] || tier}
    </span>
  );
}

export function ConfidenceTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const [scope, setScope] = useState<'all' | 'last100'>('all');

  const bt: ConfidenceBacktest = useMemo(
    () => runConfidenceBacktest(calls, scope),
    [calls, scope]
  );

  const tierChartData = bt.tierStats.map((t) => ({
    tier: TIER_LABELS[t.tier] || t.tier,
    rawTier: t.tier,
    systemHR: Number(t.systemHitRate.toFixed(1)),
    ...(hasReal ? { realHR: Number(t.realHitRate.toFixed(1)) } : {}),
    calls: t.totalCalls,
  }));

  const inputChartData = bt.inputBreakdown.map((ib) => ({
    label: ib.label,
    separation: Number(ib.separation.toFixed(1)),
  }));

  // Distribution of tiers
  const distData = bt.tierStats.map((t) => ({
    name: TIER_LABELS[t.tier] || t.tier,
    rawTier: t.tier,
    value: t.totalCalls,
  }));

  // Tier stats table columns
  const tierColumns = [
    {
      key: 'tier',
      label: 'Classification',
      render: (row: Record<string, unknown>) => <TierBadge tier={String(row.tier)} />,
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
      ? [{
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
        }]
      : []),
    {
      key: 'avgROI',
      label: 'Avg ROI',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => {
        const v = Number(row.avgROI);
        return (
          <span style={{ color: v >= 0 ? CHART_COLORS.green : CHART_COLORS.red }}>
            {(v * 100).toFixed(2)}%
          </span>
        );
      },
    },
  ];

  // Recent scored calls table
  const recentScored = bt.scoredCalls
    .filter(
      (c) =>
        c.status === 'APPROVED' &&
        c.moderated_status !== 'ACTIVE' &&
        c.moderated_status !== 'CANCELLED'
    )
    .slice(-25)
    .reverse();

  const callColumns = [
    { key: 'id', label: 'ID' },
    { key: 'token', label: 'Token' },
    {
      key: 'email',
      label: 'Advisor',
      render: (row: Record<string, unknown>) => (
        <span className="text-xs">{String(row.email).split('@')[0]}</span>
      ),
    },
    {
      key: 'weightedScore',
      label: 'Score',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => (
        <span className="font-mono font-bold">{Number(row.weightedScore).toFixed(2)}</span>
      ),
    },
    {
      key: 'classification',
      label: 'Tier',
      render: (row: Record<string, unknown>) => <TierBadge tier={String(row.classification)} />,
    },
    {
      key: 'inputs',
      label: 'MW / Adv / Tok',
      render: (row: Record<string, unknown>) => {
        const inp = row.inputs as { mwScore: number; advisorHRScore: number; tokenHRScore: number };
        return (
          <span className="text-xs font-mono text-zinc-400">
            {inp.mwScore} / {inp.advisorHRScore} / {inp.tokenHRScore}
          </span>
        );
      },
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
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white mb-2">
              Expert Picks Confidence Score Framework
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Walk-forward backtest of the 3-input weighted scoring system.
              Each call is classified using only prior data. MW Confidence (40%) + Advisor 14D HR
              (35%) + Token HR (25%) → weighted score 1.0–3.0 → Top Pick / Standard / Aggressive.
            </p>
          </div>
          <div className="flex gap-1">
            {(['all', 'last100'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  scope === s
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                {s === 'all' ? 'All Calls' : 'Last 100'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Top Pick HR"
          value={`${bt.overallStats.topPickHR.toFixed(1)}%`}
          subtitle="High Conviction"
          color={CHART_COLORS.green}
        />
        <KPICard
          label="Standard Pick HR"
          value={`${bt.overallStats.standardHR.toFixed(1)}%`}
          subtitle="Standard"
          color={CHART_COLORS.blue}
        />
        <KPICard
          label="Aggressive Pick HR"
          value={`${bt.overallStats.aggressiveHR.toFixed(1)}%`}
          subtitle="Moderate"
          color={CHART_COLORS.orange}
        />
        <KPICard
          label="Tier Separation"
          value={`${bt.overallStats.separation.toFixed(1)}pp`}
          subtitle="Top - Aggressive gap"
          color={bt.overallStats.separation > 10 ? CHART_COLORS.green : CHART_COLORS.orange}
        />
        <KPICard label="Total Scored" value={bt.overallStats.totalScored} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Hit Rate by Tier */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Hit Rate by Classification</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tierChartData}>
              <XAxis dataKey="tier" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Legend />
              <Bar dataKey="systemHR" name="System HR%" radius={[4, 4, 0, 0]}>
                {tierChartData.map((entry, i) => (
                  <Cell key={i} fill={TIER_COLORS[entry.rawTier] || '#666'} />
                ))}
              </Bar>
              {hasReal && (
                <Bar dataKey="realHR" name="Real HR%" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution + Input Separation */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Tier Distribution & Input Effectiveness
          </h3>
          {/* Tier distribution bars */}
          <div className="space-y-3 mb-5">
            {distData.map((d) => {
              const total = bt.overallStats.totalScored || 1;
              const pct = (d.value / total) * 100;
              return (
                <div key={d.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">{d.name}</span>
                    <span className="text-zinc-400">{d.value} calls ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: TIER_COLORS[d.rawTier] || '#666',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input separation */}
          <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
            Input Signal Strength (HR spread: score 3 vs score 1)
          </h4>
          {inputChartData.map((ib) => (
            <div key={ib.label} className="flex items-center gap-3 mb-2">
              <span className="text-xs text-zinc-400 w-28">{ib.label}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden relative">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(Math.abs(ib.separation), 50) * 2}%`,
                    backgroundColor: ib.separation > 0 ? CHART_COLORS.green : CHART_COLORS.red,
                  }}
                />
              </div>
              <span
                className="text-xs font-mono w-14 text-right"
                style={{ color: ib.separation > 0 ? CHART_COLORS.green : CHART_COLORS.red }}
              >
                {ib.separation > 0 ? '+' : ''}{ib.separation}pp
              </span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-600 mt-2">
            Positive = score 3 calls outperform score 1 calls. Higher = stronger signal.
          </p>
        </div>
      </div>

      {/* Detailed Tier Stats Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Tier Performance ({scope === 'all' ? 'All Calls' : 'Last 100 Calls'})
        </h3>
        <DataTable
          data={bt.tierStats as unknown as Record<string, unknown>[]}
          columns={tierColumns}
        />
      </div>

      {/* Scoring Rules Reference */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Scoring Framework</h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">
              MW Confidence{' '}
              <span className="text-zinc-500 font-normal">(40% weight)</span>
            </div>
            <div className="space-y-1 text-zinc-400">
              <div>High → 3</div>
              <div>Medium → 2</div>
              <div>Low → 1</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">
              Advisor 14D HR{' '}
              <span className="text-zinc-500 font-normal">(35% weight)</span>
            </div>
            <div className="space-y-1 text-zinc-400">
              <div>65%+ → 3</div>
              <div>55–64% → 2</div>
              <div>&lt;55% → 1</div>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="font-medium text-white mb-2">
              Token HR{' '}
              <span className="text-zinc-500 font-normal">(25% weight, min 10 calls)</span>
            </div>
            <div className="space-y-1 text-zinc-400">
              <div>65%+ → 3</div>
              <div>55–65% → 2</div>
              <div>&lt;55% → 1</div>
              <div>&lt;10 calls → default 2</div>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg text-xs text-zinc-500">
          <strong className="text-zinc-300">Formula:</strong>{' '}
          <code className="text-zinc-400">0.4 × MW + 0.35 × Advisor + 0.25 × Token</code>{' '}
          → Range 1.0–3.0.{' '}
          <strong className="text-zinc-300">Tiers:</strong>{' '}
          ≥2.5 = <span style={{ color: CHART_COLORS.green }}>Top Pick</span> |{' '}
          1.8–2.49 = <span style={{ color: CHART_COLORS.blue }}>Standard</span> |{' '}
          &lt;1.8 = <span style={{ color: CHART_COLORS.orange }}>Aggressive</span>
        </div>
        {!bt.scoredCalls.some((c) => {
          const raw = ((c as unknown as Record<string, unknown>)['mw_confidence'] as string || '');
          return raw !== '';
        }) && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            MW Confidence column not found in CSV — defaulting all calls to Medium (score 2).
            Add a <code>mw_confidence</code> column (High/Medium/Low) to enable full scoring.
          </div>
        )}
      </div>

      {/* Example Calculation */}
      {recentScored.length > 0 && (() => {
        const ex = recentScored[0];
        const calc = (0.4 * ex.inputs.mwScore + 0.35 * ex.inputs.advisorHRScore + 0.25 * ex.inputs.tokenHRScore);
        return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Example Calculation (Most Recent)</h3>
            <div className="grid md:grid-cols-4 gap-3 text-xs">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-500">Call</div>
                <div className="text-white font-medium">{ex.token} by {ex.email.split('@')[0]}</div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-500">Inputs (MW / Adv / Tok)</div>
                <div className="text-white font-mono">
                  {ex.inputs.mwScore} / {ex.inputs.advisorHRScore} / {ex.inputs.tokenHRScore}
                </div>
                <div className="text-zinc-600 text-[10px] mt-1">
                  MW={ex.inputs.mwConfidence}, 14D HR={ex.inputs.advisor14dHR}% ({ex.inputs.advisor14dCallCount} calls),
                  Token={ex.inputs.tokenHR}% ({ex.inputs.tokenCallCount} calls)
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-500">Calculation</div>
                <div className="text-white font-mono text-[11px]">
                  0.4×{ex.inputs.mwScore} + 0.35×{ex.inputs.advisorHRScore} + 0.25×{ex.inputs.tokenHRScore} = {calc.toFixed(2)}
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-zinc-500">Result</div>
                <div className="flex items-center gap-2">
                  <TierBadge tier={ex.classification} />
                  <span className="text-zinc-400">→</span>
                  <span style={{ color: ex.is_system_hit ? CHART_COLORS.green : CHART_COLORS.red }}>
                    {ex.is_system_hit ? 'TP' : 'SL'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recent Scored Calls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Recent Scored Calls (last 25 terminated)
        </h3>
        <DataTable
          data={recentScored as unknown as Record<string, unknown>[]}
          columns={callColumns}
        />
      </div>
    </div>
  );
}
