'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeOverview } from '@/lib/analytics';
import { KPICard } from '@/components/ui/KPICard';
import { CHART_COLORS } from '@/lib/constants';

export function OverviewTab({ calls, hasReal }: { calls: TradeCall[]; hasReal: boolean }) {
  const stats = useMemo(() => computeOverview(calls), [calls]);

  const statusData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({
    name,
    value,
  }));

  const terminalData = Object.entries(stats.terminalBreakdown)
    .filter(([k]) => k !== 'UNKNOWN' && k !== '')
    .map(([name, value]) => ({ name, value }));

  const PIE_COLORS = [CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.orange, CHART_COLORS.purple];
  const BAR_COLORS: Record<string, string> = {
    TAKE_PROFIT: CHART_COLORS.green,
    STOP_LOSS: CHART_COLORS.red,
    BOTH: CHART_COLORS.orange,
    EXPIRED: CHART_COLORS.yellow,
    SIDEWAYS: CHART_COLORS.purple,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Calls" value={stats.totalCalls} subtitle={`${stats.approvedCalls} approved / ${stats.rejectedCalls} rejected`} />
        <KPICard
          label="System Hit Rate"
          value={`${stats.systemHitRate.toFixed(1)}%`}
          subtitle={`${stats.systemHits} hits of ${stats.terminatedCalls} terminated`}
          color={stats.systemHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
        />
        {hasReal && (
          <KPICard
            label="Real Hit Rate"
            value={`${stats.realHitRate.toFixed(1)}%`}
            subtitle={`${stats.realHits} real hits`}
            color={stats.realHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
          />
        )}
        <KPICard
          label="Active Exposure"
          value={stats.activeCalls}
          subtitle="Calls still running"
          color={CHART_COLORS.orange}
        />
        <KPICard
          label="Approved Hit Rate (System)"
          value={`${stats.approvedSystemHitRate.toFixed(1)}%`}
          color={stats.approvedSystemHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
        />
        {hasReal && (
          <KPICard
            label="Approved Hit Rate (Real)"
            value={`${stats.approvedRealHitRate.toFixed(1)}%`}
            color={stats.approvedRealHitRate >= 50 ? CHART_COLORS.green : CHART_COLORS.red}
          />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={((props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`) as any}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Terminal Reasons</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={terminalData}>
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {terminalData.map((entry, i) => (
                  <Cell key={i} fill={BAR_COLORS[entry.name] || CHART_COLORS.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
