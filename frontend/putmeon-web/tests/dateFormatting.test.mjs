import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { moduleUrl } from './helpers/loadModule.mjs';
const { formatDateRange } = await import(
  moduleUrl(fileURLToPath(new URL('../src/shared/formatting/dates.ts', import.meta.url)))
);
test('date ranges stay readable across month and year boundaries', () => {
  assert.equal(formatDateRange('2026-09-14', '2026-09-29'), '14–29 Sept 2026');
  assert.equal(formatDateRange('2026-09-30', '2026-10-02'), '30 Sept – 2 Oct 2026');
  assert.equal(formatDateRange('2026-12-31', '2027-01-02'), '31 Dec 2026 – 2 Jan 2027');
  assert.equal(formatDateRange('2026-10-02', '2026-10-02'), '2 Oct 2026');
  assert.equal(formatDateRange('2026-02-30', '2026-03-01'), 'Dates unavailable');
});
