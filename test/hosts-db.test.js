import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  createHost,
  duplicateHost,
  ensureHostsSchema,
  exportHosts,
  listHosts,
  moveHost,
  removeHost,
  restoreHosts,
  setDefaultHost,
  toggleHost,
  updateHost,
} from '../src/hosts.js';

let miniflare;
let env;

const data = (remark, address, overrides = {}) => ({
  remark,
  address,
  port: 443,
  hostHeader: 'worker.example',
  sni: 'worker.example',
  path: '/',
  security: 'tls',
  fingerprint: 'chrome',
  alpn: 'http/1.1',
  allowInsecure: false,
  enabled: true,
  includeInSubscription: true,
  isDefault: false,
  sortOrder: 10,
  ...overrides,
});

before(async () => {
  miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    d1Databases: ['DB'],
  }));
  env = { DB: await miniflare.getD1Database('DB') };
  await ensureHostsSchema(env);
});

after(async () => {
  await miniflare?.dispose();
});

test('host schema migrates without creating rows', async () => {
  assert.deepEqual(await listHosts(env), []);
});

test('host CRUD, default repair, visibility, duplicate, and ordering', async () => {
  const first = await createHost(env, data('Primary', '104.16.1.1'));
  const second = await createHost(env, data('Backup', '104.17.1.1', { sortOrder: 20 }));
  assert.ok(first.id);
  assert.ok(second.id);
  assert.equal(first.is_default, 1);

  await toggleHost(env, first.id);
  let rows = await listHosts(env);
  assert.equal(rows.find((row) => row.id === first.id).enabled, 0);
  assert.equal(rows.find((row) => row.id === second.id).is_default, 1);

  await setDefaultHost(env, first.id);
  rows = await listHosts(env);
  assert.equal(rows.find((row) => row.id === first.id).enabled, 1);
  assert.equal(rows.find((row) => row.id === first.id).is_default, 1);

  await updateHost(env, second.id, data('Backup edited', '104.17.1.2', {
    includeInSubscription: false,
    path: '/cdn',
    sortOrder: 20,
  }));
  const visible = await listHosts(env, { enabledOnly: true, subscriptionOnly: true });
  assert.deepEqual(visible.map((row) => row.remark), ['Primary']);

  const copy = await duplicateHost(env, first.id);
  assert.ok(copy.id);
  assert.notEqual(copy.id, first.id);
  assert.match(copy.remark, /Copy$/u);

  await moveHost(env, copy.id, 'up');
  rows = await listHosts(env);
  assert.equal(rows[1].id, copy.id);

  await removeHost(env, first.id);
  rows = await listHosts(env);
  assert.equal(rows.some((row) => row.id === first.id), false);
  assert.equal(rows.filter((row) => row.is_default).length, 1);
});

test('host backup restores all host fields', async () => {
  const backup = await exportHosts(env);
  assert.ok(backup.length >= 2);
  const result = await restoreHosts(env, backup);
  assert.equal(result.hosts, backup.length);
  const restored = await exportHosts(env);
  assert.equal(restored.length, backup.length);
  assert.deepEqual(
    restored.map((row) => [row.remark, row.address, row.path, row.include_in_subscription]),
    backup.map((row) => [row.remark, row.address, row.path, row.include_in_subscription]),
  );
});
