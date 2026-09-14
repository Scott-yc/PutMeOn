import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function files(dir) {
  if (dir instanceof URL) dir = fileURLToPath(dir);
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
test('domain stays independent of React, browser storage and UI', () => {
  for (const path of files(new URL('../src/domain', import.meta.url))) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      /from ['"]react|localStorage|sessionStorage|\bdocument\.|\bwindow\.|\.\.\/(?:features|state|data|app|shared)/,
      path,
    );
  }
});
test('feature pages do not mutate database collections or access browser storage', () => {
  for (const path of files(new URL('../src/features', import.meta.url)).filter((p) =>
    p.endsWith('Page.tsx'),
  )) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      /localStorage|sessionStorage|\bupdate\(db|posts:\s*\[|profiles:\s*\[/,
      path,
    );
  }
});
