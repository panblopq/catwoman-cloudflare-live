import test from 'node:test';
import assert from 'node:assert/strict';
import { connectPath, normalizeWsPath, rawSub, vlessLink, vlessLinks } from '../src/config.js';

const request = new Request('https://worker.example/sub/token');
const user = {
  username: 'sara',
  uuid: '00112233-4455-6677-8899-aabbccddeeff',
  sub_token: 'private_token_123',
};
const settings = { config_title: 'CatWoman', public_host: 'worker.example' };
const host = {
  id: 1,
  remark: 'Clean IP',
  address: '104.16.10.20',
  port: 8443,
  host_header: 'worker.example',
  sni: 'worker.example',
  path: '/cdn/edge',
  security: 'tls',
  fingerprint: 'firefox',
  alpn: 'h2,http/1.1',
  allow_insecure: 1,
  enabled: 1,
  include_in_subscription: 1,
  is_default: 1,
};

test('host overrides generate a usable VLESS WebSocket endpoint', () => {
  const link = new URL(vlessLink(request, user, settings, host));
  assert.equal(link.hostname, '104.16.10.20');
  assert.equal(link.port, '8443');
  assert.equal(link.searchParams.get('host'), 'worker.example');
  assert.equal(link.searchParams.get('sni'), 'worker.example');
  assert.equal(link.searchParams.get('path'), '/cdn/edge/connect/private_token_123');
  assert.equal(link.searchParams.get('security'), 'tls');
  assert.equal(link.searchParams.get('fp'), 'firefox');
  assert.equal(link.searchParams.get('alpn'), 'h2,http/1.1');
  assert.equal(link.searchParams.get('allowInsecure'), '1');
  assert.match(decodeURIComponent(link.hash), /Clean IP/u);
});

test('IPv6 addresses are wrapped correctly in VLESS URIs', () => {
  const link = new URL(vlessLink(request, user, settings, { ...host, address: '2606:4700::6810:1014' }));
  assert.equal(link.hostname, '[2606:4700::6810:1014]');
});

test('only enabled and visible hosts are included', () => {
  const items = vlessLinks(request, user, settings, [
    host,
    { ...host, id: 2, remark: 'Disabled', enabled: 0 },
    { ...host, id: 3, remark: 'Hidden', include_in_subscription: 0 },
    { ...host, id: 4, remark: 'Second', address: '104.17.2.3', is_default: 0 },
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => item.host.remark), ['Clean IP', 'Second']);
});

test('an existing but hidden host does not fall back to the legacy endpoint', () => {
  const items = vlessLinks(request, user, settings, [{ ...host, include_in_subscription: 0 }]);
  assert.deepEqual(items, []);
  assert.equal(atob(rawSub(request, user, settings, [{ ...host, enabled: 0 }])).trim(), '');
});

test('raw subscription contains one line per active host in order', () => {
  const hosts = [host, { ...host, id: 2, remark: 'Second', address: '104.17.2.3', is_default: 0 }];
  const decoded = atob(rawSub(request, user, settings, hosts)).trim().split('\n');
  assert.equal(decoded.length, 2);
  assert.match(decoded[0], /104\.16\.10\.20/u);
  assert.match(decoded[1], /104\.17\.2\.3/u);
});

test('WebSocket base paths are normalized safely', () => {
  assert.equal(normalizeWsPath('cdn//edge/'), '/cdn/edge');
  assert.equal(connectPath({ path: '/' }, user.sub_token), '/connect/private_token_123');
  assert.equal(connectPath({ path: '/cdn' }, user.sub_token), '/cdn/connect/private_token_123');
});
