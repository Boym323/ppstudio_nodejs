# ADR 0089: Prague Time DST Handling In Booking And Planner

## Status
Accepted (historické rozhodnutí s revizí výkladu k 2026-11-02)

## Current implementation
The only production availability planner is FullCalendar with per-selection autosave, described in [ADR 0118](0118-fullcalendar-planner-autosave-v1.md) and [AVAILABILITY_PLANNER.md](../AVAILABILITY_PLANNER.md). Its write path validates local Prague dates and selection cells. Historical copy-day/copy-week actions described below are no longer available in the production UI or the planner server action.

## Context
PP Studio stores instants in Prisma `DateTime`, but salon-facing workflows must preserve local wall-clock time in `Europe/Prague`. DST transitions make millisecond day shifts risky: copying a 09:00-10:00 availability interval across March or October can become 10:00-11:00 or 08:00-09:00 locally if the source offset differs from the target offset.

## Decision
Planner creation derives slot bounds from `dateKey + cell index` through `getCellRangeBounds(...)`. At the time of the original decision, a **now-retired** copy-day/copy-week workflow re-projected source cells into target local dates instead of shifting UTC milliseconds. This is historical context, **not** a description of actions available in today's FullCalendar planner.

Formatting for salon-facing admin, public booking, e-mail and ICS output must use `timeZone: "Europe/Prague"`. We intentionally do not use hard-coded `+01:00` / `+02:00` offsets because they fail at DST boundaries and can drift from future tz database rules.

## Consequences
- DB model and routes remain unchanged.
- No new dependency is introduced.
- Public catalog continues to return UTC ISO instants; clients render them as Prague local salon time.
- Stejný Prague wall-clock převod musí používat i client-side admin preview pro ručně zadaný termín rezervace nebo přesunu, ne jen serverové uložení a planner read model.
- E-mail and ICS keep Prague wall-clock appointment time while still storing absolute instants.
- Current QA must create and inspect equivalent local slot times independently on winter/summer dates, navigate weeks/days around the last Sunday of March and October, and verify public booking, email and ICS. Do not test the removed copy-day/copy-week UI.
