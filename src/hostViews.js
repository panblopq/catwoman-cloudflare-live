import { esc } from './utils.js';
import { adminPage } from './views.js';

const csrf = (token) => `<input type="hidden" name="csrf_token" value="${esc(token)}">`;
export function hostsPage({ admin, items = [], csrfToken, ok, error }) {
  const rows = items.map((host, index) => {
    const flags = [
      host.is_default ? '<span class="badge active">پیش‌فرض</span>' : '',
      host.enabled ? '<span class="badge online">فعال</span>' : '<span class="badge disabled">غیرفعال</span>',
      host.include_in_subscription ? '<span class="badge active">در اشتراک</span>' : '<span class="badge disabled">مخفی</span>',
    ].filter(Boolean).join(' ');
    return `<tr>
      <td data-label="هاست"><div class="user-main"><b>${esc(host.remark)}</b><small>${esc(host.address)}:${Number(host.port)}</small></div></td>
      <td data-label="مسیر"><div class="user-main"><b dir="ltr">${esc(host.path || '/')}</b><small dir="ltr">SNI: ${esc(host.sni || 'خودکار')}</small></div></td>
      <td data-label="وضعیت"><div class="host-flags">${flags}</div></td>
      <td data-label="ترتیب"><div class="row-actions compact">
        <form method="post" action="/hosts/${host.id}/up">${csrf(csrfToken)}<button class="btn small" type="submit" ${index === 0 ? 'disabled' : ''}>↑</button></form>
        <form method="post" action="/hosts/${host.id}/down">${csrf(csrfToken)}<button class="btn small" type="submit" ${index === items.length - 1 ? 'disabled' : ''}>↓</button></form>
      </div></td>
      <td data-label="عملیات"><div class="row-actions">
        <a class="btn small" href="/hosts/${host.id}/edit">ویرایش</a>
        <form method="post" action="/hosts/${host.id}/toggle">${csrf(csrfToken)}<button class="btn small" type="submit">${host.enabled ? 'توقف' : 'فعال'}</button></form>
        ${host.is_default ? '' : `<form method="post" action="/hosts/${host.id}/default">${csrf(csrfToken)}<button class="btn small" type="submit">پیش‌فرض</button></form>`}
        <form method="post" action="/hosts/${host.id}/duplicate">${csrf(csrfToken)}<button class="btn small" type="submit">تکثیر</button></form>
        <form method="post" action="/hosts/${host.id}/delete" data-confirm="این هاست حذف شود؟ کاربران حذف نمی‌شوند.">${csrf(csrfToken)}<button class="btn small danger" type="submit">حذف</button></form>
      </div></td>
    </tr>`;
  }).join('');

  return adminPage({
    active: 'hosts', title: 'هاست‌ها', subtitle: `${items.length} مسیر اتصال برای سابسکریپشن‌ها`, admin, ok, error,
    content: `<article class="card card-pad">
      <div class="card-title"><div><h2>مسیرهای اتصال</h2><p class="muted-line">هر هاست فعال و قابل‌نمایش، یک کانفیگ جدا برای همه کاربران می‌سازد.</p></div><span>HOST ROUTES</span></div>
      ${rows ? `<div class="table-wrap"><table class="table"><thead><tr><th>هاست</th><th>مسیر و SNI</th><th>وضعیت</th><th>ترتیب</th><th>عملیات</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty"><b>هنوز هاستی ثبت نشده</b><span>تا زمان ساخت اولین هاست، تنظیمات قدیمی شبکه بدون تغییر کار می‌کند.</span><a class="btn primary" href="/hosts/new">ساخت اولین هاست</a></div>`}
    </article>`,
  });
}

export function hostForm({ admin, host = null, csrfToken, ok, error, requestHost = '' }) {
  const edit = Boolean(host);
  const selected = (name, value) => String(name) === String(value) ? 'selected' : '';
  return adminPage({
    active: 'hosts', title: edit ? 'ویرایش هاست' : 'ساخت هاست', subtitle: 'آدرس عمومی و مشخصات WebSocket این مسیر', admin, ok, error,
    content: `<article class="card card-pad form-card">
      <form method="post" action="${edit ? `/hosts/${host.id}/edit` : '/hosts/new'}">${csrf(csrfToken)}
        <div class="form-grid">
          <div class="field"><label>نام نمایشی</label><input name="remark" maxlength="64" required value="${esc(host?.remark || '')}" placeholder="مثلاً همراه اول - تهران"></div>
          <div class="field"><label>Address / Clean IP</label><input name="address" dir="ltr" maxlength="253" required value="${esc(host?.address || requestHost)}" placeholder="domain.com یا 104.16.1.1"></div>
          <div class="field"><label>Port</label><input name="port" dir="ltr" type="number" min="1" max="65535" required value="${Number(host?.port || 443)}"></div>
          <div class="field"><label>TLS / Security</label><select name="security"><option value="tls" ${selected(host?.security || 'tls', 'tls')}>TLS</option><option value="none" ${selected(host?.security, 'none')}>بدون TLS</option><option value="same" ${selected(host?.security, 'same')}>همان پروتکل Worker</option></select></div>
          <div class="field"><label>SNI</label><input name="sni" dir="ltr" maxlength="253" value="${esc(host?.sni || '')}" placeholder="خالی = Host Header"></div>
          <div class="field"><label>Host Header</label><input name="host_header" dir="ltr" maxlength="253" value="${esc(host?.host_header || requestHost)}" placeholder="دامنه Worker"></div>
          <div class="field full"><label>WS Path</label><input name="path" dir="ltr" maxlength="120" value="${esc(host?.path || '/')}" placeholder="/ یا /cdn"><small>پنل مسیر اتصال کاربر را خودکار به انتهای این مقدار اضافه می‌کند.</small></div>
          <div class="field"><label>Fingerprint</label><select name="fingerprint"><option value="chrome" ${selected(host?.fingerprint || 'chrome', 'chrome')}>chrome</option><option value="firefox" ${selected(host?.fingerprint, 'firefox')}>firefox</option><option value="safari" ${selected(host?.fingerprint, 'safari')}>safari</option><option value="random" ${selected(host?.fingerprint, 'random')}>random</option><option value="none" ${selected(host?.fingerprint, 'none')}>none</option></select></div>
          <div class="field"><label>ALPN</label><select name="alpn"><option value="http/1.1" ${selected(host?.alpn || 'http/1.1', 'http/1.1')}>http/1.1</option><option value="h2,http/1.1" ${selected(host?.alpn, 'h2,http/1.1')}>h2,http/1.1</option><option value="h2" ${selected(host?.alpn, 'h2')}>h2</option><option value="none" ${selected(host?.alpn, 'none')}>خالی</option></select></div>
          <div class="field"><label>ترتیب</label><input name="sort_order" type="number" min="0" max="100000" value="${Number(host?.sort_order || 10)}"></div>
          <div class="field host-checks">
            <label class="check"><input type="checkbox" name="enabled" ${host === null || host.enabled ? 'checked' : ''}> فعال باشد</label>
            <label class="check"><input type="checkbox" name="include_in_subscription" ${host === null || host.include_in_subscription ? 'checked' : ''}> در سابسکریپشن نمایش داده شود</label>
            <label class="check"><input type="checkbox" name="is_default" ${host?.is_default ? 'checked' : ''}> هاست پیش‌فرض باشد</label>
            <label class="check"><input type="checkbox" name="allow_insecure" ${host?.allow_insecure ? 'checked' : ''}> Allow Insecure</label>
          </div>
        </div>
        <div class="auth-note host-note">برای اتصال واقعی، Address باید به Cloudflare برسد و SNI و Host Header باید دامنه معتبر Worker یا دامنه متصل به آن باشد.</div>
        <div class="form-actions"><button class="btn primary" type="submit">${edit ? 'ذخیره تغییرات' : 'ساخت هاست'}</button><a class="btn" href="/hosts">انصراف</a></div>
      </form>
    </article>`,
  });
}
