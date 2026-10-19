# Black & Jack

A browser blackjack trainer with basic strategy, counting drills, practice play, and simulations. Open **Black & Jack.html** directly, or serve the folder with `python3 -m http.server 8000` and select the HTML file. No application server or build step is required. Fonts load from Google Fonts, with local font fallbacks.

## Supported rules

4–8 decks, 3:2 blackjack, American hole-card/peek rules, S17 or H17, optional double after split and late surrender. Double on any first two cards; one split into two hands; split Aces receive one card each. Single- and double-deck strategy is intentionally unavailable until dedicated tables are implemented.

Use **Start training** for the basic strategy drill. The drill tests decisions; **Play** runs complete rounds. Progress is stored in this browser when browser storage is available. Use **Reset progress** to clear it. Keyboard shortcuts while the training panel has focus: H hit, S stand, D double, P split, R surrender, N next hand. Controls retain normal keyboard behavior when focused.

## Validation

Requires Node.js 20 or newer.

```sh
npm test
npm ci
npx playwright install chromium
npm run test:browser
```

For an existing Chromium installation, skip the browser download and run `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

Strategy regression tests cover S17/H17 decisions, surrender eligibility, double fallbacks, no-DAS pairs, split-hand play, and Ace totals. Browser checks cover navigation, decisions, storage persistence, dealing locks, settlement, and mobile horizontal overflow. Browser screenshots are written to `/tmp/blackjack-desktop.png` and `/tmp/blackjack-mobile.png`.

The simulator is a practice aid, not a guarantee of returns. Exhaustive strategy validation, adaptive drills for missed hands, and full counting-system betting calibration remain future work.
