import { isCalendarDate } from '../../domain/workDates';
const month = new Intl.DateTimeFormat('en-AU', { month: 'short', timeZone: 'UTC' });
function parts(value: string) {
  return {
    day: Number(value.slice(8, 10)),
    month: month.format(new Date(value + 'T00:00:00Z')),
    year: value.slice(0, 4),
  };
}
export function formatDateRange(from: string, to: string): string {
  if (!isCalendarDate(from) || !isCalendarDate(to)) return 'Dates unavailable';
  const start = parts(from);
  const end = parts(to);
  if (from === to) return `${start.day} ${start.month} ${start.year}`;
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${start.day}–${end.day} ${end.month} ${end.year}`;
  if (start.year === end.year)
    return `${start.day} ${start.month} – ${end.day} ${end.month} ${end.year}`;
  return `${start.day} ${start.month} ${start.year} – ${end.day} ${end.month} ${end.year}`;
}
