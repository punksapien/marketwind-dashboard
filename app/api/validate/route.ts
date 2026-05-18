import { NextRequest, NextResponse } from 'next/server';

const CHUNK_SECONDS = 300 * 60; // 5 hours of 1-min candles per chunk
const API_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseISTTimestamp(dateVal: string, isExpiry: boolean): number | null {
  if (!dateVal) return null;
  try {
    // Parse date components manually to avoid local-timezone issues.
    // Input is always IST (Asia/Kolkata, UTC+5:30).
    // "2026-04-06 17:18:09" or "2026-04-06"
    const m = dateVal.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):?(\d{1,2})?)?/);
    if (!m) return null;

    let hour = parseInt(m[4] || '0');
    let min = parseInt(m[5] || '0');
    let sec = parseInt(m[6] || '0');

    if (isExpiry) {
      hour = 23; min = 59; sec = 59;
    }

    // Date.UTC is always UTC regardless of machine timezone.
    // We treat the parsed components as IST, so subtract 5h30m to get UTC.
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000
    const utcMs = Date.UTC(
      parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
      hour, min, sec
    ) - IST_OFFSET_MS;

    return Math.floor(utcMs / 1000);
  } catch {
    return null;
  }
}

interface ValidateRequest {
  market: string;
  entry_time: string;
  validity_date: string;
  entry_from: number;
  entry_to: number;
  take_profit: number;
  stop_loss: number;
  mode: 'immediate' | 'entry_check';
}

function makeResponse(fields: {
  result: string;
  detail: string;
  candlesProcessed: number;
  resolvedAtMs?: number | null;
  enteredAtMs?: number | null;
  startTsMs: number;
}) {
  const {
    result,
    detail,
    candlesProcessed,
    resolvedAtMs = null,
    enteredAtMs = null,
    startTsMs,
  } = fields;

  // Duration from signal start to resolution (minutes)
  const durationFromSignalMin =
    resolvedAtMs != null ? (resolvedAtMs - startTsMs) / 60000 : null;

  // Duration from entry to resolution (minutes)
  const durationFromEntryMin =
    resolvedAtMs != null && enteredAtMs != null
      ? (resolvedAtMs - enteredAtMs) / 60000
      : null;

  return NextResponse.json({
    result,
    detail,
    candlesProcessed,
    resolvedAtMs,
    enteredAtMs,
    signalTimeMs: startTsMs,
    durationFromSignalMin:
      durationFromSignalMin != null ? Math.round(durationFromSignalMin * 100) / 100 : null,
    durationFromEntryMin:
      durationFromEntryMin != null ? Math.round(durationFromEntryMin * 100) / 100 : null,
    resolvedAtIST: resolvedAtMs != null ? new Date(resolvedAtMs + 19800000).toISOString().replace('T', ' ').slice(0, 19) : null,
    enteredAtIST: enteredAtMs != null ? new Date(enteredAtMs + 19800000).toISOString().replace('T', ' ').slice(0, 19) : null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const {
      market,
      entry_time,
      validity_date,
      entry_from,
      entry_to,
      take_profit,
      stop_loss,
      mode = 'immediate',
    } = body;

    // Parse market pair
    let token = market.trim().toUpperCase();
    if (token.startsWith('B-')) token = token.slice(2);
    if (token.endsWith('_USDT')) token = token.slice(0, -5);
    else if (token.endsWith('USDT')) token = token.slice(0, -4);
    const apiToken = `B-${token}_USDT`;

    // Parse timestamps
    const startTs = parseISTTimestamp(entry_time, false);
    const expiryTs = parseISTTimestamp(validity_date, true);

    if (!startTs || !expiryTs) {
      return NextResponse.json({ result: 'DATE_ERROR', detail: 'Could not parse dates' });
    }

    const startTsMs = startTs * 1000;
    const nowTs = Math.floor(Date.now() / 1000);
    const endTs = Math.min(expiryTs, nowTs);

    // Trade parameters
    const eFrom = Math.min(entry_from, entry_to);
    const eTo = Math.max(entry_from, entry_to);
    const tp = take_profit;
    const sl = stop_loss;
    const entryMid = (eFrom + eTo) / 2;
    const side = tp < entryMid ? 'short' : 'long';

    // Fetch and trace
    let currentTs = startTs;
    let totalCandlesSeen = 0;
    let entered = mode === 'immediate';
    let enteredAtMs: number | null = mode === 'immediate' ? startTsMs : null;
    let prevClose: number | null = null;

    while (currentTs < endTs) {
      const chunkEnd = Math.min(endTs, currentTs + CHUNK_SECONDS);
      const url = `https://public.coindcx.com/market_data/candlesticks?pair=${apiToken}&from=${currentTs}&to=${chunkEnd}&resolution=1&pcode=f`;

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          break;
        }

        const data = await res.json();
        const candles = Array.isArray(data) ? data : data?.data || data;

        if (Array.isArray(candles) && candles.length > 0) {
          totalCandlesSeen += candles.length;
          const sorted = candles.sort(
            (a: { time: number }, b: { time: number }) => a.time - b.time
          );

          for (const c of sorted) {
            const high = Number(c.high);
            const low = Number(c.low);
            const open = Number(c.open);
            const close = Number(c.close);
            const candleTimeMs = Number(c.time); // CoinDCX returns ms

            // Entry check (only in entry_check mode)
            if (!entered) {
              if (high >= eFrom && low <= eTo) {
                entered = true;
                enteredAtMs = candleTimeMs;
              } else if (prevClose !== null) {
                if (
                  (prevClose < eFrom && open > eTo) ||
                  (prevClose > eTo && open < eFrom)
                ) {
                  entered = true;
                  enteredAtMs = candleTimeMs;
                }
              }
            }

            prevClose = close;

            // TP/SL check
            if (entered) {
              let tpHit = false;
              let slHit = false;

              if (side === 'long') {
                tpHit = high >= tp;
                slHit = low <= sl;
              } else {
                tpHit = low <= tp;
                slHit = high >= sl;
              }

              if (tpHit && slHit) {
                return makeResponse({
                  result: 'BOTH',
                  detail: 'Both TP and SL hit in same candle',
                  candlesProcessed: totalCandlesSeen,
                  resolvedAtMs: candleTimeMs,
                  enteredAtMs,
                  startTsMs,
                });
              }
              if (tpHit) {
                return makeResponse({
                  result: 'TAKE_PROFIT',
                  detail: 'TP hit',
                  candlesProcessed: totalCandlesSeen,
                  resolvedAtMs: candleTimeMs,
                  enteredAtMs,
                  startTsMs,
                });
              }
              if (slHit) {
                return makeResponse({
                  result: 'STOP_LOSS',
                  detail: 'SL hit',
                  candlesProcessed: totalCandlesSeen,
                  resolvedAtMs: candleTimeMs,
                  enteredAtMs,
                  startTsMs,
                });
              }
            }
          }
        }
      } catch {
        break;
      }

      currentTs = chunkEnd + 60;
      await sleep(API_DELAY_MS);
    }

    // Terminal fallbacks
    if (totalCandlesSeen === 0) {
      return makeResponse({
        result: 'NO_DATA',
        detail: 'No candle data returned from API',
        candlesProcessed: 0,
        startTsMs,
      });
    }
    if (!entered) {
      return makeResponse({
        result: 'NO_ENTRY',
        detail: 'Price never entered the entry zone',
        candlesProcessed: totalCandlesSeen,
        startTsMs,
      });
    }
    if (nowTs > expiryTs) {
      return makeResponse({
        result: 'EXPIRED',
        detail: 'Call expired without hitting TP or SL',
        candlesProcessed: totalCandlesSeen,
        enteredAtMs,
        startTsMs,
      });
    }

    return makeResponse({
      result: 'SIDEWAYS',
      detail: 'Still open - neither TP nor SL hit yet',
      candlesProcessed: totalCandlesSeen,
      enteredAtMs,
      startTsMs,
    });
  } catch (err) {
    return NextResponse.json(
      { result: 'ERROR', detail: String(err) },
      { status: 500 }
    );
  }
}
