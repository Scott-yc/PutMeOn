import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/domain/trades.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { trades, normalizeTrade } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('API and frontend accept exactly the same trade categories', () => {
  const apiTrades = JSON.parse(
    readFileSync(new URL('../../../shared/trades.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(trades, apiTrades);
});

test('main trade categories are unique regardless of case or spacing', () => {
  const names = trades.map((name) => name.trim().replace(/\s+/g, ' ').toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.equal(trades.filter((name) => name === 'Other').length, 1);
});

test('specialities resolve to one main category, not separate dropdown entries', () => {
  const examples = {
    'Formwork Carpenter': 'Carpenter',
    'Solar Installer': 'Electrician',
    Gasfitter: 'Plumber',
    'Excavator Operator': 'Plant Operator',
    'Backhoe Operator': 'Plant Operator',
    'Concrete Finisher': 'Concreter',
  };
  for (const [speciality, category] of Object.entries(examples)) {
    assert.equal(trades.includes(speciality), false);
    assert.equal(normalizeTrade(speciality), category);
  }
});

test('normalizing main categories never changes their selection', () => {
  for (const category of trades) assert.equal(normalizeTrade(category), category);
});
