'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeDailyTrends, computeWeeklyTrends } from '@/lib/analytics';
import { CHART_COLORS } from '@/lib/constants';

export function TrendsTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [scope, setScope] = useState<'overall' | 'approved'>('approved');

  const daily = useMemo(() => computeDailyTrends(calls), [calls]);
  const weekly = useMemo(() => computeWeeklyTrends(calls), [calls]);

  const data = view === 'daily' ? daily : weekly;
  const dateKey = view === 'daily' ? 'date' : 'weekStart';

  const sysKey = scope === 'overall' ? 'systemHitRate' : 'approvedSystemHitRate';
  const realKey = scope === 'overall' ? 'realHitRate' : 'approvedRealHitRate';

  const chartData = data.map((d) => ({
    date: view === 'daily' ? (d as { date: string }).date.slice(5) : (d as { weekStart: string }).weekStart.slice(5),
    systemHR: Number(((d as unknown as Record<string, number>)[sysKey] || 0).toFixed(1)),
    ...(hasReal ? { realHR: Number(((d as unknown as Record<string, number>)[realKey] || 0).toFixed(1)) } : {}),
    calls: scope === 'overall' ? d.totalCalls : d.approvedCalls,
  }));

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <div className="flex gap-1">
          {(['daily', 'weekly'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-full ${
                view === v ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['overall', 'approved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1 text-xs rounded-full ${
                scope === s ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Hit Rate Trend ({view}, {scope})
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: '#a1a1aa', fontSize: 11 }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Legend />
            <Bar yAxisId="right" dataKey="calls" name="Call Volume" fill={CHART_COLORS.blue} opacity={0.15} radius={[2, 2, 0, 0]} />
            <Line yAxisId="left" type="monotone" dataKey="systemHR" name="System HR%" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
            {hasReal && (
              <Line yAxisId="left" type="monotone" dataKey="realHR" name="Real HR%" stroke={CHART_COLORS.green} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Call Volume Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
            />
            <Bar dataKey="calls" name="Calls" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
