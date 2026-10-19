# Black & Jack

A browser blackjack trainer with basic strategy, counting drills, practice play, and simulations. Open **Black & Jack.html** directly, or serve the folder with `python3 -m http.server 8000` and select the HTML file. No application server or build step is required. Fonts load from Google Fonts, with local font fallbacks.

## Supported rules

4–8 decks, 3:2 blackjack, American hole-card/peek rules, S17 or H17, optional double after split and late surrender. Double on any first two cards; one split into two hands; split Aces receive one card each. Single- and double-deck strategy is intentionally unavailable until dedicated tables are implemented.

Use **Start training** for the basic strategy drill. The drill tests decisions; **Play** runs complete rounds. Progress is stored in this browser when browser storage is available. Use **Reset progress** to clear it. Keyboard shortcuts while the training panel has focus: H hit, S stand, D double, P split, R surrender, N next hand. Controls retain normal keyboard behavior when focused.

## Activity options

Each activity has its options at the top of its own tab: Basic Strategy (timer and insurance), Card Counting (system, speed, drill length), Counting Speed (system, cards per round, running total), Hand Totals (total visibility), and Play (players, seat, count system, count visibility, shoe visibility). Shared table rules and sound remain in Settings. Changing Card Counting options resets that drill so the new selection applies on its next start.

## Player seating

In **Play → Table setup**, choose the number of AI players and **Your seat / turn order**. Seat 1 is the rightmost seat and acts first by default. Both cards and turns proceed right to left, with the dealer playing last. Choosing a middle or last seat makes the AI players before you finish before your turn; the remaining players wait until you finish. Seat changes are available between rounds. On phones, swipe the seat strip horizontally; action controls stay outside the strip.

## Validation

Requires Node.js 20 or newer.

```sh
npm test
npm ci
npx playwright install chromium
npm run test:browser
```

For an existing Chromium installation, skip the browser download and run `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`.

Strategy regression tests cover S17/H17 decisions, surrender eligibility, double fallbacks, no-DAS pairs, split-hand play, and Ace totals. Browser checks cover navigation, decisions, storage persistence, dealing locks, settlement, mobile horizontal overflow, first/middle/last seating, right-to-left dealing and play, correct counts, and seven-seat layouts. Browser screenshots are written to `/tmp/blackjack-desktop.png` and `/tmp/blackjack-mobile.png`.

The simulator is a practice aid, not a guarantee of returns. Exhaustive strategy validation, adaptive drills for missed hands, and full counting-system betting calibration remain future work.
