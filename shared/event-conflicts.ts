import type { Event } from "./schema";

/**
 * Returns a YYYY-MM-DD key for a given date value.
 * Two events are considered conflicting if they fall on the same calendar day.
 */
export function dayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface EventConflict {
  dayKey: string;
  eventIds: number[];
}

/**
 * Given a list of events and a selection of eventIds, returns an array of
 * conflicts. A conflict is two or more selected events that share the same day.
 */
export function findEventConflicts(
  selectedIds: number[],
  allEvents: Pick<Event, "id" | "name" | "date">[],
): EventConflict[] {
  const groupedByDay = new Map<string, number[]>();

  for (const id of selectedIds) {
    const event = allEvents.find(e => e.id === id);
    if (!event) continue;
    const key = dayKey(event.date);
    if (!key) continue;
    const existing = groupedByDay.get(key) || [];
    existing.push(id);
    groupedByDay.set(key, existing);
  }

  const conflicts: EventConflict[] = [];
  for (const [key, ids] of groupedByDay.entries()) {
    if (ids.length > 1) {
      conflicts.push({ dayKey: key, eventIds: ids });
    }
  }
  return conflicts;
}

/**
 * Formats a list of conflicts into a user-friendly error message.
 */
export function formatConflictError(
  conflicts: EventConflict[],
  allEvents: Pick<Event, "id" | "name" | "date">[],
): string {
  const lines = conflicts.map(conflict => {
    const names = conflict.eventIds
      .map(id => allEvents.find(e => e.id === id)?.name || `Event ${id}`)
      .join(", ");
    return `${conflict.dayKey}: ${names}`;
  });
  return `Event date conflict — the following events overlap on the same day:\n${lines.join("\n")}`;
}
