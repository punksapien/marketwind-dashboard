'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeAdvisorStats } from '@/lib/analytics';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS } from '@/lib/constants';

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    B: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    C: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${colors[tier] || colors.C}`}>
      Tier {tier}
    </span>
  );
}

export function AdvisorTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const stats = useMemo(() => computeAdvisorStats(calls), [calls]);

  const columns = [
    {
      key: 'displayName',
      label: 'Advisor',
      render: (row: Record<string, unknown>) => (
        <div>
          <div className="font-medium text-white">{String(row.displayName)}</div>
          <div className="text-xs text-zinc-500">{String(row.email)}</div>
        </div>
      ),
    },
    { key: 'totalCalls', label: 'Total', align: 'right' as const },
    { key: 'approvedCalls', label: 'Approved', align: 'right' as const },
    { key: 'terminatedCalls', label: 'Terminated', align: 'right' as const },
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
      key: 'avgRR',
      label: 'Avg RR',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => Number(row.avgRR).toFixed(2),
    },
    {
      key: 'score',
      label: 'Score',
      align: 'right' as const,
      render: (row: Record<string, unknown>) => Number(row.score).toFixed(1),
    },
    {
      key: 'tier',
      label: 'Tier',
      align: 'center' as const,
      render: (row: Record<string, unknown>) => <TierBadge tier={String(row.tier)} />,
    },
  ];

  const chartData = stats.slice(0, 10).map((s) => ({
    name: s.displayName.split(' ')[0],
    system: Number(s.systemHitRate.toFixed(1)),
    ...(hasReal ? { real: Number(s.realHitRate.toFixed(1)) } : {}),
  }));

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Top Advisors Hit Rate Comparison
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Legend />
            <Bar dataKey="system" name="System HR%" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            {hasReal && (
              <Bar dataKey="real" name="Real HR%" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Advisor Framework ({stats.filter((s) => s.tier === 'A').length} Tier A / {stats.length} total)
        </h3>
        <DataTable data={stats as unknown as Record<string, unknown>[]} columns={columns} />
      </div>
    </div>
  );
}
