# ADR 0089: Prague Time DST Handling In Booking And Planner

## Status
Accepted

## Context
PP Studio stores instants in Prisma `DateTime`, but salon-facing workflows must preserve local wall-clock time in `Europe/Prague`. DST transitions make millisecond day shifts risky: copying a 09:00-10:00 availability interval across March or October can become 10:00-11:00 or 08:00-09:00 locally if the source offset differs from the target offset.

## Decision
Planner creation still derives slot bounds from `dateKey + cell index` through `getCellRangeBounds(...)`. Copy day/week now re-projects each source interval to the target `dateKey` via its local planner cell range instead of adding a millisecond delta between day starts.

Formatting for salon-facing admin, public booking, e-mail and ICS output must use `timeZone: "Europe/Prague"`. We intentionally do not use hard-coded `+01:00` / `+02:00` offsets because they fail at DST boundaries and can drift from future tz database rules.

## Consequences
- DB model and routes remain unchanged.
- No new dependency is introduced.
- Public catalog continues to return UTC ISO instants; clients render them as Prague local salon time.
- E-mail and ICS keep Prague wall-clock appointment time while still storing absolute instants.
- Manual QA should include copying days/weeks around the last Sunday of March and October.
