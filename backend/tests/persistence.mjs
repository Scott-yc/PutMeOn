import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'putmeon-persistence-'));
const base = 'http://127.0.0.1:5082/api';
let server;
async function start() {
  server = spawn(resolve(root, '.tools/dotnet/dotnet.exe'), ['bin/Debug/net10.0/PutMeOn.Api.dll', '--urls', 'http://127.0.0.1:5082'], {
    cwd: resolve(root, 'backend/PutMeOn.Api'),
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', Database__Provider: 'Sqlite', Email__Mode: 'Development', ConnectionStrings__Database: `Data Source=${join(dir, 'test.db')}` },
    stdio: 'ignore', windowsHide: true,
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('Isolated API failed to start');
    try { if ((await fetch(base + '/health')).ok) return; } catch {}
    await delay(100);
  }
  throw Error('API startup timeout');
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill(); await exited;
}
async function request(path, cookie, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-PutMeOn-Request': '1', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${path}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return { data: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(email) {
  const { data } = await request('/auth/code', null, { email });
  return (await request('/auth/verify', null, { email, code: data.developmentCode })).cookie;
}
try {
  await start();
  const sentAt = Date.now();
  const accounts = [];
  for (const [index, trade] of ['Carpenter', 'Cabinet Maker'].entries()) {
    const email = `persistence-${index}@example.com`;
    const cookie = await login(email);
    await request('/profile', cookie, { name: `Persistence ${index}`, phone: '0400000000', trade, location: 'Brisbane', companyName: '' }, 'PUT');
    const from = new Date(Date.now() + 10 * 3600000).toISOString().slice(0,10);
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
    const { data } = await request('/posts', cookie, { kind: 'looking', trade, location: 'Brisbane', rate: 55, from, to, description: 'Isolated persistence regression', companyName: '' });
    const state = (await request('/state?mode=mine', cookie)).data;
    accounts.push({ email, id: state.user.id, postId: data.id });
    await request('/auth/logout', cookie, undefined, 'POST');
    assert.equal((await request('/state', cookie)).data.email, '');
  }
  await stop(); await start();
  console.log('Two accounts posted and logged out; API restarted against the same isolated database. Waiting for normal resend cooldown.');
  await delay(Math.max(0, 62000 - (Date.now() - sentAt)));
  for (const account of accounts) {
    const cookie = await login(account.email);
    const mine = (await request('/state?mode=mine', cookie)).data;
    assert.equal(mine.user.id, account.id);
    assert.deepEqual(mine.posts.map(p => p.id), [account.postId]);
    assert.equal((await request('/state', cookie)).data.posts.length, 2);
    assert.equal((await request('/state?trade=Cabinet%20Maker', cookie)).data.posts.length, 1);
    assert.equal((await request('/state', cookie)).data.posts.length, 2);
  }
  console.log('PASS: both account identities and posts survive logout, process restart and fresh login; filtering never deletes posts.');
} finally { await stop(); }
