# Fermah — "Liquidity that acts" (X post image)

Static 16:9 graphic for the post on programmable liquidity with Fermah's Kernel.
Output: `out/fermah-programmable-liquidity.png` (1600×900 layout rendered at 2×, 3200×1800).

- Palette sampled from fermah.xyz (navy `#041624`, card `#081d2c`, teal `#1ce3cc`, logo green `#02c29c`).
- `assets/fermah-logo-light.png` is the supplied logo with the wordmark recoloured for a dark background.
- The chart is generated in `src/index.html`: a static passive range that price leaves vs a Kernel
  range that re-centres after each signal (volatility, cross-chain flows, macro).

Rebuild: `npm install && npm run render` (needs Playwright with Chromium).
