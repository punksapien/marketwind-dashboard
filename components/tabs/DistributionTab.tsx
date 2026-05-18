'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TradeCall } from '@/lib/types';
import { computeMonthlyDistribution } from '@/lib/analytics';
import { CATEGORY_COLORS } from '@/lib/constants';

export function DistributionTab({ calls }: { calls: TradeCall[] }) {
  const data = useMemo(() => computeMonthlyDistribution(calls), [calls]);

  if (data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
        Not enough data for monthly distribution
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">
          Monthly Token Category Distribution (Approved Calls)
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <XAxis dataKey="month" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Legend />
            <Bar dataKey="Bluechip" stackId="a" fill={CATEGORY_COLORS.Bluechip} />
            <Bar dataKey="Meme" stackId="a" fill={CATEGORY_COLORS.Meme} />
            <Bar dataKey="Altcoin" stackId="a" fill={CATEGORY_COLORS.Altcoin} />
            <Bar dataKey="Commodity" stackId="a" fill={CATEGORY_COLORS.Commodity} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Raw Data</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 text-left text-zinc-400">Month</th>
                <th className="px-3 py-2 text-right text-zinc-400">Bluechip</th>
                <th className="px-3 py-2 text-right text-zinc-400">Meme</th>
                <th className="px-3 py-2 text-right text-zinc-400">Altcoin</th>
                <th className="px-3 py-2 text-right text-zinc-400">Commodity</th>
                <th className="px-3 py-2 text-right text-zinc-400 font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const total =
                  Number(row.Bluechip) +
                  Number(row.Meme) +
                  Number(row.Altcoin) +
                  Number(row.Commodity);
                return (
                  <tr key={String(row.month)} className="border-b border-zinc-800/50">
                    <td className="px-3 py-2 text-white">{String(row.month)}</td>
                    <td className="px-3 py-2 text-right">{String(row.Bluechip)}</td>
                    <td className="px-3 py-2 text-right">{String(row.Meme)}</td>
                    <td className="px-3 py-2 text-right">{String(row.Altcoin)}</td>
                    <td className="px-3 py-2 text-right">{String(row.Commodity)}</td>
                    <td className="px-3 py-2 text-right font-bold text-white">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
