# Agent Guide — Local Loop Merseyside Finance & Growth Model

This document is written for AI agents that need to edit, extend, or document this codebase without reading every file. It describes what the application does, how it is structured, what is safe to change, and what must not be touched.

---

## What this application is

A **static React single-page application** that models the financial and membership growth of Local Loop Merseyside — a mutual credit clearing cooperative for SMEs in the Liverpool City Region. It projects monthly revenue, costs, and operating surplus over a 60-month horizon under three scenario presets (Conservative, Base Case, Ambitious), with all assumptions editable in real time.

The application is **purely client-side**. There is no backend, no database, and no API calls. All computation happens in the browser.

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Routing | Wouter (not React Router) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| Build | Vite 7 |
| Package manager | pnpm |

---

## Directory structure

```
client/
  src/
    App.tsx                  ← Route definitions (Wouter Switch/Route)
    index.css                ← Global design tokens and theme variables
    main.tsx                 ← React entry point
    lib/
      model.ts               ← THE CORE MODEL — all types, defaults, calculation logic
      export.ts              ← CSV/ZIP download logic
      utils.ts               ← shadcn/ui utility (cn helper)
    components/
      AssumptionsPanel.tsx   ← Left-panel assumption editor (all inputs)
      ForecastChart.tsx      ← 60-month revenue/surplus line chart
      NetworkDensityChart.tsx← Network-density S-curve visualisation
      MilestoneCards.tsx     ← Key milestone summary cards
      RevenueMixTable.tsx    ← Revenue breakdown table
      ScenarioSelector.tsx   ← Conservative / Base / Ambitious preset buttons
      AboutLayout.tsx        ← Shared layout wrapper for all /about/* pages
    pages/
      Home.tsx               ← Main results page (assembles all components)
      About.tsx              ← /about index — model overview
      AboutGrowthModel.tsx   ← /about/growth-model
      AboutMembershipTiers.tsx ← /about/membership-tiers
      AboutLoopClearing.tsx  ← /about/loop-clearing
      AboutFanClearing.tsx   ← /about/fan-clearing
      AboutCostsSurplus.tsx  ← /about/costs-and-surplus
      AboutAssumptions.tsx   ← /about/assumptions — full parameter register
      NotFound.tsx           ← 404 page
```

---

## Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | `Home` | Main model interface — assumptions panel + results |
| `/about` | `About` | Model overview and navigation hub |
| `/about/growth-model` | `AboutGrowthModel` | Dual-channel growth model explanation |
| `/about/membership-tiers` | `AboutMembershipTiers` | Five fee bands, dual-fee structure |
| `/about/loop-clearing` | `AboutLoopClearing` | Loop clearing calculation and network-density curve |
| `/about/fan-clearing` | `AboutFanClearing` | Fan clearing calculation and network-density curve |
| `/about/costs-and-surplus` | `AboutCostsSurplus` | Cost structure and break-even |
| `/about/assumptions` | `AboutAssumptions` | Complete parameter register for all three scenarios |

---

## The model — `client/src/lib/model.ts`

This is the single most important file. **Read the JSDoc header block at the top before making any changes.** Everything else in the application is a consumer of this file.

### Key exported types

| Type | Purpose |
|---|---|
| `TierAssumptions` | Parameters for one of the five fee bands |
| `ChannelGrowthAssumptions` | Parameters for one acquisition channel (founder or digital) |
| `GrowthAssumptions` | Container for both channels |
| `NetworkDensityAssumptions` | Shared logistic S-curve parameters for the three network-effect rates |
| `CostAssumptions` | Fixed and variable cost parameters |
| `ModelAssumptions` | Root type — contains growth, tiers, costs, networkDensity |
| `MonthlyResult` / `MonthlyRow` | Output row for one month (alias, used interchangeably) |
| `MilestoneResult` | Output for one named milestone |

### Key exported constants and functions

| Export | Purpose |
|---|---|
| `DEFAULT_TIERS` | Base-case fee band parameters (5 bands) |
| `DEFAULT_GROWTH` | Base-case growth parameters (both channels) |
| `DEFAULT_NETWORK_DENSITY` | Base-case network-density curve parameters |
| `DEFAULT_COSTS` | Base-case cost parameters |
| `DEFAULT_ASSUMPTIONS` | Assembled base-case `ModelAssumptions` object |
| `runModel(assumptions, months?)` | Main calculation — returns `MonthlyResult[]` |
| `getMilestones(results, assumptions)` | Computes milestone cards from model output |
| `getScenarioAssumptions(scenario)` | Returns a full `ModelAssumptions` for `"conservative"`, `"base"`, or `"ambitious"` |

### Calculation flow

```
getScenarioAssumptions(scenario)
  └─ returns ModelAssumptions

runModel(assumptions)
  ├─ runChannelStock(growth.founder, months)   → clearing member stock per month (founder)
  ├─ runChannelStock(growth.digital, months)   → clearing member stock per month (digital)
  ├─ pre-compute maxClearingMembers            → used to calibrate logistic curves
  └─ for each month 1..60:
       ├─ founderRecruited, digitalRecruited   → logisticMembers() (recruited, pay Insight fee)
       ├─ founderClearing, digitalClearing     → from pre-computed stock (pay Clearing fee)
       ├─ activeTradingMembers                 → clearing × activeTradingRate (per channel)
       ├─ effectiveMemberToMemberRate          → networkDensityRate(clearingMembers, ...)
       ├─ effectiveLoopClearingRate            → networkDensityRate(clearingMembers, ...)
       ├─ effectiveFanParticipationRate        → networkDensityRate(clearingMembers, ...)
       └─ for each tier:
            ├─ insightSubscriptionIncome       → recruitedMembers × memberShare × insightFee
            ├─ clearingSubscriptionIncome      → clearingMembers × memberShare × clearingFee
            ├─ loopClearingIncome              → cleared value × loopClearingFeeRate
            └─ fanClearingIncome               → participant-adjusted × fanClearingFeeRate
```

### Network-density curves

The three rates (`memberToMemberRate`, `loopClearingSuccess`, `fanParticipation`) all use the same **two-point calibrated logistic S-curve**:

```
rate(n) = ceiling × σ(k × (n − n_mid))
```

where `n` is the current clearing member count. The curve is pinned to two points:
- **Point A**: `rate = startRate` at `n = clearingMemberThreshold` (default 100 clearing members)
- **Point B**: `rate = 0.95 × ceiling` at `n = maxClearingMembers` (maximum across the 60-month run)

`k` and `n_mid` are derived algebraically from these two constraints. Below the threshold, all three rates are zero. This logic lives entirely in the private `networkDensityRate()` function in `model.ts`.

**Do not change the calibration logic** unless you are also updating the About pages that document it.

---

## Design system

The application uses a **Cooperative Intelligence** design language:

- **Primary palette**: warm teal (`#1a5c5a`), coral accent (`#e8634a`), cream background (`#faf8f4`)
- **Typography**: Fraunces (display/headings), DM Sans (body), DM Mono (numbers/code)
- **Theme**: light mode only — `ThemeProvider` is set to `defaultTheme="light"`
- **Design tokens**: defined in `client/src/index.css` as CSS custom properties under `:root`

Do not change the font imports in `client/index.html` or the `:root` token block in `index.css` without updating all components that depend on them.

---

## What is safe to change

### About pages (`client/src/pages/About*.tsx`)

These are **documentation pages only**. They contain no model logic. You can freely:
- Update numbers, percentages, and descriptions to match the current model values
- Add or remove explanatory paragraphs
- Update tables of assumptions
- Add new sections

When updating, always cross-check values against `DEFAULT_ASSUMPTIONS` and `getScenarioAssumptions()` in `model.ts` — those are the source of truth.

### Scenario assumption values in `model.ts`

The numeric values inside `DEFAULT_TIERS`, `DEFAULT_GROWTH`, `DEFAULT_NETWORK_DENSITY`, `DEFAULT_COSTS`, and the Conservative/Ambitious overrides inside `getScenarioAssumptions()` are safe to update. Follow the existing pattern — each value has an inline comment explaining its meaning and units.

**Always ensure `memberShare` values sum to 1.0 across all five tiers.**

### `export.ts`

Safe to update CSV headers, column order, and the markdown summary text. Do not change the function signatures — they are called from `Home.tsx`.

---

## What must not be changed without full understanding

### `networkDensityRate()` in `model.ts`

The two-point logistic calibration is mathematically precise. Changing it will alter the shape of all three network-density curves across all scenarios and all months. If you change it, you must also update `NetworkDensityChart.tsx` (formula display) and the About pages for loop clearing, fan clearing, and assumptions.

### `runChannelStock()` in `model.ts`

This pre-computes the clearing member stock for each channel using a logistic growth curve with churn. It is called once before the main month loop and its output is indexed by month. Do not change the indexing convention (`stock[m]` for month `m`, 1-indexed).

### `client/src/index.css` — the `@layer base` block

The CSS custom properties in `:root` are consumed by every shadcn/ui component and every Tailwind semantic colour class. Changing a token here changes the entire UI. Only edit this if you are intentionally rebranding.

### `client/index.html` — font imports

Fraunces, DM Sans, and DM Mono are loaded via Google Fonts CDN. Removing or changing these will break the typography across the entire application.

### `App.tsx` — route definitions

Adding a new route is safe. Removing or renaming an existing route will break navigation links in `AboutLayout.tsx`, `NetworkDensityChart.tsx`, and any About page that links to another About page.

---

## How to update assumption values (step-by-step)

1. Open `client/src/lib/model.ts`.
2. Find the relevant constant (`DEFAULT_TIERS`, `DEFAULT_GROWTH`, `DEFAULT_NETWORK_DENSITY`, `DEFAULT_COSTS`) or the scenario override block inside `getScenarioAssumptions()`.
3. Update the numeric value. Keep the inline comment accurate.
4. If `memberShare` values changed, verify they still sum to 1.0 across all five tiers.
5. Open `client/src/pages/AboutAssumptions.tsx` and update the matching table cell(s).
6. If network-density ceilings or start rates changed, also update `AboutLoopClearing.tsx` and `AboutFanClearing.tsx`.
7. Run `npx tsc --noEmit` from the project root to confirm no TypeScript errors.

---

## How to add a new About page

1. Create `client/src/pages/AboutMyTopic.tsx`. Use `AboutLayout` as the wrapper — see any existing About page for the pattern.
2. Add the route in `App.tsx`: `<Route path="/about/my-topic" component={AboutMyTopic} />`.
3. Add a navigation link in `AboutLayout.tsx` (the left sidebar nav array).
4. Add a card on the `About.tsx` index page.

---

## Running the project locally

```bash
cd local-loop-forecast-calculator
pnpm install
pnpm dev          # starts Vite dev server on port 3000
pnpm build        # production build to client/dist/
npx tsc --noEmit  # type-check only
```

---

## Current scenario parameter summary (Base Case)

| Parameter group | Key values |
|---|---|
| Founder channel | Capacity 1,500 · Inflection month 18 · Doubling 6 months · Churn 0.8% · Clearing conversion 90% · Active trading 75% |
| Digital channel | Capacity 6,500 · Inflection month 42 · Doubling 5 months · Churn 2.0% · Clearing conversion 75% · Active trading 55% |
| Member-to-member | Start 8% · Ceiling 25% · Threshold 100 clearing members |
| Loop clearing | Start 6% · Ceiling 15% |
| Fan participation | Start 12% · Ceiling 18% |
| Fixed costs | £11,000/month |
| Variable costs | £3.00/recruited member/month |
| Fee bands | Micro (73%), Mini (16.5%), Small (6%), Medium (3%), Large (1.5%) |
| Insight fees | £2.50 / £5 / £10 / £20 / £40 per band per month |
| Clearing fees | £10 / £15 / £20 / £40 / £60 per band per month |

Conservative and Ambitious variants are defined as overrides on the Base Case inside `getScenarioAssumptions()` in `model.ts`.
