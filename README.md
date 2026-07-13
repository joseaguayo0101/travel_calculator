# TripPocket — Travel Spending Calculator

TripPocket is a responsive, client-side calculator for estimating day-to-day travel spending.
It covers meals, activities, shopping and gifts, plus a 10% miscellaneous buffer. It also gives
destination-specific guidance for how much to carry in cash versus paying by card.

Trips begin with one leg and can contain as many additional legs as needed. The location picker
includes countrywide estimates plus city/region refinements such as Guadalajara, Mérida, Oaxaca,
Tokyo, Kyoto, Bangkok, Bali, Paris, Rome, London, New York City, and others. Each leg has its own
duration and local-currency result. Legs with matching payment conditions share one consolidated
recommendation, with cash amounts and covered subtotals stated in the destination currency.

**Live app:** https://joseaguayo0101.github.io/travel_calculator/

## What is—and is not—included

The estimate is for on-the-ground discretionary spending only:

- meals;
- activities and admission;
- shopping, souvenirs, and gifts;
- customary restaurant, guide/activity, and ride-service tips;
- a 10% miscellaneous buffer.

Flights, lodging, transport, insurance, entry requirements, connectivity, baggage, medical
preparation, payment fees, and a whole-trip emergency buffer are outside the calculator's scope.

## Model assumptions

All tunable constants are grouped in `MODEL_CONSTANTS` near the top of `app.js`.

- Meal baseline: **$22 / $45 / $85 / $160** per person per day.
- Activity baseline: **$10 / $40 / $90** per person per day.
- Shopping: a time factor (**0 / 0.35 / 0.7 / 1 / 1.4**) multiplied by an item-price allowance
  (**$12 / $35 / $80**) per person per day.
- Tips: location-specific customary rates applied to meals, paid activities, and an assumed
  **$12/day** of ride-service spending. The underlying ride fare remains outside the estimate.
- The selected daily baselines are multiplied by destination price level, days, and people.
- The miscellaneous line is exactly 10% of the category subtotal.

Destination price multipliers are planning approximations based on broad 2025–2026 traveler-price
patterns, consumer-price comparisons, and tourism guidance. They focus on food, activities, and
discretionary purchases rather than rent. Payment acceptance varies by merchant and by urban or
rural location, so the recommendations should be treated as practical starting points.

## Exchange rates

The client-side `ExchangeRateService` requests keyless USD rates from
[`open.er-api.com`](https://open.er-api.com/v6/latest/USD) on page load, polls the public feed every
15 minutes, and refreshes when a backgrounded tab becomes visible again. Successful results are
cached in `localStorage` for 15 minutes. If both the network request and a fresh cache are
unavailable, the app uses built-in approximate rates and labels the displayed rate
**“approximate, offline rate.”**

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

It covers qualitative-control direction, both shopping dimensions, multi-leg aggregation, regional pricing,
customary tip math, linear day/person scaling, the exact 10% buffer, three independently calculated
scenarios, count clamping, slider extremes, destination switching, rate polling, fallback-rate
coverage, all payment tiers, recommendation thresholds, and simulated offline behavior.
