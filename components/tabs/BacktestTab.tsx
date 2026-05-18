'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeBacktest } from '@/lib/analytics';
import { KPICard } from '@/components/ui/KPICard';
import { CHART_COLORS } from '@/lib/constants';

export function BacktestTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const bt = useMemo(() => computeBacktest(calls), [calls]);

  const comparisonData = [
    {
      name: 'Legacy',
      systemHR: Number(bt.old.systemHitRate.toFixed(1)),
      ...(hasReal ? { realHR: Number(bt.old.realHitRate.toFixed(1)) } : {}),
      volume: bt.old.volume,
    },
    {
      name: 'New Framework',
      systemHR: Number(bt.new.systemHitRate.toFixed(1)),
      ...(hasReal ? { realHR: Number(bt.new.realHitRate.toFixed(1)) } : {}),
      volume: bt.new.volume,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">Legacy Framework</h3>
          <p className="text-xs text-zinc-500">{bt.old.rules}</p>
          <div className="grid grid-cols-2 gap-3">
            <KPICard label="Volume" value={bt.old.volume} />
            <KPICard
              label="System HR%"
              value={`${bt.old.systemHitRate.toFixed(1)}%`}
              color={bt.old.systemHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
            />
            {hasReal && (
              <KPICard
                label="Real HR%"
                value={`${bt.old.realHitRate.toFixed(1)}%`}
                color={bt.old.realHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
              />
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-zinc-400">New Framework</h3>
          <p className="text-xs text-zinc-500">{bt.new.rules}</p>
          <div className="grid grid-cols-2 gap-3">
            <KPICard label="Volume" value={bt.new.volume} />
            <KPICard
              label="System HR%"
              value={`${bt.new.systemHitRate.toFixed(1)}%`}
              color={bt.new.systemHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
            />
            {hasReal && (
              <KPICard
                label="Real HR%"
                value={`${bt.new.realHitRate.toFixed(1)}%`}
                color={bt.new.realHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Side-by-Side Comparison</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData}>
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Legend />
            <Bar dataKey="systemHR" name="System HR%" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            {hasReal && (
              <Bar dataKey="realHR" name="Real HR%" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {bt.fakeRRCount > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
          <h3 className="text-sm font-medium text-red-400 mb-2">
            &quot;Fake RR&quot; Calls Blocked
          </h3>
          <p className="text-xs text-zinc-400">
            The new framework blocked <strong className="text-white">{bt.fakeRRCount}</strong> calls
            that the legacy framework approved. These blocked calls had a real hit rate of{' '}
            <strong
              style={{
                color: bt.fakeRRHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red,
              }}
            >
              {bt.fakeRRHitRate.toFixed(1)}%
            </strong>
            , confirming they were poor quality trades disguised by inflated RR calculations.
          </p>
        </div>
      )}
    </div>
  );
}
