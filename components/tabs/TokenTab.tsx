'use client';

import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeTokenStats } from '@/lib/analytics';
import { DataTable } from '@/components/ui/DataTable';
import { CHART_COLORS, CATEGORY_COLORS } from '@/lib/constants';

export function TokenTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const stats = useMemo(() => computeTokenStats(calls), [calls]);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? stats : stats.filter((s) => s.category === filter);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const s of stats) {
      cats[s.category] = (cats[s.category] || 0) + s.totalCalls;
    }
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const topTokens = filtered.slice(0, 15);

  const columns = [
    {
      key: 'token',
      label: 'Token',
      render: (row: Record<string, unknown>) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{String(row.token)}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${CATEGORY_COLORS[String(row.category)] || '#666'}22`,
              color: CATEGORY_COLORS[String(row.category)] || '#999',
            }}
          >
            {String(row.category)}
          </span>
        </div>
      ),
    },
    { key: 'totalCalls', label: 'Total', align: 'right' as const },
    { key: 'approvedCalls', label: 'Approved', align: 'right' as const },
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
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={((props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`) as any}
              >
                {categoryData.map((entry, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#666'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Top Tokens by Volume</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topTokens.slice(0, 10)} layout="vertical">
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis type="category" dataKey="token" tick={{ fill: '#a1a1aa', fontSize: 11 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              />
              <Bar dataKey="totalCalls" name="Calls" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-400">Token Performance</h3>
          <div className="flex gap-1">
            {['all', 'Bluechip', 'Meme', 'Altcoin', 'Commodity'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === cat
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
        <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns} />
      </div>
    </div>
  );
}
