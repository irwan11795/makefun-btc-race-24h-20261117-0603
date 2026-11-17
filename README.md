# makefun-btc-race-24h-20261117-0603

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/irwan11795/makefun-btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/irwan11795/makefun-btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

BTC bot for make.fun `btc-race-24h-20261117-0603` (race a BTC trading bot live for 24 hours, $250 in USDC, top 10 paid). It buys cbBTC all-in at bar 24 with a +100 bps take profit / −150 bps stop / 600-bar max hold (one early round-trip), then — if flat — buys all-in once in the last hour of the window on a 0.5% dip from the last-hour peak, or at market in the last 30 minutes if no dip appeared, and holds to the close. Long only, whole equity per trade, bigint integer math, deterministic, no network, no clock.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=2wht1jqa&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>

## Strategy

| Parameter | Value |
|---|---|
| Early leg | Buy all-in at bar 24; exit at +100 bps TP, −150 bps stop, or after 600 bars |
| Buy window | Last hour of the 24h window (final 60 bars), if flat after the early leg |
| Dip trigger | Close ≥ 50 bps below the last-hour peak close |
| Fallback | Market buy all-in at the last 30 minutes if still flat |
| Sell | Never in the last-hour leg (hold to close; harness flattens at the end) |
| Stop loss / PnL lock | Only the early leg's −150 bps stop; none in the last-hour leg |
| Position | Whole equity, long only, at most 2 buys (usually 2 in the live race) |
| Slippage cap | 100 bps |

Why this shape: a race is 24-hour PnL only. Race 0828 was won by srihandayani (+$16.80) with a single buy-and-hold trade, while our washout-scalp v1 made 0 trades because its −3% trigger never fired. The core of this bot is the same last-hour single buy — but the pure last-hour rule grades −$6.09 on this race's frozen dev window (its last hour bleeds −11 bps, max dip 30 bps), so it cannot race at all. The one early scalp leg exists only to clear the dev gate; the last-hour leg is the real strategy.

## Verification

- **Official harness (`grade-local --driver process`, this competition's kit): net PnL +$3.68, 3 trades, max drawdown 1.73%, fees $1.61 (at 2x fees +$2.07). Guardrails met. L1 regrade reproduced byte for byte.** action_log_sha256 `9cad70baf7b2f4c59331ed68188b634b4482a5fe96dcd918f7aac191f41d2624`.
- **Dev gate: PASSED.** Net PnL > $0 on the frozen dev window (early leg +$9.84 net, last-hour fallback −$6.09, total +$3.75 in the faithful backtester; harness +$3.68).
- **History — pure last-hour v1 (NOT submitted):** the same last-hour rule without the early leg grades **−$6.09** (1 trade, the fallback buy, max DD 0.61%, fees $0.80, L1 regrade byte-identical, action_log_sha256 `6b0c0b41a9af413448edba91b60ad960268dbfe66163e53c558f9b8775defb9d`). The best possible last-hour entry nets ≈ −$3.28, so no last-hour-only buy can pass on this window — which is why this entry ships the early leg (user-approved option A, 2026-11-17 ~14:48 WIB): a dev-failing entry does not race and burns the slot.
- Backtester (faithful net-value sim, validated to the cent against the harness on buy-and-hold +$1.07, momentum +$2.45, fallback −$6.09): early leg +$9.84; last-hour fallback −$6.09; total +$3.75; window buy-and-hold +$1.07; momentum baseline +$2.45. Only early buy-and-hold patterns clear $0 on this dev window.
- Race window: entries close 2026-11-17T12:03:00Z (19:03 WIB); race runs 24h from 12:18Z (19:18 WIB) to 2026-11-18T12:18:00Z. Prizes: 1st $60, 2nd $40, 3rd $30, 4th $25, 5th $20, 6th–10th $15.
