import { b64utf8, hostname } from './utils.js';

const uriHost = (value) => value.includes(':') && !value.startsWith('[') ? `[${value}]` : value;
const configHost = (value) => {
  const raw = String(value || '').trim().replace(/^\[|\]$/gu, '');
  return raw.includes(':') && /^[0-9a-f:.]+$/iu.test(raw) ? raw.toLowerCase() : hostname(raw);
};

export function profile(request, settings = {}, host = null) {
  const url = new URL(request.url);
  const requestHost = hostname(url.hostname) || url.hostname;
  const publicHost = configHost(host?.host_header) || configHost(host?.sni) || hostname(settings.public_host) || requestHost;
  const entryAddress = configHost(host?.address) || hostname(settings.entry_address) || publicHost;
  const requestedSecure = url.protocol === 'https:' || !['localhost', '127.0.0.1', '::1'].includes(requestHost);
  const security = host?.security || 'same';
  const secure = security === 'tls' || (security === 'same' && requestedSecure);
  return {
    publicHost,
    entryAddress,
    port: host ? Number(host.port || (secure ? 443 : 80)) : (requestedSecure ? 443 : Number(url.port || 80)),
    secure,
    sni: configHost(host?.sni) || publicHost,
    hostHeader: configHost(host?.host_header) || publicHost,
    path: normalizeWsPath(host?.path),
  };
}

export function normalizeWsPath(value = '/') {
  let path = String(value || '/').trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/gu, '/');
  if (path.length > 1) path = path.replace(/\/+$/u, '');
  return path || '/';
}

export function connectPath(host, token) {
  const base = normalizeWsPath(host?.path);
  return `${base === '/' ? '' : base}/connect/${token}`;
}

export function vlessLink(request, user, settings = {}, host = null) {
  const p = profile(request, settings, host);
  const path = connectPath(host, user.sub_token);
  const query = new URLSearchParams({
    encryption: 'none',
    security: p.secure ? 'tls' : 'none',
    type: 'ws',
    host: p.hostHeader,
    path,
  });
  if (p.secure) {
    query.set('sni', p.sni);
    const fingerprint = String(host?.fingerprint || 'chrome');
    const alpn = String(host?.alpn || 'http/1.1');
    if (fingerprint !== 'none') query.set('fp', fingerprint);
    if (alpn !== 'none') query.set('alpn', alpn);
    if (Number(host?.allow_insecure)) query.set('allowInsecure', '1');
  }
  const baseTitle = String(settings.config_title || 'CatWoman').trim() || 'CatWoman';
  const suffix = host?.remark ? `-${String(host.remark).trim()}` : '';
  const title = `${baseTitle}-${user.username}${suffix}`;
  return `vless://${user.uuid}@${uriHost(p.entryAddress)}:${p.port}?${query}#${encodeURIComponent(title)}`;
}

export function vlessLinks(request, user, settings = {}, hosts = []) {
  const active = Array.isArray(hosts)
    ? hosts.filter((host) => Number(host.enabled) === 1 && Number(host.include_in_subscription) === 1)
    : [];
  if (active.length) return active.map((host) => ({ host, link: vlessLink(request, user, settings, host) }));
  return Array.isArray(hosts) && hosts.length > 0 ? [] : [{ host: null, link: vlessLink(request, user, settings) }];
}

export const subUrl = (request, user, raw = false) => `${new URL(request.url).origin}/sub/${user.sub_token}${raw ? '/raw' : ''}`;

export const rawSub = (request, user, settings, hosts = []) => b64utf8(
  `${vlessLinks(request, user, settings, hosts).map((item) => item.link).join('\n')}\n`,
);

export function subHeaders(user, settings = {}) {
  const total = Math.max(0, Number(user.data_limit_bytes) || 0);
  const used = Math.max(0, Number(user.used_bytes) || 0);
  const expire = Number(user.expiry_at) > 0 ? Math.floor(Number(user.expiry_at) / 1000) : 0;
  return {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'subscription-userinfo': `upload=0; download=${used}; total=${total}; expire=${expire}`,
    'profile-title': `base64:${b64utf8(String(settings.config_title || 'CatWoman'))}`,
  };
}
