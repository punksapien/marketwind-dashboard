'use client';

import { useState, useCallback, useMemo } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { TabNav, Tab } from '@/components/TabNav';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { AdvisorTab } from '@/components/tabs/AdvisorTab';
import { TokenTab } from '@/components/tabs/TokenTab';
import { TrendsTab } from '@/components/tabs/TrendsTab';
import { RRAnalysisTab } from '@/components/tabs/RRAnalysisTab';
import { HeatmapTab } from '@/components/tabs/HeatmapTab';
import { BacktestTab } from '@/components/tabs/BacktestTab';
import { DistributionTab } from '@/components/tabs/DistributionTab';
import { ValidateTab } from '@/components/tabs/ValidateTab';
import { ConfidenceTab } from '@/components/tabs/ConfidenceTab';
import { parseCSV, hasRealResults } from '@/lib/parse-csv';
import { exportFullReport } from '@/lib/export-excel';
import { TradeCall } from '@/lib/types';

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'advisors', label: 'Advisors' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'trends', label: 'Trends' },
  { id: 'rr', label: 'RR Analysis' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'distribution', label: 'Distribution' },
  { id: 'validate', label: 'Validate' },
  { id: 'confidence', label: 'Confidence Score' },
];

export default function Home() {
  const [calls, setCalls] = useState<TradeCall[]>([]);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  const hasReal = useMemo(() => hasRealResults(calls), [calls]);

  const handleValidationResults = useCallback(
    (results: Map<string, string>) => {
      // Merge validation results back into calls
      setCalls((prev) =>
        prev.map((c) => {
          const realResult = results.get(c._uid);
          if (!realResult) return c;
          return {
            ...c,
            real_result: realResult,
            is_real_hit: /TAKE.?PROFIT/i.test(realResult),
          };
        })
      );
    },
    []
  );

  const handleUpload = useCallback((csv: string, name: string) => {
    setLoading(true);
    setTimeout(() => {
      const parsed = parseCSV(csv);
      setCalls(parsed);
      setFileName(name);
      setLoading(false);
    }, 50);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (calls.length === 0) return;
    const headers = Object.keys(calls[0]);
    const rows = calls.map((c) =>
      headers.map((h) => {
        const val = (c as unknown as Record<string, unknown>)[h];
        const s = String(val ?? '');
        return s.includes(',') ? `"${s}"` : s;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketwind_enriched_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [calls]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Marketwind Analytics</h1>
            <p className="text-xs text-zinc-500">Trade call performance dashboard</p>
          </div>
          {calls.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                {calls.length} calls from <span className="text-zinc-300">{fileName}</span>
              </span>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportFullReport(calls, fileName)}
                className="px-3 py-1.5 text-xs bg-green-600/80 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                Download Excel Report
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {calls.length === 0 ? (
          <div className="max-w-xl mx-auto mt-20">
            <FileUpload onUpload={handleUpload} currentFile={fileName} />
            {loading && (
              <div className="mt-4 text-center text-sm text-zinc-500">Processing CSV...</div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <TabNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
              <button
                onClick={() => { setCalls([]); setFileName(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 ml-4 whitespace-nowrap"
              >
                Upload new file
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 text-zinc-500">Processing...</div>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'advisors' && <AdvisorTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'tokens' && <TokenTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'trends' && <TrendsTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'rr' && <RRAnalysisTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'heatmap' && <HeatmapTab calls={calls} />}
                {activeTab === 'backtest' && <BacktestTab calls={calls} hasReal={hasReal} />}
                {activeTab === 'distribution' && <DistributionTab calls={calls} />}
                {activeTab === 'validate' && (
                  <ValidateTab calls={calls} onResultsReady={handleValidationResults} />
                )}
                {activeTab === 'confidence' && (
                  <ConfidenceTab calls={calls} hasReal={hasReal} />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
