/** FullCalendar hlásí kliknutí také jako select, se stejnou DOM událostí. */
export function claimPlannerGesture(handled: WeakSet<Event>, event: Event | null) {
  if (!event) return true; // Programatický výběr nemá DOM gesto.
  if (handled.has(event)) return false;
  handled.add(event);
  return true;
}
