/**
 * Format a date to Israeli format: DD/MM/YYYY
 */
export function formatDateIL(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format a date with time to Israeli format: DD/MM/YYYY HH:mm
 */
export function formatDateTimeIL(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format time only: HH:mm (24h)
 */
export function formatTimeIL(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
