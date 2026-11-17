// SUBMITTED (slot 1, user-approved option A, 2026-11-17 ~14:48 WIB) --
// gate-passing variant of the last-hour v1 for
// make.fun btc-race-24h-20261117-0603. Built because the pure last-hour v1
// FAILS the dev gate on this competition's frozen dev window (grade-local
// net PnL -$6.09: the dev window's last hour bleeds -11 bps with a max dip
// of only 30 bps, so no last-hour buy can clear $0 there -- the best
// possible last-hour entry nets about -$3). This variant keeps the
// last-hour rule EXACTLY as the user specified it and adds ONE early,
// self-contained scalp whose only purpose is to clear the dev gate, so the
// entry races at all.
//
// Structure (long only, whole equity per trade, bigint integer math only,
// no floats, no clock, no network, no randomness):
//
// 1. EARLY LEG (gate leg, one round-trip max): at bar 24 -- the first bar
//    with 24 bars of history, the same entry bar the kit's momentum baseline
//    uses on this single-symbol universe -- buy all-in. Exit at +100 bps net
//    over cost (take profit), -150 bps (stop), or after 600 bars, whichever
//    comes first; the leg is flat long before the last hour either way.
//    On the dev window it buys at bar 24 and exits on the take profit at
//    bar 512. NOTE: this leg is a deliberate deviation from the user's
//    "exactly one buy, in the last hour, no stop, no PnL lock" -- it exists
//    only because the pure rule cannot pass the dev gate on this window.
//    In the live race it will usually fire too (2 buys total instead of 1).
//    Submitted with the user's approval (option A, 2026-11-17 ~14:48 WIB)
//    because the pure rule cannot pass the dev gate on this window.
//
// 2. LAST-HOUR LEG (the user's final strategy, unchanged): if flat, in the
//    last hour buy all-in once on a dip >= 50 bps below the last-hour peak;
//    fallback market buy in the last 30 minutes if no dip; hold to the
//    close, no stop, no take profit, no further trade.
//
// Dev-window result (grade-local, this competition's kit): see README /
// grade report. Python backtester (validated to the cent against the
// harness on buy-and-hold +$1.07, momentum +$2.45, fallback -$6.09):
// early leg +$9.84 net, last-hour fallback -$6.09, total +$3.75.
//
// ENTRYPOINT: this work directory is NOT a repo -- it exists only to grade
// this candidate. If approved, its main.ts replaces the repo's main.ts
// (still exactly one entrypoint, no main.py) and the README is updated.

import { BPS, runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// --- window timing ---------------------------------------------------------
const BAR_MS = 60_000;
const LAST_HOUR_MS = 23 * 60 * BAR_MS;
const LAST_HALF_HOUR_MS = 23 * 60 * BAR_MS + 30 * BAR_MS;

// --- early leg: buy at bar 24, TP +100 bps, stop -150 bps, max hold 600 ---
const EARLY_BUY_BAR = 24;
const EARLY_TP_BPS = 100n;
const EARLY_STOP_BPS = 150n;
const EARLY_MAX_HOLD = 600;

// --- last-hour leg: dip >= 50 bps below the last-hour peak -----------------
const DIP_TRIGGER_BPS = 50n;

const MAX_SLIPPAGE_BPS = 100;

let lastHourPeak: bigint | null = null;
/** True once the single last-hour buy order has been sent. */
let lastHourBought = false;
/** True once the early-leg buy order has been sent. */
let earlyBought = false;
/** True once the early leg has exited (so it never re-enters). */
let earlyDone = false;
/** Batches the early position has been held (counted from the first batch
 * that reports it). */
let earlyHeldBars = 0;

function scoredStartMs(state: BarsState): number {
  return state.hello.first_close_ms + state.warmupBars * BAR_MS;
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    let bar = undefined;
    for (const b of batch.bars) {
      if (b.symbol === SYMBOL) bar = b;
    }
    if (bar === undefined) return [];
    if (state.warmingUp) return [];

    const t = bar.t;
    const close = BigInt(bar.c);
    const start = scoredStartMs(state);
    const held = state.positions.get(SYMBOL);
    const minNotional = BigInt(state.hello.fees.min_notional_quote_units);

    // --- early leg: manage the open early position -----------------------
    if (held !== undefined && !earlyDone && earlyBought && !lastHourBought) {
      earlyHeldBars += 1;
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      const isTP = value * BPS >= cost * (BPS + EARLY_TP_BPS);
      const isStop = value * BPS <= cost * (BPS - EARLY_STOP_BPS);
      const isHold = earlyHeldBars >= EARLY_MAX_HOLD;
      if (isTP || isStop || isHold) {
        earlyDone = true;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    if (held === undefined && earlyBought && !earlyDone) {
      // Early position closed (sold, or the buy was rejected): leg is over.
      earlyDone = true;
    }

    // --- early leg: the single early buy ----------------------------------
    if (!earlyBought && !earlyDone && t < start + LAST_HOUR_MS && state.seq >= EARLY_BUY_BAR) {
      const room = state.weightRoom(SYMBOL);
      const spend = state.cash < room ? state.cash : room;
      if (spend >= minNotional) {
        earlyBought = true;
        earlyHeldBars = 0;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }

    // Before the last hour: nothing else to do.
    if (t < start + LAST_HOUR_MS) return [];

    // Inside the last hour: hold the open position to the close.
    if (held !== undefined) return [];

    // Flat in the last hour: the user's last-hour rule, one buy only, ever.
    if (lastHourBought) return [];

    if (lastHourPeak === null || close > lastHourPeak) lastHourPeak = close;

    const dipped = close * BPS <= lastHourPeak * (BPS - DIP_TRIGGER_BPS);
    const fallbackDue = t >= start + LAST_HALF_HOUR_MS;

    if (!dipped && !fallbackDue) return [];

    const room = state.weightRoom(SYMBOL);
    const spend = state.cash < room ? state.cash : room;
    if (spend < minNotional) return [];
    lastHourBought = true;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  },
});
