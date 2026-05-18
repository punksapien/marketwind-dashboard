'use client';

import { useMemo } from 'react';
import { TradeCall } from '@/lib/types';
import { computeHeatmap } from '@/lib/analytics';
import { advisorName } from '@/lib/utils';

function heatColor(value: number | null): string {
  if (value === null) return '#1c1c1e';
  if (value >= 75) return '#00E676';
  if (value >= 50) return '#66BB6A';
  if (value >= 25) return '#FFA726';
  return '#FF1744';
}

export function HeatmapTab({ calls }: { calls: TradeCall[] }) {
  const data = useMemo(() => computeHeatmap(calls), [calls]);

  if (data.advisors.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
        Not enough data for heatmap (need advisors with 3+ terminated approved calls)
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 overflow-x-auto">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Advisor x Date Hit Rate Heatmap (Approved + Terminated)
      </h3>
      <div className="flex gap-1 mb-2 ml-[140px]">
        {data.dates.map((d) => (
          <div
            key={d}
            className="text-[9px] text-zinc-500 w-10 text-center"
            style={{ writingMode: 'vertical-rl', height: '60px' }}
          >
            {d.slice(5)}
          </div>
        ))}
      </div>
      {data.advisors.map((adv, ai) => (
        <div key={adv} className="flex items-center gap-1 mb-1">
          <div className="w-[140px] text-xs text-zinc-400 truncate text-right pr-2">
            {advisorName(adv)}
          </div>
          {data.grid[ai].map((val, di) => (
            <div
              key={di}
              className="w-10 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold transition-colors"
              style={{
                backgroundColor: heatColor(val),
                color: val === null ? '#333' : '#000',
              }}
              title={`${advisorName(adv)} on ${data.dates[di]}: ${val === null ? 'No data' : `${val.toFixed(0)}%`}`}
            >
              {val !== null ? `${val.toFixed(0)}` : ''}
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-4 mt-4 ml-[140px] text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#FF1744' }} />
          0-25%
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#FFA726' }} />
          25-50%
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#66BB6A' }} />
          50-75%
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#00E676' }} />
          75-100%
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: '#1c1c1e' }} />
          No data
        </div>
      </div>
    </div>
  );
}
