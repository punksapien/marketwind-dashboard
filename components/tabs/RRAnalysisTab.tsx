'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeRRBuckets } from '@/lib/analytics';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS } from '@/lib/constants';

export function RRAnalysisTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const buckets = useMemo(() => computeRRBuckets(calls), [calls]);

  const chartData = buckets.map((b) => ({
    label: b.label,
    systemHR: Number(b.systemHitRate.toFixed(1)),
    ...(hasReal ? { realHR: Number(b.realHitRate.toFixed(1)) } : {}),
    calls: b.totalCalls,
  }));

  const columns = [
    { key: 'label', label: 'RR Bucket' },
    { key: 'totalCalls', label: 'Calls', align: 'right' as const },
    { key: 'systemHits', label: 'Sys Hits', align: 'right' as const },
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
          { key: 'realHits', label: 'Real Hits', align: 'right' as const },
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

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Hit Rate by Risk-to-Reward Bucket (Approved + Terminated)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Detailed RR Breakdown</h3>
        <DataTable data={buckets as unknown as Record<string, unknown>[]} columns={columns} />
      </div>
    </div>
  );
}
