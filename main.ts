// polymarket-nvidia-ceo-forecast-01: forecast the Yes price of every trading
// market of Polymarket's "Next CEO of NVIDIA?" event, 240 minutes ahead, as
// five quantiles (5%, 25%, 50%, 75%, 95%) per minute.
//
// Model: a per-market random walk around the last price, with a spread set by
// the market's own recent volatility — the standard deviation of its 1-minute
// price moves over the last 45 minutes — floored at 0.0005 and capped at
// 0.005 price units per minute, scaled by 0.9, growing with the horizon as
// h^0.45 (slower than a plain random walk's sqrt(h): realised volatility
// mean-reverts, so the far minutes are not as wide as sqrt(h) would say).
//
//   q_tau(h) = clamp(x + z_tau * sigma * h^0.45, 0, 1), rounded to 6 decimals
//
// where x is the market's last price in the case and z_tau is the quantile
// at each level of a Student-t distribution with 5 degrees of freedom,
// rescaled so its interquartile range matches a standard normal's:
// [-1.87031, -0.67449, 0, 0.67449, 1.87031]. The middle quantiles are the
// normal's, but the 5% and 95% tails sit further out (1.87 instead of 1.64):
// these prices move in jumps — most minutes are flat, then a minute moves
// twenty points — so the honest tails are fatter than a normal's. No drift
// and no pull toward a long-run mean: on the six practice cases, adding
// either made the forecast worse — the prices behave like a walk with
// clustered volatility, not a trend or a reversion. Nothing is tuned on the
// final (its prices do not exist yet); the constants above were picked on
// the practice cases, where this program scores a mean pinball loss of
// 0.2741 against the house baseline's 0.3636.
//
// What an entry must do:
//   - read every <id>.in in the input directory (the grader runs one case at
//     a time, with only that case's file there), canonical JSON
//     {"schema":"makefun/polymarket-case/v1","case","at","horizon_minutes",
//     "quantiles","event","markets":[{"id","name","slug","yes_token","start",
//     "prices"}]}, where `prices` holds one Yes price per minute from `start`
//     to `at` inclusive, so the last one is the price at the checkpoint;
//   - write <id>.out to the output directory: {"forecasts":[{"id","q"}]},
//     every market of the case exactly once (no other id, no other key), `q`
//     exactly horizon_minutes rows, row h-1 the forecast for minute at+h,
//     each row one finite number in [0,1] per quantile level, non-decreasing;
//     at most 1 MiB.
// It runs offline, with no network, under the case's time cap: everything it
// knows is in the case's prices. Deterministic: the same case always writes
// the same bytes.
//
// Outside the grader's container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The quantile levels the contest scores, in the order each row lists them. */
const QUANTILES = [0.05, 0.25, 0.5, 0.75, 0.95];
/** Student-t (5 df) quantiles at each level, rescaled so the IQR matches a
 *  standard normal's: the middle quantiles are the normal's, the tails are
 *  fatter (1.87031 instead of 1.644854), for the jumps these prices make. */
const Z = [-1.87031, -0.67449, 0, 0.67449, 1.87031];
/** Minutes of recent history the per-market volatility is estimated from. */
const WINDOW_MINUTES = 45;
/** Floor and cap for the per-minute volatility, in price units. */
const SIGMA_FLOOR = 0.0005;
const SIGMA_CAP = 0.005;
/** Shrinkage of the estimated volatility (pinball-optimal spread is a little
 *  narrower than the realised standard deviation). */
const SIGMA_SCALE = 0.9;
/** Horizon exponent: the spread grows as h^ALPHA, not sqrt(h). */
const ALPHA = 0.45;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  horizon_minutes: number;
  quantiles: number[];
  markets: CaseMarket[];
}

/** x clamped to [0,1] and rounded to 6 decimals (0, never -0). */
const price6 = (x: number): number => Math.round(Math.min(1, Math.max(0, x)) * 1e6) / 1e6 + 0;

/** Standard deviation of a list of numbers (sample std, 0 when too short). */
function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Per-market volatility: std of the 1-minute moves over the last window. */
function marketSigma(prices: number[]): number {
  const recent = prices.slice(-WINDOW_MINUTES);
  const diffs: number[] = [];
  for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
  const sigma = std(diffs);
  return Math.min(SIGMA_CAP, Math.max(SIGMA_FLOOR, sigma)) * SIGMA_SCALE;
}

/** The forecast of one market: horizon rows of the five quantiles. */
function forecast(m: CaseMarket, horizon: number): number[][] {
  if (m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const x = m.prices[m.prices.length - 1] as number;
  const sigma = marketSigma(m.prices);
  const rows: number[][] = [];
  for (let h = 1; h <= horizon; h++) {
    const sd = sigma * Math.pow(h, ALPHA);
    rows.push(Z.map((z) => price6(x + z * sd)));
  }
  return rows;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.quantiles.length !== QUANTILES.length || c.quantiles.some((t, j) => t !== QUANTILES[j])) throw new Error(`${file} asks for quantiles ${JSON.stringify(c.quantiles)}, not ${JSON.stringify(QUANTILES)}`);
  const forecasts = c.markets.map((m) => ({ id: m.id, q: forecast(m, c.horizon_minutes) }));
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts })}\n`);
}
