/** Work dates use Brisbane's calendar, independently of 168-hour post expiry. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function brisbaneDate(now: number): string {
  return new Date(now + 10 * 3600000).toISOString().slice(0, 10);
}
