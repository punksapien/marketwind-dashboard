'use client';

interface KPICardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export function KPICard({ label, value, subtitle, color = '#2979FF' }: KPICardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-3xl font-bold" style={{ color }}>
        {value}
      </span>
      {subtitle && (
        <span className="text-xs text-zinc-500">{subtitle}</span>
      )}
    </div>
  );
}
