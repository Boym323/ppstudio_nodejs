# Schedule Optimization Migration

## Fixed product rules

- Auto lunch is exactly 45 minutes, in `Europe/Prague`.
- Candidate starts are `11:00`, `11:15`, …, `13:00`; a candidate may end at `13:45`.
- Lunch is derived from current reservations and published availability. It is never stored as a DB booking or fixed block.
- Existing bookings are never moved. Booking, reschedule and cancellation may therefore change the selected lunch position.
- Cleanup is part of a booking block for occupancy and feasibility.
- A public booking must not consume the last feasible 45-minute lunch on an active lunch-policy day.
- Smart optimization may only reorder the “Doporučené termíny” section. It must not remove valid terms, change authoritative validation, or move a customer across dates merely for efficiency.
- No ML, solver, external service, FullCalendar replacement, or npm dependency.

## Current architecture

- `getPublicBookingCatalog` loads published availability and active bookings. Bookings are exposed as `bookedIntervals` with `endsAt = blockedUntil ?? scheduledEndsAt`, using a cleanup lookahead.
- `buildSlotTimeOptions` creates the public options. Normal candidates use a 30-minute step; quarter-hour candidates are added after booking ends and before booking starts, rounded with `ceilToQuarterHour`/`floorToQuarterHour`.
- `booking-flow.tsx` derives `selectableTimeOptions` by filtering disabled options. `suggestedSlots` is currently chronological: `selectableTimeOptions.slice(0, 6)`.
- `buildSlotTimeOptions` treats `slot.capacity` as available capacity, but the create engine currently enforces the single-resource invariant with `allowedCapacity = 1`. Reschedule uses the minimum coverage capacity when no override is active.
- `scheduledEndsAt` is the client-visible service end. `blockedUntil` is the occupancy end including cleanup; a null `blockedUntil` falls back to `scheduledEndsAt`. Planner queries and public catalog use the blocked end for conflicts.
- Public create enters `createPublicBooking` with `allowManualOverride: false` and reaches `createBookingWithEngine`. The authoritative availability, overlap, capacity and slot checks happen inside a Serializable transaction after fresh reads and slot locking.
- Public reschedule goes through `reschedulePublicBookingByToken` and the same transactional `rescheduleBooking` path. Client-originated manual override is rejected. Admin reschedule uses the same engine and may create an internal exception when explicitly permitted by the existing policy.
- Admin manual booking uses `createManualBooking`; slot mode passes `allowManualOverride: false`, while explicit manual mode passes `true`. The existing UI already reports a manual-override warning.
- `PlannerWeekData` contains both minute ranges (`availableBlocks`, `cleanupBlocks`, bookings' service minutes) and cell ranges. `queries.ts` composes availability, bookings and cleanup using the blocked end. The FullCalendar adapter renders bookings and cleanup on 30-minute cells, while `displayAvailableIntervals` can preserve 15-minute read-only ranges. A 45-minute domain event can therefore be represented exactly in ISO `start`/`end` data, but the current calendar-cell editing/visual model must not be used as the domain source of truth.

## Lunch activation rule

The policy is active for a local Prague date only when the merged published availability for that date:

1. contains at least one contiguous 45-minute interval whose start is between `11:00` and `13:00`, and
2. has published availability extending past `13:00` local time.

The second condition deliberately prevents a short morning schedule ending at noon from being blocked by lunch. It is derived from published availability, not from bookings or a guessed working-day template. If the rule is inactive, no lunch feasibility check or lunch-preservation constraint is applied. If active, every public candidate must leave at least one feasible lunch candidate after the hypothetical booking. All date and DST calculations use Prague-local date/time conversion at the boundary, with instants passed to the pure engine.

## Invariants

- Lunch is a computed explanation/result, never persisted as a concrete time.
- Lunch feasibility is evaluated against the same blocked intervals used for booking occupancy.
- The optimizer never mutates availability, bookings, or the valid-term set.
- Existing booking/business rules remain unchanged outside this feature.
- Authoritative validation remains server-side and is repeated on fresh transactional data.
- Date-first ordering is preserved; ranking is only a bounded reorder within a safe date horizon.
- `scheduledEndsAt` remains service end; `blockedUntil` remains service end plus cleanup.

## Pure engine API

Add conceptually `src/features/booking/lib/booking-schedule-optimization.ts`. It must contain pure, deterministic functions and no Prisma, React, FullCalendar or env imports:

```ts
type Interval = { startsAt: number; endsAt: number };
type LunchCandidate = { startsAt: number; endsAt: number };
type BookingBlock = Interval & { capacity?: number };

generateLunchCandidates(input: {
  localDate: string; timeZone: "Europe/Prague";
  availability: Interval[]; stepMinutes: 15;
}): LunchCandidate[]; // exact 11:00..13:00, 45 minutes

evaluateLunchFeasibility(input: {
  lunchCandidates: LunchCandidate[]; bookedBlocks: BookingBlock[];
  hypotheticalBlock?: Interval; capacity: number;
}): { feasible: boolean; candidates: LunchCandidate[] };

chooseBestLunchCandidate(input: {
  candidates: LunchCandidate[]; bookedBlocks: BookingBlock[];
  availability: Interval[]; capacity: number;
}): LunchCandidate | null;

measureFragmentation(input: {
  freeIntervals: Interval[]; availability: Interval[];
  bookingBlocks: Interval[]; serviceDurationsMinutes: number[];
}): {
  fragmentCount: number; largestFreeBlockMinutes: number;
  orphanMinutes: number; bookingAdjacencyMinutes: number;
  availabilityEdgeMinutes: number; usableServiceBlockMinutes: number;
};

rankBookingCandidates(input: {
  candidates: Array<{ dateKey: string; startsAt: number; endsAt: number }>;
  evaluate: (candidate: Interval) => { lunch: LunchCandidate | null; metrics: ReturnType<typeof measureFragmentation> };
  safeDateHorizon: number;
}): typeof input.candidates;
```

The implementation may use integer minutes/epoch milliseconds internally, but must document the conversion boundary and stable tie-breakers. The authoritative layer should call the same feasibility function after loading fresh intervals; it must not trust a client-provided lunch result.

## Public booking integration

The catalog/flow should compute lunch-aware selectable options after normal service duration and cleanup expansion, before date grouping. The UX filter removes only options that would make an active-day lunch infeasible. `selectableTimeOptions` remains the complete filtered set; suggested slots consume a ranked view only. Catalog refresh and stale-selection handling must re-run the calculation.

The server must independently apply the lunch rule in `createBookingWithEngine` immediately before the booking write, after fresh slot/booking reads and after the existing overlap/capacity checks have established the hypothetical booking block. A failure returns the existing “termín není dostupný/konflikt” class of result and cannot be bypassed by client input.

## Transaction safety

Inside the existing Serializable transaction, calculate the local date, load the day's published coverage and active booking blocks (including cleanup), evaluate the hypothetical new block, and require a remaining lunch candidate before `booking.create`. Keep slot locking, overlap checks, capacity checks, idempotency checks and retry behavior intact. Reschedule must perform the equivalent check after excluding the booking being moved and before `booking.update`; cancellation needs no lunch write and naturally changes the next computation.

## Reschedule/admin policy

- Public booking: hard lunch constraint; manual override is false.
- Public reschedule: hard lunch constraint; `changedByClient` must never bypass it.
- Admin slot mode: standard lunch constraint (`allowManualOverride: false`).
- Explicit admin manual mode: may bypass lunch only through the existing explicit manual-override path. Preserve the `manualOverride` audit flag and existing warning; if the UI adds a warning, scope it to “this manual term leaves no feasible auto lunch” and require the already existing deliberate manual mode, not a hidden fallback.
- Do not silently convert a failed slot-mode operation into a manual exception.

## Planner integration

The planner should derive a display-only lunch event from the selected current state, alongside existing booking and cleanup events. It must not create an availability slot or booking. Use exact minute/ISO ranges for the domain result; retain 30-minute cells for existing edit affordances and FullCalendar compatibility. A 45-minute lunch must be rendered as a 45-minute event in the adapter's exact range, with no rounding of the optimization input. Availability, booking and cleanup must remain separate source facts so the lunch display cannot be mistaken for a persisted block.

## Smart ranking model

For each valid candidate, simulate `existing blocks + hypothetical booking`, choose the best feasible lunch, then measure the resulting free intervals. Rank by an interpretable lexicographic tuple, in this order:

1. same/earliest date within a small safe date horizon (date-first);
2. lunch feasible, with a stable fallback preserving the existing order;
3. fewer residual fragments;
4. fewer orphan/unbookable minutes;
5. larger largest contiguous free block;
6. more usable blocks for active service durations;
7. stronger adjacency to existing bookings or an availability edge where that closes a fragment;
8. original chronological order as the final tie-breaker.

The initial safe horizon should be the first few already available dates shown by the existing flow, not an unbounded calendar search. The complete chronological/filter-valid list remains available below recommendations. No arbitrary weights are needed; if a scalar is later required, normalize and document each metric and preserve the tuple's date-first constraint.

## Capacity strategy

The data model exposes capacity, but the production create path documents and enforces a single service resource (`allowedCapacity = 1`); this is the relevant first-version domain. Implement lunch feasibility and fragmentation scoring for effective `capacity = 1` first. For `capacity > 1`, preserve existing availability and authoritative capacity behavior and use the current chronological recommendation fallback until a separate capacity-aware policy is specified. Do not collapse or rewrite capacity fields, and do not let a single-resource lunch calculation change general booking capacity semantics.

## Test matrix

- Candidate generation: exact 15-minute starts, 45-minute duration, 11:00/13:00 bounds, Prague DST and local-date boundaries.
- Activation: day ending at noon inactive; day extending past 13:00 with a valid 45-minute candidate active; split availability and no contiguous lunch candidate inactive.
- Feasibility: booking before, inside and after lunch; cleanup consuming the last candidate; cancellation restoring a candidate; existing booking never moved.
- Public UX: filtered options, refresh/stale selection, all valid terms retained, recommendations no longer chronological-only.
- Authoritative create: race for the last lunch position, Serializable retry/conflict, public manual override rejected.
- Public/admin reschedule: exclude moved booking, client hard constraint, admin slot mode hard constraint, explicit manual mode warning and audit flag.
- Capacity: capacity 1 scoring; capacity >1 fallback and unchanged authoritative behavior.
- Planner: exact 45-minute display, cleanup separation, 30-minute cell compatibility, no lunch DB slot.
- Integration targets: public catalog/create, manual booking, public reschedule, admin reschedule, cancellation and planner-week queries.

## Performance guardrails

- Fetch each date's relevant published availability and active booking blocks in bounded batches; never query once per candidate or service.
- Keep the pure engine in-memory and linear or `O(n log n)` after sorting intervals; generate at most 9 lunch candidates per date.
- Reuse the already loaded public catalog where possible and apply one ranking pass per date.
- Do not add a DB lunch entity, materialized block, external call, solver, ML model or dependency.
- Keep the authoritative transaction query bounded to the booking date and retain existing Serializable retries.

## Phase checklist

### Fáze 1

- Freeze the activation rule, interval semantics, capacity decision and error contract.
- Add pure engine types/functions and unit tests only; no integration wiring.

### Fáze 2

- Add a catalog/availability projection that supplies published intervals and blocked booking blocks without N+1 queries.
- Add UX feasibility filtering and preserve the complete term list.

### Fáze 3

- Add the authoritative create check inside `createBookingWithEngine` immediately before write, with race/integration tests.

### Fáze 4

- Apply the equivalent check to transactional reschedule; verify public, admin slot-mode and explicit manual-mode behavior.

### Fáze 5

- Integrate display-only lunch state into `PlannerWeekData`/adapter using exact minute ranges; do not alter FullCalendar library or edit-cell semantics.

### Fáze 6

- Add date-first smart ranking behind the existing recommendation boundary, complete the matrix/performance checks, and compare recommendation output against chronological fallback.

## Global invariants

- No DB representation of a concrete auto-lunch time.
- No FullCalendar library change.
- No ML, solver or dependency.
- Authoritative booking validation remains server-side.
- Cleanup uses the blocked interval.
- Scoring is pure and in-memory.
- No N+1 query.
- Public booking/business rules outside this feature remain unchanged.
