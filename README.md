# TripPocket — Travel Spending Calculator

TripPocket is a responsive, client-side calculator for estimating day-to-day travel spending.
It covers meals, activities, shopping and gifts, plus a 10% miscellaneous buffer. It also gives
destination-specific guidance for how much to carry in cash versus paying by card.

**Live app:** https://joseaguayo0101.github.io/travel_calculator/

## What is—and is not—included

The estimate is for on-the-ground discretionary spending only:

- meals;
- activities and admission;
- shopping, souvenirs, and gifts;
- a 10% miscellaneous buffer.

Flights, lodging, transport, insurance, entry requirements, connectivity, baggage, medical
preparation, payment fees, and a whole-trip emergency buffer are intentionally shown as separate
planning reminders rather than included in the result.

## Model assumptions

All tunable constants are grouped in `MODEL_CONSTANTS` near the top of `app.js`.

- Meal baseline: **$22 / $45 / $85 / $160** per person per day.
- Activity baseline: **$10 / $40 / $90** per person per day.
- Shopping: a time factor (**0 / 0.35 / 0.7 / 1 / 1.4**) multiplied by an item-price allowance
  (**$12 / $35 / $80**) per person per day.
- The selected daily baselines are multiplied by destination price level, days, and people.
- The miscellaneous line is exactly 10% of the category subtotal.

Destination price multipliers are planning approximations based on broad 2025–2026 traveler-price
patterns, consumer-price comparisons, and tourism guidance. They focus on food, activities, and
discretionary purchases rather than rent. Payment acceptance varies by merchant and by urban or
rural location, so the recommendations should be treated as practical starting points.

## Exchange rates

On page load, the app requests keyless USD rates from
[`open.er-api.com`](https://open.er-api.com/v6/latest/USD). Successful results are cached in
`localStorage` for 12 hours. If both the network request and a fresh cache are unavailable, the app
uses built-in approximate rates and labels the displayed rate **“approximate, offline rate.”**

To deliberately test fallback behavior, add `?offline=1` to the URL.

## Run locally

No build or dependency installation is required.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Run tests

The logic suite uses Node's built-in runtime and has no package dependencies:

```bash
node tests.js
```

It covers slider direction, both shopping dimensions, linear day/person scaling, the exact 10%
buffer, three independently calculated scenarios, count clamping, slider extremes, destination
switching, fallback-rate coverage, all payment tiers, recommendation thresholds, and simulated
offline behavior.
