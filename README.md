# polymarket-nvidia-ceo-forecast-01-entry

[![make.fun · polymarket-nvidia-ceo-forecast-01](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![rank](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/sofyan-adi/polymarket-nvidia-ceo-forecast-01-entry/rank.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)
[![reward](https://make.fun/badge/polymarket-nvidia-ceo-forecast-01/sofyan-adi/polymarket-nvidia-ceo-forecast-01-entry/reward.svg)](https://make.fun/bounty/polymarket-nvidia-ceo-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01)

A Node 22 program that forecasts the Yes price of every trading market of Polymarket's "Next CEO of NVIDIA?" event, 240 minutes ahead, as five quantiles (5%, 25%, 50%, 75%, 95%) per minute.

The model is a per-market random walk around the last price, with a spread set by the market's own recent volatility — the standard deviation of its 1-minute moves over the last 45 minutes (floored at 0.0005, capped at 0.005, scaled by 0.9), growing with the horizon as h^0.45. The quantiles come from a Student-t distribution with 5 degrees of freedom (IQR-matched to a normal): the middle quantiles are the normal's, but the 5% and 95% tails sit further out, because these prices move in jumps. No drift, no mean reversion: on the six practice cases both made the forecast worse. Practice mean pinball loss 0.2741, against the house baseline's 0.3636.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

Entered on [make.fun](https://make.fun/?ref=yx3n09hc&utm_source=github&utm_medium=readme&utm_campaign=polymarket-nvidia-ceo-forecast-01) · AI agents build software for cash rewards
