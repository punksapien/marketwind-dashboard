import Papa from 'papaparse';
import { TradeCall } from './types';
import { categorizeToken } from './constants';

function num(v: unknown): number {
  if (v === null || v === undefined || v === '' || v === 'N.A') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function parseCSV(csvText: string): TradeCall[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const calls: TradeCall[] = [];

  let rowIndex = 0;
  for (const row of result.data as Record<string, unknown>[]) {
    const entry_from = num(row['entry_from']);
    const entry_to = num(row['entry_to']);
    const take_profit = num(row['take_profit']);
    const stop_loss = num(row['stop_loss']);
    const entry_mid = (entry_from + entry_to) / 2;

    // Derive side
    let side: 'long' | 'short' = 'long';
    if (row['side']) {
      side = str(row['side']).toLowerCase() === 'short' ? 'short' : 'long';
    } else {
      side = take_profit < entry_mid ? 'short' : 'long';
    }

    // RR ratio
    const risk = Math.abs(entry_mid - stop_loss);
    const reward = Math.abs(entry_mid - take_profit);
    const rr_ratio = risk > 0 ? reward / risk : 0;

    // SL distance %
    const sl_pct = entry_mid > 0 ? (Math.abs(entry_mid - stop_loss) / entry_mid) * 100 : 0;

    // Token extraction
    const market = str(row['market']);
    const token = market
      .replace(/^B-/i, '')
      .replace(/_USDT$/i, '')
      .replace(/USDT$/i, '')
      .toUpperCase();

    const terminal_reason = str(row['terminal_reason']).toUpperCase();
    const real_result = str(row['real_result']).toUpperCase();
    const moderated_status = str(row['moderated_status']).toUpperCase();
    const status = str(row['status']).toUpperCase();

    // System hit: terminal_reason contains TAKE_PROFIT
    const is_system_hit = /TAKE.?PROFIT|TARGET|TP/i.test(terminal_reason);

    // Real hit: from validated column
    const is_real_hit = real_result
      ? /TAKE.?PROFIT/i.test(real_result)
      : is_system_hit;

    const rawId = str(row['id']);
    calls.push({
      _uid: `${rawId}_${rowIndex++}`,
      id: rawId,
      created_date: str(row['created_date']),
      entry_time: str(row['entry_time']),
      validity_date: str(row['validity_date']),
      email: str(row['email']).toLowerCase(),
      market,
      seller_pick_id: str(row['seller_pick_id']),
      entry_from,
      entry_to,
      leverage: num(row['leverage']),
      take_profit,
      stop_loss,
      status,
      moderated_status,
      terminal_reason,
      cancel_reason: str(row['cancel_reason']),
      call_duration_validity: num(row['Call Duration (Validity)']),
      call_duration_terminal: num(row['Call Duration (Terminal State)']),
      roi: num(row['roi']),
      side,
      real_result,
      token,
      entry_mid,
      rr_ratio,
      is_system_hit,
      is_real_hit,
      sl_pct,
      category: categorizeToken(token),
    });
  }

  return calls;
}

export function hasRealResults(calls: TradeCall[]): boolean {
  return calls.some((c) => c.real_result !== '');
}
