'use client';

export interface Tab {
  id: string;
  label: string;
}

interface TabNavProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function TabNav({ tabs, active, onChange }: TabNavProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 border-b border-zinc-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
            active === tab.id
              ? 'bg-zinc-800 text-white border-b-2 border-blue-500'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
