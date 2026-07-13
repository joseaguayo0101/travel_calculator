#!/usr/bin/env node
"use strict";

const {
  MODEL_CONSTANTS,
  DESTINATIONS,
  FALLBACK_RATES,
  calculateEstimate,
  buildRecommendation,
  getExchangeData,
} = require("./app.js");

let passed = 0;
let failed = 0;

function test(name, assertion) {
  try {
    assertion();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}\n  ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function close(actual, expected, tolerance = 1e-9) {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected}, received ${actual}`,
  );
}

function toCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function destination(id) {
  return DESTINATIONS.find((item) => item.id === id);
}

const defaults = {
  days: 7,
  people: 1,
  shoppingTime: 2,
  shoppingPrice: 1,
  activities: 1,
  meals: 1,
};

function estimate(overrides = {}, destinationId = "us") {
  return calculateEstimate({ ...defaults, ...overrides }, destination(destinationId));
}

function assertIncreasing(field, levels, fixed = {}) {
  const values = Array.from({ length: levels }, (_, level) =>
    estimate({ ...fixed, [field]: level }).total);
  for (let index = 1; index < values.length; index += 1) {
    assert(values[index] > values[index - 1], `${field}: ${values.join(" is not below ")}`);
  }
}

test("meal slider increases the total at every level", () => {
  assertIncreasing("meals", MODEL_CONSTANTS.mealsDailyUsd.length);
});

test("activity slider increases the total at every level", () => {
  assertIncreasing("activities", MODEL_CONSTANTS.activitiesDailyUsd.length);
});

test("shopping-time slider increases the total at every level", () => {
  assertIncreasing("shoppingTime", MODEL_CONSTANTS.shoppingTimeFactors.length, { shoppingPrice: 1 });
});

test("shopping-price slider increases the total at every level", () => {
  assertIncreasing("shoppingPrice", MODEL_CONSTANTS.shoppingItemDailyUsd.length, { shoppingTime: 2 });
});

test("shopping scales with both shopping sliders", () => {
  const timeLow = estimate({ shoppingTime: 1, shoppingPrice: 1 }).shopping;
  const timeHigh = estimate({ shoppingTime: 4, shoppingPrice: 1 }).shopping;
  const priceLow = estimate({ shoppingTime: 2, shoppingPrice: 0 }).shopping;
  const priceHigh = estimate({ shoppingTime: 2, shoppingPrice: 2 }).shopping;
  assert(timeHigh > timeLow, "higher shopping time did not increase shopping");
  assert(priceHigh > priceLow, "higher shopping prices did not increase shopping");
  close(estimate({ shoppingTime: 0, shoppingPrice: 2 }).shopping, 0);
});

test("totals scale linearly with days", () => {
  close(estimate({ days: 18 }).total, estimate({ days: 1 }).total * 18);
});

test("totals scale linearly with people", () => {
  close(estimate({ people: 6 }).total, estimate({ people: 1 }).total * 6);
});

test("miscellaneous buffer is exactly 10% of subtotal", () => {
  const result = estimate({ days: 11, people: 3, meals: 3, activities: 2 });
  close(result.miscellaneous, result.subtotal * 0.1);
});

test("cheap-destination hand calculation matches to the cent", () => {
  // Thailand: (($22 meals + $10 activities + 0.35 × $12 shopping) × 0.45 × 5) × 1.10
  const result = calculateEstimate(
    { days: 5, people: 1, shoppingTime: 1, shoppingPrice: 0, activities: 0, meals: 0 },
    destination("thailand"),
  );
  close(toCents(result.total), 89.60);
});

test("expensive-destination hand calculation matches to the cent", () => {
  // Switzerland: (($160 + $90 + 1.4 × $80) × 1.60 × 7) × 1.10
  const result = calculateEstimate(
    { days: 7, people: 1, shoppingTime: 4, shoppingPrice: 2, activities: 2, meals: 3 },
    destination("switzerland"),
  );
  close(toCents(result.total), 4459.84);
});

test("long multi-person hand calculation matches to the cent", () => {
  // Mexico: (($85 + $40 + 0.7 × $35) × 0.50 × 21 × 4) × 1.10
  const result = calculateEstimate(
    { days: 21, people: 4, shoppingTime: 2, shoppingPrice: 1, activities: 1, meals: 2 },
    destination("mexico"),
  );
  close(toCents(result.total), 6906.90);
});

test("zero and negative days or people clamp to one", () => {
  const result = estimate({ days: -10, people: 0 });
  assert(result.inputs.days === 1 && result.inputs.people === 1, "counts were not clamped to one");
  assert(Number.isFinite(result.total), "total is not finite");
});

test("non-numeric inputs never produce NaN", () => {
  const result = calculateEstimate({
    days: "nope",
    people: undefined,
    shoppingTime: NaN,
    shoppingPrice: null,
    activities: Infinity,
    meals: "",
  }, destination("japan"));
  Object.values(result).forEach((value) => {
    if (typeof value === "number") assert(Number.isFinite(value), "numeric result contains NaN or Infinity");
  });
});

test("all sliders at simultaneous minimum and maximum are valid", () => {
  const minimum = estimate({ shoppingTime: 0, shoppingPrice: 0, activities: 0, meals: 0 });
  const maximum = estimate({ shoppingTime: 4, shoppingPrice: 2, activities: 2, meals: 3 });
  assert(minimum.total > 0, "minimum total must remain positive");
  assert(maximum.total > minimum.total, "maximum total must exceed minimum total");
});

test("switching destinations changes multiplier and currency", () => {
  const thailand = estimate({}, "thailand");
  const switzerland = estimate({}, "switzerland");
  assert(thailand.destination.currency === "THB", "Thailand currency mismatch");
  assert(switzerland.destination.currency === "CHF", "Switzerland currency mismatch");
  assert(switzerland.total > thailand.total, "destination multiplier did not change total");
});

test("all destination currency codes have offline fallback rates", () => {
  DESTINATIONS.forEach((item) => {
    assert(Number.isFinite(FALLBACK_RATES[item.currency]), `missing ${item.currency} fallback for ${item.name}`);
  });
});

test("destination data has complete, plausible values and all payment tiers", () => {
  assert(DESTINATIONS.length >= 40, "fewer than 40 destinations");
  const tiers = new Set();
  DESTINATIONS.forEach((item) => {
    assert(/^[A-Z]{3}$/.test(item.currency), `invalid currency code for ${item.name}`);
    assert(item.multiplier >= 0.25 && item.multiplier <= 2, `implausible multiplier for ${item.name}`);
    assert(item.note.length >= 30, `payment note is too short for ${item.name}`);
    assert(["card-friendly", "mixed", "cash-heavy"].includes(item.acceptance), `invalid tier for ${item.name}`);
    tiers.add(item.acceptance);
  });
  assert(tiers.size === 3, "destination data does not cover all payment tiers");
});

test("all three acceptance tiers produce tier-correct guidance", () => {
  const card = buildRecommendation(estimate({}, "sweden"));
  const mixed = buildRecommendation(estimate({}, "japan"));
  const cash = buildRecommendation(estimate({}, "vietnam"));
  assert(card.headline === "Lead with a card" && card.summary.includes("no-foreign"), "card-friendly guidance mismatch");
  assert(mixed.headline === "Use both cash and card" && mixed.summary.includes("cash-heavy meals"), "mixed guidance mismatch");
  assert(cash.headline === "Plan around cash" && cash.summary.includes("85%"), "cash-heavy guidance mismatch");
});

test("cash recommendation uses small, moderate, and high amount bands", () => {
  const cashDestination = destination("vietnam");
  const small = buildRecommendation({
    destination: cashDestination, total: 100, meals: 30, activities: 20, shopping: 40, miscellaneous: 10,
  });
  const moderate = buildRecommendation({
    destination: cashDestination, total: 600, meals: 200, activities: 100, shopping: 245, miscellaneous: 55,
  });
  const high = buildRecommendation({
    destination: cashDestination, total: 1500, meals: 500, activities: 250, shopping: 614, miscellaneous: 136,
  });
  assert(small.amountBand === "small" && small.actions.flat().join(" ").includes("modest cash need"), "$200 guidance failed");
  assert(moderate.amountBand === "moderate", "moderate guidance failed");
  assert(high.amountBand === "high" && high.actions.flat().join(" ").includes("staggered ATM"), "$1,000 guidance failed");
});

async function runAsyncTests() {
  await (async () => {
    try {
      let fetchCalled = false;
      const data = await getExchangeData({
        forceOffline: true,
        storage: null,
        fetcher: async () => {
          fetchCalled = true;
          throw new Error("offline");
        },
      });
      assert(!fetchCalled, "forced offline mode attempted a network request");
      assert(data.approximate && data.source === "fallback", "offline fallback was not clearly identified");
      assert(data.rates.JPY === FALLBACK_RATES.JPY, "fallback rates mismatch");
      passed += 1;
      console.log("✓ simulated offline mode returns labeled fallback rates");
    } catch (error) {
      failed += 1;
      console.error(`✗ simulated offline mode returns labeled fallback rates\n  ${error.message}`);
    }
  })();

  await (async () => {
    try {
      let fetchCalled = false;
      const data = await getExchangeData({
        storage: null,
        fetcher: async () => {
          fetchCalled = true;
          throw new Error("simulated network failure");
        },
      });
      assert(fetchCalled, "the simulated failing fetch was not attempted");
      assert(data.approximate && data.source === "fallback", "failed fetch did not use labeled fallback");
      passed += 1;
      console.log("✓ failed exchange-rate fetch falls back without breaking");
    } catch (error) {
      failed += 1;
      console.error(`✗ failed exchange-rate fetch falls back without breaking\n  ${error.message}`);
    }
  })();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

runAsyncTests();
