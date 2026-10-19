let schemaReady = false;

const HOST_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remark TEXT NOT NULL,
    address TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 443,
    host_header TEXT NOT NULL DEFAULT '',
    sni TEXT NOT NULL DEFAULT '',
    path TEXT NOT NULL DEFAULT '/',
    security TEXT NOT NULL DEFAULT 'tls',
    fingerprint TEXT NOT NULL DEFAULT 'chrome',
    alpn TEXT NOT NULL DEFAULT 'http/1.1',
    allow_insecure INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    include_in_subscription INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS ix_hosts_order ON hosts(enabled, sort_order, id)`,
];

export async function ensureHostsSchema(env) {
  if (schemaReady) return;
  await env.DB.batch(HOST_SCHEMA.map((sql) => env.DB.prepare(sql)));
  schemaReady = true;
}

export async function listHosts(env, { enabledOnly = false, subscriptionOnly = false } = {}) {
  await ensureHostsSchema(env);
  const filters = [];
  if (enabledOnly) filters.push('enabled = 1');
  if (subscriptionOnly) filters.push('include_in_subscription = 1');
  const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
  return (await env.DB.prepare(`SELECT * FROM hosts${where} ORDER BY sort_order ASC, id ASC`).all()).results || [];
}

export async function hostById(env, id) {
  await ensureHostsSchema(env);
  return env.DB.prepare('SELECT * FROM hosts WHERE id = ? LIMIT 1').bind(id).first();
}

async function nextOrder(env) {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM hosts').first();
  return Number(row?.next_order || 10);
}

export async function createHost(env, data) {
  await ensureHostsSchema(env);
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM hosts').first();
  const makeDefault = Boolean(data.isDefault) || (Number(count?.count || 0) === 0 && Boolean(data.enabled));
  const now = Date.now();
  const order = Number.isInteger(data.sortOrder) ? data.sortOrder : await nextOrder(env);
  const insert = env.DB.prepare(`INSERT INTO hosts
    (remark, address, port, host_header, sni, path, security, fingerprint, alpn, allow_insecure, enabled, include_in_subscription, is_default, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(data.remark, data.address, data.port, data.hostHeader, data.sni, data.path, data.security, data.fingerprint, data.alpn,
      data.allowInsecure ? 1 : 0, (makeDefault || data.enabled) ? 1 : 0, data.includeInSubscription ? 1 : 0, makeDefault ? 1 : 0, order, now, now);
  let result;
  if (makeDefault) {
    const responses = await env.DB.batch([
      env.DB.prepare('UPDATE hosts SET is_default = 0, updated_at = ? WHERE is_default = 1').bind(now),
      insert,
    ]);
    result = responses[1];
  } else result = await insert.run();
  await repairDefault(env);
  const insertedId = result?.meta?.last_row_id;
  if (insertedId) return hostById(env, insertedId);
  return env.DB.prepare('SELECT * FROM hosts WHERE created_at = ? AND remark = ? ORDER BY id DESC LIMIT 1').bind(now, data.remark).first();
}

export async function updateHost(env, id, data) {
  await ensureHostsSchema(env);
  const now = Date.now();
  const update = env.DB.prepare(`UPDATE hosts SET remark = ?, address = ?, port = ?, host_header = ?, sni = ?, path = ?, security = ?,
    fingerprint = ?, alpn = ?, allow_insecure = ?, enabled = ?, include_in_subscription = ?, is_default = ?, sort_order = ?, updated_at = ? WHERE id = ?`)
    .bind(data.remark, data.address, data.port, data.hostHeader, data.sni, data.path, data.security, data.fingerprint, data.alpn,
      data.allowInsecure ? 1 : 0, data.enabled ? 1 : 0, data.includeInSubscription ? 1 : 0, data.isDefault ? 1 : 0,
      data.sortOrder, now, id);
  if (data.isDefault) {
    await env.DB.batch([
      env.DB.prepare('UPDATE hosts SET is_default = 0, updated_at = ? WHERE id != ? AND is_default = 1').bind(now, id),
      update,
    ]);
  } else await update.run();
  await repairDefault(env);
  return hostById(env, id);
}

async function repairDefault(env) {
  const current = await env.DB.prepare('SELECT id FROM hosts WHERE is_default = 1 AND enabled = 1 LIMIT 1').first();
  if (current) return;
  const candidate = await env.DB.prepare('SELECT id FROM hosts WHERE enabled = 1 ORDER BY sort_order, id LIMIT 1').first();
  if (candidate) await env.DB.prepare('UPDATE hosts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END, updated_at = ?').bind(candidate.id, Date.now()).run();
}

export async function toggleHost(env, id) {
  await ensureHostsSchema(env);
  await env.DB.prepare('UPDATE hosts SET enabled = CASE enabled WHEN 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').bind(Date.now(), id).run();
  await repairDefault(env);
  return hostById(env, id);
}

export async function setDefaultHost(env, id) {
  await ensureHostsSchema(env);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE hosts SET is_default = 0, updated_at = ? WHERE is_default = 1').bind(now),
    env.DB.prepare('UPDATE hosts SET is_default = 1, enabled = 1, updated_at = ? WHERE id = ?').bind(now, id),
  ]);
  return hostById(env, id);
}

export async function duplicateHost(env, id) {
  const source = await hostById(env, id);
  if (!source) return null;
  return createHost(env, {
    remark: `${source.remark} Copy`.slice(0, 64), address: source.address, port: Number(source.port), hostHeader: source.host_header,
    sni: source.sni, path: source.path, security: source.security, fingerprint: source.fingerprint, alpn: source.alpn,
    allowInsecure: Boolean(source.allow_insecure), enabled: Boolean(source.enabled), includeInSubscription: Boolean(source.include_in_subscription),
    isDefault: false, sortOrder: await nextOrder(env),
  });
}

export async function moveHost(env, id, direction) {
  const items = await listHosts(env);
  const index = items.findIndex((item) => Number(item.id) === Number(id));
  const otherIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || otherIndex < 0 || otherIndex >= items.length) return hostById(env, id);
  const current = items[index];
  const other = items[otherIndex];
  const currentOrder = Number(current.sort_order);
  const otherOrder = Number(other.sort_order);
  const fallbackCurrent = index * 10 + 10;
  const fallbackOther = otherIndex * 10 + 10;
  await env.DB.batch([
    env.DB.prepare('UPDATE hosts SET sort_order = ?, updated_at = ? WHERE id = ?').bind(otherOrder === currentOrder ? fallbackOther : otherOrder, Date.now(), current.id),
    env.DB.prepare('UPDATE hosts SET sort_order = ?, updated_at = ? WHERE id = ?').bind(otherOrder === currentOrder ? fallbackCurrent : currentOrder, Date.now(), other.id),
  ]);
  return hostById(env, id);
}

export async function removeHost(env, id) {
  const current = await hostById(env, id);
  if (!current) return false;
  await env.DB.prepare('DELETE FROM hosts WHERE id = ?').bind(id).run();
  await repairDefault(env);
  return true;
}

export async function exportHosts(env) {
  const items = await listHosts(env);
  return items.map(({ id, ...item }) => item);
}

export async function restoreHosts(env, items) {
  await ensureHostsSchema(env);
  if (!Array.isArray(items)) return { hosts: 0 };
  if (items.length > 100) throw new Error('تعداد هاست‌های فایل پشتیبان بیشتر از حد مجاز است.');
  await env.DB.prepare('DELETE FROM hosts').run();
  let restored = 0;
  for (const item of items) {
    if (!item || !item.remark || !item.address) continue;
    await createHost(env, {
      remark: String(item.remark).slice(0, 64), address: String(item.address).slice(0, 253), port: Number(item.port) || 443,
      hostHeader: String(item.host_header || '').slice(0, 253), sni: String(item.sni || '').slice(0, 253), path: String(item.path || '/').slice(0, 120),
      security: ['same', 'tls', 'none'].includes(item.security) ? item.security : 'tls', fingerprint: String(item.fingerprint || 'chrome').slice(0, 32),
      alpn: String(item.alpn || 'http/1.1').slice(0, 40), allowInsecure: Boolean(item.allow_insecure), enabled: Boolean(item.enabled),
      includeInSubscription: Boolean(item.include_in_subscription), isDefault: Boolean(item.is_default), sortOrder: Number(item.sort_order) || restored * 10 + 10,
    });
    restored += 1;
  }
  await repairDefault(env);
  return { hosts: restored };
}
