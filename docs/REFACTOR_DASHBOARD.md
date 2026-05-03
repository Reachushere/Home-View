# Dashboard Refactor Plan

The `client/src/pages/dashboard.tsx` file is ~42,800 lines and contains the entire `Dashboard` component plus dozens of inner sub-components, helpers, and constant data tables. Splitting it must be done in small, independently-shippable commits because it is the heart of the live Pi app.

## Phases (ordered safest → highest risk)

### Phase 1 — Pure data extraction *(this commit)*
Move constant data maps that have no closure dependencies into their own module(s). Zero behaviour change.
- `client/src/pages/dashboard/courseLevelMaps.ts` — `l1ToL2Map`, `previousLevelMap`, `laterLevelMap`.

### Phase 2 — Pure helper functions
Move pure utility functions (no React/state/closure deps) currently defined inside the component to `client/src/pages/dashboard/helpers/` (date math, string parsing, ET timezone helpers).

### Phase 3 — Standalone tiny inner components *(shipped — commit ad3d8e9d)*
Moved `TermDropdown`, `StrikethroughLabel`, `CourseName` to `client/src/pages/dashboard/inline/`.
Each base component takes its closure deps as props; thin in-component wrappers preserve all call sites verbatim.

### Phase 4 — Dialogs
Most dialogs are already in `client/src/components/`. Any dialog still inline in `dashboard.tsx` (mobile settings, OneDrive reauth modal, etc.) gets pulled into its own file under `client/src/pages/dashboard/dialogs/`.

### Phase 5 — Calendar grid sections
The biggest payoff but the highest risk. Each row type becomes its own component receiving the day window + tasks as props:
- `OtherRow.tsx`
- `CourseRow.tsx`
- `TimeColumn.tsx`
- `WeekHeader.tsx`

### Phase 6 — Top-level layout
Move floating UI (StartMyDayButton wrappers, ticker bars, weather widget) into discrete components under `client/src/pages/dashboard/widgets/`.

## Rules

- Each commit must build cleanly in Replit dev (`tsc` clean).
- Each commit pushed standalone via `/tmp/push.cjs` so Pi can pull/build/restart between phases.
- No behaviour changes inside any extraction — pure code motion only.
- If a single phase touches >2,000 lines, split it further before pushing.
