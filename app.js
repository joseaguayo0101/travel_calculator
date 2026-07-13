/* global module */
(function (root) {
  "use strict";

  /*
   * MODEL ASSUMPTIONS
   * -----------------
   * US baseline amounts are planning allowances, not market quotes. Destination multipliers
   * synthesize 2025–2026 traveler-price patterns from Numbeo-style consumer price comparisons,
   * Budget Your Trip ranges, and general tourism guidance. They intentionally emphasize the
   * categories in this tool (food, activities, and discretionary shopping), not rent.
   *
   * Card tiers and payment notes reflect broad guidance from national tourism boards and
   * traveler advisories. Conditions vary by city, rurality, and individual merchant.
   * All tunable calculation values live in this one object.
   */
  const MODEL_CONSTANTS = Object.freeze({
    mealsDailyUsd: [22, 45, 85, 160],
    activitiesDailyUsd: [10, 40, 90],
    shoppingTimeFactors: [0, 0.35, 0.7, 1, 1.4],
    shoppingItemDailyUsd: [12, 35, 80],
    assumedLocalRideSpendDailyUsd: 12,
    miscellaneousRate: 0.1,
    exchangeRatePollMs: 15 * 60 * 1000,
    cashShare: {
      mixedMeals: 0.55,
      mixedActivities: 0.35,
      mixedShopping: 0.6,
      mixedMiscellaneous: 0.5,
      cashHeavy: 0.85,
    },
  });

  const DESTINATIONS = [
    { id: "argentina", name: "Argentina", currency: "ARS", symbol: "$", multiplier: 0.55, acceptance: "mixed", note: "Cards are common in cities, but cash can be useful at small businesses; exchange-rate conditions can change quickly." },
    { id: "australia", name: "Australia", currency: "AUD", symbol: "A$", multiplier: 1.12, acceptance: "card-friendly", note: "Tap-to-pay is nearly universal, and some businesses no longer accept cash." },
    { id: "austria", name: "Austria", currency: "EUR", symbol: "€", multiplier: 1.03, acceptance: "mixed", note: "Cards are widespread, but traditional cafés and smaller establishments may prefer cash." },
    { id: "belgium", name: "Belgium", currency: "EUR", symbol: "€", multiplier: 1.05, acceptance: "card-friendly", note: "Contactless cards are broadly accepted, though a few small vendors impose minimums." },
    { id: "bolivia", name: "Bolivia", currency: "BOB", symbol: "Bs", multiplier: 0.38, acceptance: "cash-heavy", note: "Cash is essential outside upscale hotels and restaurants; carry small boliviano notes." },
    { id: "botswana", name: "Botswana", currency: "BWP", symbol: "P", multiplier: 0.57, acceptance: "mixed", note: "Lodges and urban shops take cards, while markets and remote areas rely on pula cash." },
    { id: "brazil", name: "Brazil", currency: "BRL", symbol: "R$", multiplier: 0.58, acceptance: "card-friendly", note: "Contactless payment is common even for small purchases, but keep modest cash for markets." },
    { id: "cambodia", name: "Cambodia", currency: "KHR", symbol: "៛", multiplier: 0.4, acceptance: "cash-heavy", note: "Cash dominates; US dollars circulate, but change is often given in riel and damaged dollars may be refused." },
    { id: "canada", name: "Canada", currency: "CAD", symbol: "C$", multiplier: 1.04, acceptance: "card-friendly", note: "Credit and contactless cards are accepted almost everywhere, including for small purchases." },
    { id: "chile", name: "Chile", currency: "CLP", symbol: "$", multiplier: 0.67, acceptance: "card-friendly", note: "Cards are widely accepted in cities; cash remains useful for markets, tolls, and rural stops." },
    { id: "china", name: "China", currency: "CNY", symbol: "¥", multiplier: 0.59, acceptance: "mixed", note: "Mobile payment dominates; foreign-card acceptance has improved, but cash is a valuable backup." },
    { id: "colombia", name: "Colombia", currency: "COP", symbol: "$", multiplier: 0.42, acceptance: "mixed", note: "Cards work well in cities, while small shops, taxis, and rural areas often require cash." },
    { id: "costa-rica", name: "Costa Rica", currency: "CRC", symbol: "₡", multiplier: 0.7, acceptance: "mixed", note: "Tourist businesses commonly take cards, but cash helps in small towns and for roadside purchases." },
    { id: "croatia", name: "Croatia", currency: "EUR", symbol: "€", multiplier: 0.78, acceptance: "mixed", note: "Cards are common in tourist centers, but small cafés, ferries, and island vendors may prefer cash." },
    { id: "czechia", name: "Czechia", currency: "CZK", symbol: "Kč", multiplier: 0.72, acceptance: "card-friendly", note: "Contactless payment is widespread; always choose koruna, not dynamic currency conversion." },
    { id: "denmark", name: "Denmark", currency: "DKK", symbol: "kr", multiplier: 1.3, acceptance: "card-friendly", note: "Denmark is highly cashless, and card or mobile payment is standard almost everywhere." },
    { id: "ecuador", name: "Ecuador", currency: "USD", symbol: "$", multiplier: 0.46, acceptance: "cash-heavy", note: "Ecuador uses US dollars; small bills are important because many merchants cannot break large notes." },
    { id: "egypt", name: "Egypt", currency: "EGP", symbol: "E£", multiplier: 0.34, acceptance: "cash-heavy", note: "Cash is needed for tips, small vendors, and many local services; keep a supply of small notes." },
    { id: "finland", name: "Finland", currency: "EUR", symbol: "€", multiplier: 1.13, acceptance: "card-friendly", note: "Cards and contactless payments are standard, with little practical need for cash." },
    { id: "france", name: "France", currency: "EUR", symbol: "€", multiplier: 1.02, acceptance: "card-friendly", note: "Cards are broadly accepted, but a small cash reserve helps at markets and minimum-spend cafés." },
    { id: "germany", name: "Germany", currency: "EUR", symbol: "€", multiplier: 0.98, acceptance: "mixed", note: "Germany remains more cash-oriented than many neighbors; some restaurants and shops are cash-only." },
    { id: "greece", name: "Greece", currency: "EUR", symbol: "€", multiplier: 0.8, acceptance: "mixed", note: "Cards are common in tourist areas, while cash is useful on small islands and at family-run businesses." },
    { id: "hungary", name: "Hungary", currency: "HUF", symbol: "Ft", multiplier: 0.65, acceptance: "card-friendly", note: "Cards are widely accepted; pay in forints and decline dynamic currency conversion." },
    { id: "iceland", name: "Iceland", currency: "ISK", symbol: "kr", multiplier: 1.55, acceptance: "card-friendly", note: "Cards are accepted virtually everywhere, including remote fuel stations and small purchases." },
    { id: "india", name: "India", currency: "INR", symbol: "₹", multiplier: 0.34, acceptance: "cash-heavy", note: "Digital payments are widespread domestically, but foreign visitors still need cash for small vendors and transport." },
    { id: "indonesia", name: "Indonesia", currency: "IDR", symbol: "Rp", multiplier: 0.42, acceptance: "cash-heavy", note: "Cash is important beyond major hotels and malls, especially on smaller islands and at local eateries." },
    { id: "ireland", name: "Ireland", currency: "EUR", symbol: "€", multiplier: 1.16, acceptance: "card-friendly", note: "Contactless cards are widely accepted, though a little cash is useful in remote areas." },
    { id: "israel", name: "Israel", currency: "ILS", symbol: "₪", multiplier: 1.28, acceptance: "card-friendly", note: "Cards are widely accepted; cash is mainly useful for markets, tips, and a few small businesses." },
    { id: "italy", name: "Italy", currency: "EUR", symbol: "€", multiplier: 0.94, acceptance: "mixed", note: "Cards are common, but small cafés, market stalls, and rural businesses may still favor cash." },
    { id: "japan", name: "Japan", currency: "JPY", symbol: "¥", multiplier: 1, acceptance: "mixed", note: "Many small restaurants, temples, ticket machines, and rural businesses remain cash-only despite Japan's high-tech reputation." },
    { id: "jordan", name: "Jordan", currency: "JOD", symbol: "JD", multiplier: 0.62, acceptance: "mixed", note: "Hotels and larger restaurants take cards, but cash is needed for taxis, tips, and smaller shops." },
    { id: "kenya", name: "Kenya", currency: "KES", symbol: "KSh", multiplier: 0.45, acceptance: "cash-heavy", note: "Mobile money is dominant locally; visitors should keep shilling cash for markets, transport, and rural areas." },
    { id: "malaysia", name: "Malaysia", currency: "MYR", symbol: "RM", multiplier: 0.48, acceptance: "mixed", note: "Cards work in malls and established businesses, while hawker centers and markets usually prefer cash." },
    { id: "mexico", name: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.5, acceptance: "mixed", note: "Cards are common in tourist areas, but cash is important for street food, markets, tips, and smaller towns." },
    { id: "morocco", name: "Morocco", currency: "MAD", symbol: "د.م.", multiplier: 0.46, acceptance: "cash-heavy", note: "Medinas, taxis, cafés, and small shops generally expect cash; dirhams are a restricted currency." },
    { id: "nepal", name: "Nepal", currency: "NPR", symbol: "रू", multiplier: 0.33, acceptance: "cash-heavy", note: "Cash is essential outside upscale Kathmandu businesses, and ATMs can be scarce on trekking routes." },
    { id: "netherlands", name: "Netherlands", currency: "EUR", symbol: "€", multiplier: 1.1, acceptance: "card-friendly", note: "Contactless payment is standard, though a few places accept only local debit networks or cash." },
    { id: "new-zealand", name: "New Zealand", currency: "NZD", symbol: "NZ$", multiplier: 1.03, acceptance: "card-friendly", note: "Cards are nearly universal; some merchants add a small credit-card surcharge." },
    { id: "norway", name: "Norway", currency: "NOK", symbol: "kr", multiplier: 1.35, acceptance: "card-friendly", note: "Norway is highly cashless, with card and contactless payment accepted almost everywhere." },
    { id: "peru", name: "Peru", currency: "PEN", symbol: "S/", multiplier: 0.44, acceptance: "mixed", note: "Cards work at established tourist businesses, but cash is needed for markets, taxis, and rural stops." },
    { id: "philippines", name: "Philippines", currency: "PHP", symbol: "₱", multiplier: 0.43, acceptance: "cash-heavy", note: "Cash remains essential away from major malls and hotels, particularly on smaller islands." },
    { id: "portugal", name: "Portugal", currency: "EUR", symbol: "€", multiplier: 0.78, acceptance: "mixed", note: "Cards are widespread, but small restaurants and shops may use local-card-only terminals or prefer cash." },
    { id: "singapore", name: "Singapore", currency: "SGD", symbol: "S$", multiplier: 1.08, acceptance: "card-friendly", note: "Cards and mobile payments are common, but some hawker stalls still take cash or local QR payments only." },
    { id: "south-africa", name: "South Africa", currency: "ZAR", symbol: "R", multiplier: 0.5, acceptance: "card-friendly", note: "Cards are widely used in cities and tourist areas; keep a little cash for tips and informal vendors." },
    { id: "south-korea", name: "South Korea", currency: "KRW", symbol: "₩", multiplier: 0.82, acceptance: "card-friendly", note: "Cards are accepted almost everywhere, although market stalls and transit top-ups can require cash." },
    { id: "spain", name: "Spain", currency: "EUR", symbol: "€", multiplier: 0.84, acceptance: "card-friendly", note: "Contactless cards are broadly accepted; small cash is handy at markets and very small cafés." },
    { id: "sweden", name: "Sweden", currency: "SEK", symbol: "kr", multiplier: 1.18, acceptance: "card-friendly", note: "Sweden is strongly cashless, and some businesses explicitly do not accept cash." },
    { id: "switzerland", name: "Switzerland", currency: "CHF", symbol: "CHF", multiplier: 1.6, acceptance: "card-friendly", note: "Cards are widely accepted, but modest franc cash can help at mountain huts and small markets." },
    { id: "taiwan", name: "Taiwan", currency: "TWD", symbol: "NT$", multiplier: 0.65, acceptance: "mixed", note: "Cash is still preferred at night markets, food stalls, and many smaller shops." },
    { id: "thailand", name: "Thailand", currency: "THB", symbol: "฿", multiplier: 0.45, acceptance: "cash-heavy", note: "Street food, markets, taxis, and small businesses rely heavily on baht cash; ATM fees are often fixed per withdrawal." },
    { id: "turkey", name: "Türkiye", currency: "TRY", symbol: "₺", multiplier: 0.48, acceptance: "mixed", note: "Cards work well in cities, but cash is useful in bazaars, small restaurants, and rural areas; prices can shift quickly." },
    { id: "uae", name: "United Arab Emirates", currency: "AED", symbol: "د.إ", multiplier: 1.05, acceptance: "card-friendly", note: "Cards and contactless payments are nearly universal; cash is mainly useful for small tips." },
    { id: "uk", name: "United Kingdom", currency: "GBP", symbol: "£", multiplier: 1.15, acceptance: "card-friendly", note: "Contactless cards are accepted almost everywhere, including public transport in major cities." },
    { id: "us", name: "United States", currency: "USD", symbol: "$", multiplier: 1, acceptance: "card-friendly", note: "Cards are widely accepted, but cash can help with tips, small vendors, and cash-only businesses." },
    { id: "vietnam", name: "Vietnam", currency: "VND", symbol: "₫", multiplier: 0.38, acceptance: "cash-heavy", note: "Cash is standard for street food, markets, local transport, and many smaller businesses." },
  ];

  // City and regional values refine the countrywide baseline where traveler costs or payment
  // habits differ materially. Countrywide entries remain available for flexible itineraries.
  const REGIONS = [
    { id: "guadalajara-mexico", name: "Guadalajara, Jalisco", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.48, acceptance: "mixed", note: "Cards work well at established businesses, while mercados, street food, tips, and some taxis still call for pesos." },
    { id: "merida-mexico", name: "Mérida, Yucatán", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.44, acceptance: "mixed", note: "Central Mérida is card-friendly, but cash remains useful at markets, cenotes, small eateries, and villages." },
    { id: "mexico-city-mexico", name: "Mexico City", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.6, acceptance: "card-friendly", note: "Cards and contactless payment are widespread, with pesos still useful for markets, street stalls, and tips." },
    { id: "oaxaca-mexico", name: "Oaxaca", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.43, acceptance: "cash-heavy", note: "Markets, colectivos, artisan workshops, and many smaller restaurants rely on cash; carry small peso notes." },
    { id: "cancun-mexico", name: "Cancún & Riviera Maya", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.78, acceptance: "mixed", note: "Resorts take cards, but pesos are better for tips, local transport, cenotes, and purchases away from hotel zones." },
    { id: "san-miguel-mexico", name: "San Miguel de Allende", country: "Mexico", currency: "MXN", symbol: "$", multiplier: 0.66, acceptance: "mixed", note: "Boutiques and restaurants commonly take cards, while markets, taxis, and tips are easier with pesos." },
    { id: "new-york-us", name: "New York City", country: "United States", currency: "USD", symbol: "$", multiplier: 1.42, acceptance: "card-friendly", note: "Cards and contactless payment are nearly universal; keep a little cash for tips and cash-only counters." },
    { id: "hawaii-us", name: "Hawaiʻi", country: "United States", currency: "USD", symbol: "$", multiplier: 1.48, acceptance: "card-friendly", note: "Cards are broadly accepted, though cash helps at roadside stands, food trucks, and for service tips." },
    { id: "california-us", name: "California", country: "United States", currency: "USD", symbol: "$", multiplier: 1.24, acceptance: "card-friendly", note: "Cards are standard throughout California, but small cash is useful for tips and occasional small vendors." },
    { id: "tokyo-japan", name: "Tokyo", country: "Japan", currency: "JPY", symbol: "¥", multiplier: 1.14, acceptance: "mixed", note: "Tokyo is increasingly card-friendly, but ramen shops, temples, older ticket machines, and tiny bars may require cash." },
    { id: "kyoto-japan", name: "Kyoto", country: "Japan", currency: "JPY", symbol: "¥", multiplier: 1.05, acceptance: "mixed", note: "Carry yen for temples, buses, traditional shops, and small restaurants even when larger venues accept cards." },
    { id: "hokkaido-japan", name: "Hokkaidō", country: "Japan", currency: "JPY", symbol: "¥", multiplier: 0.97, acceptance: "mixed", note: "Cards work in cities and resorts, but cash is prudent for rural restaurants, onsen, and small transit operators." },
    { id: "bangkok-thailand", name: "Bangkok", country: "Thailand", currency: "THB", symbol: "฿", multiplier: 0.47, acceptance: "mixed", note: "Malls take cards, while street food, markets, taxis, and many independent venues are easiest with baht." },
    { id: "chiang-mai-thailand", name: "Chiang Mai", country: "Thailand", currency: "THB", symbol: "฿", multiplier: 0.37, acceptance: "cash-heavy", note: "Night markets, songthaews, cafés, and smaller attractions rely heavily on cash; withdraw larger amounts to offset ATM fees." },
    { id: "phuket-thailand", name: "Phuket", country: "Thailand", currency: "THB", symbol: "฿", multiplier: 0.64, acceptance: "mixed", note: "Hotels and larger venues take cards, while taxis, beach vendors, markets, and tips often require cash." },
    { id: "bali-indonesia", name: "Bali", country: "Indonesia", currency: "IDR", symbol: "Rp", multiplier: 0.49, acceptance: "mixed", note: "Cards work at established tourist businesses, but warungs, drivers, markets, and rural stops commonly need rupiah." },
    { id: "paris-france", name: "Paris", country: "France", currency: "EUR", symbol: "€", multiplier: 1.22, acceptance: "card-friendly", note: "Contactless cards are common; modest euro cash helps at markets, kiosks, and merchants with card minimums." },
    { id: "french-riviera-france", name: "French Riviera", country: "France", currency: "EUR", symbol: "€", multiplier: 1.2, acceptance: "card-friendly", note: "Cards are broadly accepted, with cash useful for markets, beach vendors, and small village purchases." },
    { id: "rome-italy", name: "Rome", country: "Italy", currency: "EUR", symbol: "€", multiplier: 1.02, acceptance: "mixed", note: "Cards are common at major venues, but cash remains useful for espresso bars, markets, and small family businesses." },
    { id: "sicily-italy", name: "Sicily", country: "Italy", currency: "EUR", symbol: "€", multiplier: 0.76, acceptance: "mixed", note: "Cities and hotels take cards, while village cafés, markets, beach parking, and small shops may prefer cash." },
    { id: "london-uk", name: "London", country: "United Kingdom", currency: "GBP", symbol: "£", multiplier: 1.38, acceptance: "card-friendly", note: "London is strongly contactless, including transit; only a very small emergency cash reserve is generally needed." },
    { id: "scotland-uk", name: "Scottish Highlands", country: "United Kingdom", currency: "GBP", symbol: "£", multiplier: 1.05, acceptance: "card-friendly", note: "Cards are common, but carry some pounds for remote cafés, honesty boxes, and connectivity outages." },
    { id: "sydney-australia", name: "Sydney", country: "Australia", currency: "AUD", symbol: "A$", multiplier: 1.28, acceptance: "card-friendly", note: "Contactless payment is standard; some restaurants and small businesses add card surcharges." },
    { id: "patagonia-argentina", name: "Patagonia", country: "Argentina", currency: "ARS", symbol: "$", multiplier: 0.75, acceptance: "mixed", note: "Tourist businesses take cards, but connectivity and ATMs can be limited in remote towns, making cash backup important." },
    { id: "rio-brazil", name: "Rio de Janeiro", country: "Brazil", currency: "BRL", symbol: "R$", multiplier: 0.64, acceptance: "card-friendly", note: "Cards and contactless payments are widespread, though reais help at beaches, markets, and for small tips." },
    { id: "cape-town-south-africa", name: "Cape Town", country: "South Africa", currency: "ZAR", symbol: "R", multiplier: 0.58, acceptance: "card-friendly", note: "Cards are standard at established venues; keep limited rand for tips, parking attendants, and informal vendors." },
    { id: "barcelona-spain", name: "Barcelona", country: "Spain", currency: "EUR", symbol: "€", multiplier: 0.92, acceptance: "card-friendly", note: "Contactless cards are broadly accepted, with a little euro cash useful at markets and tiny cafés." },
  ];

  const TIP_PROFILES = Object.freeze({
    high: { meals: 0.2, activities: 0.15, rides: 0.18 },
    moderate: { meals: 0.1, activities: 0.08, rides: 0.1 },
    low: { meals: 0.03, activities: 0.03, rides: 0.03 },
    included: { meals: 0.02, activities: 0.03, rides: 0 },
  });

  const HIGH_TIP_COUNTRIES = new Set(["United States", "Canada", "Mexico"]);
  const INCLUDED_TIP_COUNTRIES = new Set(["France", "Italy", "Spain", "Portugal", "Belgium", "Austria"]);
  const LOW_TIP_COUNTRIES = new Set(["Japan", "South Korea", "China", "Taiwan", "Singapore", "Australia", "New Zealand"]);

  const LOCATIONS = [...DESTINATIONS.map((item) => ({ ...item, country: item.name, countrywide: true })), ...REGIONS]
    .map((item) => {
      const profile = HIGH_TIP_COUNTRIES.has(item.country)
        ? TIP_PROFILES.high
        : INCLUDED_TIP_COUNTRIES.has(item.country)
          ? TIP_PROFILES.included
          : LOW_TIP_COUNTRIES.has(item.country)
            ? TIP_PROFILES.low
            : TIP_PROFILES.moderate;
      return { ...item, tipRates: profile };
    });

  // Approximate July 2026 planning fallbacks, expressed as units of local currency per USD.
  // These are used only when neither the keyless live API nor a fresh cache is available.
  const FALLBACK_RATES = Object.freeze({
    USD: 1, AED: 3.6725, ARS: 1250, AUD: 1.52, BOB: 6.91, BRL: 5.5, BWP: 13.5,
    CAD: 1.36, CHF: 0.8, CLP: 950, CNY: 7.18, COP: 4100, CRC: 505, CZK: 21.5,
    DKK: 6.42, EGP: 48.5, EUR: 0.86, GBP: 0.74, HUF: 340, IDR: 16300, ILS: 3.3,
    INR: 86, ISK: 123, JOD: 0.709, JPY: 147, KES: 129, KHR: 4100, KRW: 1380,
    MAD: 9.1, MXN: 18, MYR: 4.3, NOK: 10, NPR: 137, NZD: 1.66, PEN: 3.55,
    PHP: 57, SEK: 9.6, SGD: 1.28, THB: 32, TRY: 40, TWD: 29.5, VND: 26000,
    ZAR: 17.8,
  });

  const SLIDER_LABELS = Object.freeze({
    shoppingTime: ["None", "A little", "Moderate", "A lot", "It's the main event"],
    shoppingPrice: ["Cheap souvenirs", "Mid-range gifts", "Boutique / designer"],
    activities: ["Low · free sights", "Moderate · museums & tours", "High · premium excursions"],
    meals: ["Street food / self-catering", "Casual restaurants", "Mostly nice restaurants", "Fine dining"],
  });

  const CACHE_KEY = "tripPocketUsdRatesV1";
  const CACHE_MAX_AGE_MS = MODEL_CONSTANTS.exchangeRatePollMs;

  function clampInteger(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  function destinationById(id) {
    return LOCATIONS.find((item) => item.id === id) || LOCATIONS.find((item) => item.id === "guadalajara-mexico");
  }

  function normalizeInputs(input) {
    return {
      days: clampInteger(input.days, 1, 365),
      people: clampInteger(input.people, 1, 50),
      shoppingTime: clampInteger(input.shoppingTime, 0, MODEL_CONSTANTS.shoppingTimeFactors.length - 1),
      shoppingPrice: clampInteger(input.shoppingPrice, 0, MODEL_CONSTANTS.shoppingItemDailyUsd.length - 1),
      activities: clampInteger(input.activities, 0, MODEL_CONSTANTS.activitiesDailyUsd.length - 1),
      meals: clampInteger(input.meals, 0, MODEL_CONSTANTS.mealsDailyUsd.length - 1),
    };
  }

  function calculateEstimate(input, destinationInput) {
    const values = normalizeInputs(input);
    const destination = typeof destinationInput === "string"
      ? destinationById(destinationInput)
      : (destinationInput ? destinationById(destinationInput.id) : destinationById("japan"));
    const tripScale = destination.multiplier * values.days * values.people;
    const meals = MODEL_CONSTANTS.mealsDailyUsd[values.meals] * tripScale;
    const activities = MODEL_CONSTANTS.activitiesDailyUsd[values.activities] * tripScale;
    const shoppingDaily = MODEL_CONSTANTS.shoppingTimeFactors[values.shoppingTime]
      * MODEL_CONSTANTS.shoppingItemDailyUsd[values.shoppingPrice];
    const shopping = shoppingDaily * tripScale;
    const assumedRideSpend = MODEL_CONSTANTS.assumedLocalRideSpendDailyUsd * tripScale;
    const tips = meals * destination.tipRates.meals
      + activities * destination.tipRates.activities
      + assumedRideSpend * destination.tipRates.rides;
    const subtotal = meals + activities + shopping + tips;
    const miscellaneous = subtotal * MODEL_CONSTANTS.miscellaneousRate;
    const total = subtotal + miscellaneous;
    return {
      inputs: values,
      destination,
      meals,
      activities,
      shopping,
      tips,
      subtotal,
      miscellaneous,
      total,
      perPersonPerDay: total / values.days / values.people,
    };
  }

  function calculateTripEstimate(input, legs) {
    const safeLegs = Array.isArray(legs) && legs.length
      ? legs
      : [{ destinationId: "guadalajara-mexico", days: 1 }];
    const legEstimates = safeLegs.map((leg) => calculateEstimate(
      { ...input, days: leg.days },
      destinationById(leg.destinationId),
    ));
    const categoryKeys = ["meals", "activities", "shopping", "tips", "subtotal", "miscellaneous", "total"];
    const totals = Object.fromEntries(categoryKeys.map((key) => [
      key,
      legEstimates.reduce((sum, estimate) => sum + estimate[key], 0),
    ]));
    const totalDays = legEstimates.reduce((sum, estimate) => sum + estimate.inputs.days, 0);
    const people = legEstimates[0].inputs.people;
    return {
      ...totals,
      legs: legEstimates,
      totalDays,
      people,
      perPersonPerDay: totals.total / totalDays / people,
    };
  }

  function buildRecommendation(estimate) {
    const { destination, total } = estimate;
    const scopeLabel = estimate.scopeLabel || destination.name;
    let cashNeed;
    let headline;
    let summary;
    const actions = [];

    if (destination.acceptance === "card-friendly") {
      cashNeed = total < 200 ? Math.min(50, total * 0.15) : Math.min(100, Math.max(50, total * 0.08));
      headline = "Lead with a card";
      summary = `Of the ${formatUsd(total)} subtotal for ${scopeLabel}, plan to pay nearly everything with a no-foreign-transaction-fee card and carry about ${formatUsd(cashNeed)} in cash for tips and small vendors.`;
      actions.push(
        ["Cash plan", "Make one bank-affiliated ATM withdrawal on arrival; avoid repeated small withdrawals."],
        ["Card plan", "Carry a backup card separately and always choose the local currency at the terminal."],
      );
    } else if (destination.acceptance === "mixed") {
      cashNeed = estimate.meals * MODEL_CONSTANTS.cashShare.mixedMeals
        + estimate.activities * MODEL_CONSTANTS.cashShare.mixedActivities
        + estimate.shopping * MODEL_CONSTANTS.cashShare.mixedShopping
        + (estimate.tips || 0) * 0.8
        + estimate.miscellaneous * MODEL_CONSTANTS.cashShare.mixedMiscellaneous;
      headline = "Use both cash and card";
      summary = `Set aside about ${formatUsd(cashNeed)} in cash for ${scopeLabel}—${Math.round(cashNeed / total * 100)}% of that ${formatUsd(total)} subtotal. Use it for cash-heavy meals, shopping, and smaller merchants.`;
      actions.push(
        ["Cash plan", "Withdraw from bank-affiliated ATMs every few days instead of carrying all of this cash at once."],
        ["Card plan", "Use a no-fee card at established businesses; decline dynamic currency conversion."],
      );
    } else {
      cashNeed = total * MODEL_CONSTANTS.cashShare.cashHeavy;
      headline = "Plan around cash";
      summary = `Plan on roughly ${formatUsd(cashNeed)} in cash for ${scopeLabel}—${Math.round(MODEL_CONSTANTS.cashShare.cashHeavy * 100)}% of that ${formatUsd(total)} subtotal.`;
      actions.push(
        ["Carry safely", "Split reserves between bags or people, keep the bulk in a hidden pouch, and carry only one day's spend in your wallet."],
        ["Get cash wisely", "Use bank ATMs or exchange USD/EUR at banks—not airport or hotel counters—and plan around daily ATM limits."],
      );
    }

    let amountBand;
    if (cashNeed < 200) {
      amountBand = "small";
      actions.push(["Keep it simple", "This is a modest cash need: one withdrawal and a secure everyday wallet should be enough."]);
    } else if (cashNeed > 1000) {
      amountBand = "high";
      actions.push(["Do not carry it all", "Your estimated cash need exceeds $1,000. Use staggered ATM withdrawals and never carry the full amount at once."]);
    } else {
      amountBand = "moderate";
      actions.push(["Limit exposure", "Replenish every few days and keep backup cash and cards in separate secure places."]);
    }

    return { cashNeed, amountBand, headline, summary, actions };
  }

  function formatUsd(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  }

  function formatLocal(value, destination) {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `${destination.symbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue)} ${destination.currency}`;
  }

  function getTailoredNotes(destination) {
    const countryKey = {
      Japan: "japan",
      "United States": "us",
      Mexico: "mexico",
      France: "france",
      Egypt: "egypt",
      Thailand: "thailand",
      Vietnam: "vietnam",
      India: "india",
      Cambodia: "cambodia",
      Türkiye: "turkey",
      Brazil: "brazil",
    }[destination.country] || destination.id;
    const tipNotes = {
      japan: "Tipping is generally not customary in Japan and may cause confusion.",
      us: "Tips of roughly 18–25% are customary at full-service restaurants in the United States.",
      mexico: "Small tips are customary for restaurant service, guides, and hotel staff in Mexico.",
      france: "Service is included by law in France; rounding up or leaving a few euros is optional for good service.",
      egypt: "Small, frequent tips (baksheesh) are customary, so keep low-denomination notes available.",
      thailand: "Tipping is not obligatory, though rounding up and modest tips in tourist settings are appreciated.",
    };
    const visaNotes = {
      vietnam: "Vietnam often requires advance visa or e-visa planning; verify the rule for your passport before booking.",
      india: "Many visitors need an Indian e-visa before arrival; verify eligibility and apply only through the official portal.",
      cambodia: "Cambodia offers visas on arrival or e-visas to many nationalities; carry the required documents and fee.",
      turkey: "Türkiye entry rules vary by passport, and some travelers need an e-visa before departure.",
      brazil: "Brazil's visa rules have changed recently for some nationalities; check official requirements close to travel.",
    };
    return {
      tip: tipNotes[countryKey]
        || `Tipping customs vary in ${destination.name}; check local norms and whether service is already included.`,
      visa: visaNotes[countryKey]
        || `Check ${destination.name}'s official entry and visa rules for your passport; requirements can change.`,
    };
  }

  async function getExchangeData(options) {
    const forceOffline = Boolean(options && options.forceOffline);
    const forceRefresh = Boolean(options && options.forceRefresh);
    const storage = options && options.storage;
    const fetcher = options && options.fetcher;
    const now = Date.now();

    if (!forceOffline && !forceRefresh && storage) {
      try {
        const cached = JSON.parse(storage.getItem(CACHE_KEY));
        if (cached && cached.rates && now - cached.cachedAt < CACHE_MAX_AGE_MS) {
          return { ...cached, source: "cache", approximate: false };
        }
      } catch (_error) {
        // Ignore unavailable, blocked, or malformed localStorage.
      }
    }

    if (!forceOffline && fetcher) {
      try {
        const response = await fetcher("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
        if (!response.ok) throw new Error(`Rate API returned ${response.status}`);
        const data = await response.json();
        if (data.result !== "success" || !data.rates || !data.rates.EUR) {
          throw new Error("Rate API returned an invalid payload");
        }
        const live = {
          rates: data.rates,
          timestamp: data.time_last_update_utc || new Date(now).toISOString(),
          cachedAt: now,
          source: "live",
          approximate: false,
        };
        if (storage) {
          try {
            storage.setItem(CACHE_KEY, JSON.stringify(live));
          } catch (_error) {
            // A storage failure must not prevent rates from being used.
          }
        }
        return live;
      } catch (_error) {
        // Continue to explicit offline fallback.
      }
    }

    return {
      rates: FALLBACK_RATES,
      timestamp: "Built-in July 2026 planning estimate",
      cachedAt: now,
      source: "fallback",
      approximate: true,
    };
  }

  class ExchangeRateService {
    constructor({ fetcher, storage, onUpdate, intervalMs, setIntervalFn, clearIntervalFn }) {
      this.fetcher = fetcher;
      this.storage = storage;
      this.onUpdate = onUpdate;
      this.intervalMs = intervalMs || MODEL_CONSTANTS.exchangeRatePollMs;
      this.setIntervalFn = setIntervalFn || setInterval;
      this.clearIntervalFn = clearIntervalFn || clearInterval;
      this.timer = null;
      this.forceOffline = false;
    }

    async refresh(forceRefresh) {
      const data = await getExchangeData({
        fetcher: this.fetcher,
        storage: this.storage,
        forceOffline: this.forceOffline,
        forceRefresh: Boolean(forceRefresh),
      });
      this.onUpdate(data);
      return data;
    }

    async start(forceOffline) {
      this.stop();
      this.forceOffline = Boolean(forceOffline);
      const initial = await this.refresh(false);
      if (!this.forceOffline) {
        this.timer = this.setIntervalFn(() => this.refresh(true), this.intervalMs);
      }
      return initial;
    }

    stop() {
      if (this.timer !== null) {
        this.clearIntervalFn(this.timer);
        this.timer = null;
      }
    }
  }

  const core = {
    MODEL_CONSTANTS,
    DESTINATIONS,
    REGIONS,
    LOCATIONS,
    FALLBACK_RATES,
    normalizeInputs,
    calculateEstimate,
    calculateTripEstimate,
    buildRecommendation,
    getExchangeData,
    ExchangeRateService,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }
  root.TravelCalculatorCore = core;

  if (typeof document === "undefined") return;

  const elements = {
    form: document.querySelector("#trip-form"),
    legsContainer: document.querySelector("#legs-container"),
    addLeg: document.querySelector("#add-leg"),
    people: document.querySelector("#people"),
    shoppingTime: document.querySelector("#shopping-time"),
    shoppingPrice: document.querySelector("#shopping-price"),
    activities: document.querySelector("#activities"),
    meals: document.querySelector("#meals"),
    totalUsd: document.querySelector("#total-usd"),
    localTotals: document.querySelector("#local-totals"),
    dailyFigure: document.querySelector("#daily-figure"),
    breakdownBody: document.querySelector("#breakdown-body"),
    currencyBadge: document.querySelector("#currency-badge"),
    localColumn: document.querySelector("#local-column"),
    rateStatus: document.querySelector("#rate-status"),
    paymentOverview: document.querySelector("#payment-overview"),
    legRecommendations: document.querySelector("#leg-recommendations"),
  };

  let nextLegId = 2;
  let legs = [
    { id: 1, destinationId: "guadalajara-mexico", days: 4 },
  ];
  let exchangeData = {
    rates: FALLBACK_RATES,
    timestamp: "Built-in July 2026 planning estimate",
    source: "fallback",
    approximate: true,
  };

  function currentInput() {
    return {
      people: elements.people.value,
      shoppingTime: elements.shoppingTime.value,
      shoppingPrice: elements.shoppingPrice.value,
      activities: elements.activities.value,
      meals: elements.meals.value,
    };
  }

  function renderSlider(input, labels, outputId) {
    const value = Number(input.value);
    document.querySelector(`#${outputId}`).textContent = labels[value];
    document.querySelectorAll(`[data-choice-input="${input.id}"]`).forEach((button) => {
      const selected = Number(button.dataset.choiceValue) === value;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(selected));
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function appendLocationOptions(select, selectedId) {
    const countries = [...new Set(LOCATIONS.map((location) => location.country))].sort();
    countries.forEach((country) => {
      const group = document.createElement("optgroup");
      group.label = country;
      LOCATIONS
        .filter((location) => location.country === country)
        .sort((a, b) => {
          if (a.countrywide) return -1;
          if (b.countrywide) return 1;
          return a.name.localeCompare(b.name);
        })
        .forEach((location) => {
          const option = document.createElement("option");
          option.value = location.id;
          option.textContent = location.countrywide ? `${country} — countrywide` : location.name;
          option.selected = location.id === selectedId;
          group.append(option);
        });
      select.append(group);
    });
  }

  function renderLegControls() {
    const cards = legs.map((leg, index) => {
      const location = destinationById(leg.destinationId);
      const card = document.createElement("article");
      card.className = "leg-card";
      card.dataset.legId = leg.id;

      const header = document.createElement("div");
      header.className = "leg-card-header";
      const number = document.createElement("span");
      number.className = "leg-number";
      number.textContent = `Leg ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-leg-button";
      remove.dataset.removeLeg = leg.id;
      remove.textContent = "Remove";
      remove.disabled = legs.length === 1;
      header.append(number, remove);

      const fields = document.createElement("div");
      fields.className = "leg-fields";
      const locationField = document.createElement("div");
      const locationLabel = document.createElement("label");
      locationLabel.htmlFor = `leg-location-${leg.id}`;
      locationLabel.textContent = "City, region, or country";
      const selectWrap = document.createElement("div");
      selectWrap.className = "select-wrap";
      const select = document.createElement("select");
      select.id = `leg-location-${leg.id}`;
      select.className = "leg-destination";
      select.dataset.legId = leg.id;
      appendLocationOptions(select, leg.destinationId);
      selectWrap.append(select);
      locationField.append(locationLabel, selectWrap);

      const daysField = document.createElement("div");
      const daysLabel = document.createElement("label");
      daysLabel.htmlFor = `leg-days-${leg.id}`;
      daysLabel.textContent = "Days";
      const days = document.createElement("input");
      days.id = `leg-days-${leg.id}`;
      days.className = "leg-days";
      days.dataset.legId = leg.id;
      days.type = "number";
      days.min = "1";
      days.max = "365";
      days.step = "1";
      days.inputMode = "numeric";
      days.value = leg.days;
      daysField.append(daysLabel, days);
      fields.append(locationField, daysField);

      const meta = document.createElement("p");
      meta.className = "leg-meta";
      meta.dataset.legMeta = leg.id;
      meta.textContent = `${location.currency} · ${location.acceptance.replace("-", " ")} · ${location.multiplier.toFixed(2)}× US baseline`;
      card.append(header, fields, meta);
      return card;
    });
    elements.legsContainer.replaceChildren(...cards);
  }

  function createActionItems(actions) {
    return actions.map(([title, text]) => {
      const item = document.createElement("div");
      item.className = "action-item";
      const strong = document.createElement("strong");
      strong.textContent = title;
      item.append(strong, document.createTextNode(text));
      return item;
    });
  }

  function render() {
    const estimate = calculateTripEstimate(currentInput(), legs);

    renderSlider(elements.shoppingTime, SLIDER_LABELS.shoppingTime, "shopping-time-value");
    renderSlider(elements.shoppingPrice, SLIDER_LABELS.shoppingPrice, "shopping-price-value");
    renderSlider(elements.activities, SLIDER_LABELS.activities, "activities-value");
    renderSlider(elements.meals, SLIDER_LABELS.meals, "meals-value");

    elements.totalUsd.textContent = formatUsd(estimate.total);
    elements.dailyFigure.textContent = formatUsd(estimate.perPersonPerDay);
    elements.currencyBadge.textContent = `${estimate.legs.length} ${estimate.legs.length === 1 ? "leg" : "legs"}`;
    elements.localColumn.textContent = "Local by leg";

    elements.localTotals.replaceChildren(...estimate.legs.map((legEstimate, index) => {
      const destination = legEstimate.destination;
      const rate = exchangeData.rates[destination.currency] || FALLBACK_RATES[destination.currency] || 1;
      const line = document.createElement("div");
      line.className = "local-total-line";
      const label = document.createElement("span");
      const amount = document.createElement("strong");
      label.textContent = `${index + 1}. ${destination.name}`;
      amount.textContent = formatLocal(legEstimate.total * rate, destination);
      line.append(label, amount);
      return line;
    }));

    const rows = [
      ["Meals", estimate.meals],
      ["Activities", estimate.activities],
      ["Shopping & gifts", estimate.shopping],
      ["Tips & service", estimate.tips],
      ["Misc. buffer (10%)", estimate.miscellaneous],
    ];
    elements.breakdownBody.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      const usdCell = document.createElement("td");
      const localCell = document.createElement("td");
      labelCell.textContent = label;
      usdCell.textContent = formatUsd(value);
      const categoryKey = {
        Meals: "meals",
        Activities: "activities",
        "Shopping & gifts": "shopping",
        "Tips & service": "tips",
        "Misc. buffer (10%)": "miscellaneous",
      }[label];
      localCell.textContent = estimate.legs.map((legEstimate) => {
        const destination = legEstimate.destination;
        const rate = exchangeData.rates[destination.currency] || FALLBACK_RATES[destination.currency] || 1;
        return formatLocal(legEstimate[categoryKey] * rate, destination);
      }).join(" · ");
      row.append(labelCell, usdCell, localCell);
      return row;
    }));

    const timestamp = exchangeData.timestamp instanceof Date
      ? exchangeData.timestamp.toLocaleString()
      : exchangeData.timestamp;
    const currencies = [...new Set(estimate.legs.map((leg) => leg.destination.currency))];
    const rateList = currencies.map((currency) => {
      const rate = exchangeData.rates[currency] || FALLBACK_RATES[currency] || 1;
      return `1 USD = ${rate.toLocaleString()} ${currency}`;
    }).join(" · ");
    if (exchangeData.approximate) {
      elements.rateStatus.textContent = `${rateList} · approximate, offline rate · ${timestamp}`;
      elements.rateStatus.classList.add("warning");
    } else {
      const sourceLabel = exchangeData.source === "cache" ? "cached live rate" : "live rate";
      elements.rateStatus.textContent = `${rateList} · ${sourceLabel} · updated ${timestamp} · refreshes every 15 min`;
      elements.rateStatus.classList.remove("warning");
    }

    const recommendationGroups = new Map();
    estimate.legs.forEach((legEstimate) => {
      const destination = legEstimate.destination;
      const key = `${destination.country}|${destination.currency}|${destination.acceptance}`;
      if (!recommendationGroups.has(key)) {
        recommendationGroups.set(key, {
          destination: { ...destination, name: destination.country },
          names: [],
          notes: [],
          meals: 0,
          activities: 0,
          shopping: 0,
          tips: 0,
          miscellaneous: 0,
          total: 0,
        });
      }
      const group = recommendationGroups.get(key);
      group.names.push(destination.name);
      group.notes.push(`${destination.name}: ${destination.note}`);
      ["meals", "activities", "shopping", "tips", "miscellaneous", "total"]
        .forEach((category) => { group[category] += legEstimate[category]; });
    });

    const recommendationPlans = [...recommendationGroups.values()].map((group) => {
      group.scopeLabel = group.names.join(" and ");
      return { group, recommendation: buildRecommendation(group) };
    });
    const totalCashNeed = recommendationPlans
      .reduce((sum, plan) => sum + plan.recommendation.cashNeed, 0);
    elements.paymentOverview.textContent = `Across the full ${formatUsd(estimate.total)} trip estimate, plan for approximately ${formatUsd(totalCashNeed)} in cash (${Math.round(totalCashNeed / estimate.total * 100)}% overall). The allocations below show exactly which legs each amount covers.`;

    elements.legRecommendations.replaceChildren(...recommendationPlans.map(({ group, recommendation }) => {
      const destination = group.destination;
      const card = document.createElement("article");
      card.className = "leg-recommendation";
      const header = document.createElement("div");
      header.className = "leg-recommendation-header";
      const title = document.createElement("h3");
      title.textContent = `${destination.name} — ${recommendation.headline}`;
      const badge = document.createElement("span");
      badge.className = "acceptance-badge";
      badge.textContent = destination.acceptance.replace("-", " ");
      header.append(title, badge);
      const summary = document.createElement("p");
      summary.className = "payment-summary";
      summary.textContent = recommendation.summary;
      const coverage = document.createElement("p");
      coverage.className = "recommendation-coverage";
      coverage.textContent = `Covers: ${group.names.join(", ")}`;
      const actions = document.createElement("div");
      actions.className = "payment-actions";
      actions.append(...createActionItems(recommendation.actions));
      const note = document.createElement("blockquote");
      note.textContent = group.notes.join(" ");
      card.append(header, coverage, summary, actions, note);
      return card;
    }));

    estimate.legs.forEach((legEstimate, index) => {
      const meta = elements.legsContainer.querySelector(`[data-leg-meta="${legs[index].id}"]`);
      if (meta) {
        const destination = legEstimate.destination;
        meta.textContent = `${destination.currency} · ${destination.acceptance.replace("-", " ")} · ${destination.multiplier.toFixed(2)}× US baseline`;
      }
    });
  }

  function clampCountInput(input) {
    if (input.value === "") return;
    input.value = String(clampInteger(input.value, Number(input.min), Number(input.max)));
  }

  function initialize() {
    renderLegControls();
    elements.addLeg.addEventListener("click", () => {
      legs.push({ id: nextLegId, destinationId: "mexico", days: 3 });
      nextLegId += 1;
      renderLegControls();
      render();
    });
    elements.form.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-choice-input]");
      if (!choice) return;
      const input = document.querySelector(`#${choice.dataset.choiceInput}`);
      input.value = choice.dataset.choiceValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    elements.form.addEventListener("input", (event) => {
      if (event.target === elements.people) {
        clampCountInput(event.target);
      }
      if (event.target.matches(".leg-days")) {
        clampCountInput(event.target);
        const leg = legs.find((item) => item.id === Number(event.target.dataset.legId));
        if (leg) leg.days = clampInteger(event.target.value, 1, 365);
      }
      if (event.target.matches(".leg-destination")) {
        const leg = legs.find((item) => item.id === Number(event.target.dataset.legId));
        if (leg) leg.destinationId = event.target.value;
      }
      render();
    });
    elements.form.addEventListener("change", (event) => {
      if (event.target === elements.people || event.target.matches(".leg-days")) {
        if (event.target.value === "") event.target.value = event.target.min;
        clampCountInput(event.target);
      }
      if (event.target.matches(".leg-destination")) {
        const leg = legs.find((item) => item.id === Number(event.target.dataset.legId));
        if (leg) leg.destinationId = event.target.value;
      }
      render();
    });
    elements.legsContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-leg]");
      if (!button || legs.length === 1) return;
      legs = legs.filter((leg) => leg.id !== Number(button.dataset.removeLeg));
      renderLegControls();
      render();
    });

    render();
    const forceOffline = new URLSearchParams(window.location.search).get("offline") === "1";
    const rateService = new ExchangeRateService({
      storage: window.localStorage,
      fetcher: window.fetch.bind(window),
      onUpdate(data) {
        exchangeData = data;
        render();
      },
    });
    rateService.start(forceOffline);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !forceOffline) rateService.refresh(true);
    });
  }

  initialize();
}(typeof globalThis !== "undefined" ? globalThis : this));
