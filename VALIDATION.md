# CatWoman Cloudflare — Validation

تاریخ آزمون: ۱۸ اکتبر ۲۰۲۶

## آزمون‌های خودکار

- Node.js: `22.23.3`
- تست‌ها: `25/25` موفق
- پوشش افزوده‌شده: migration جدول hosts، CRUD، default repair، ترتیب، visibility، backup/restore، تولید چندکانفیگی، IPv6 و WS Path
- Wrangler: `4.151.1`
- Dry run: موفق، همراه با D1 و Workers Static Assets

## آزمون یکپارچه محلی

روی Worker محلی واقعی Wrangler این موارد بررسی شدند:

- ساخت مدیر و ورود امن
- ساخت دو هاست با Address، Port، SNI، Host Header و Path متفاوت
- ساخت کاربر بدون تغییر یا حذف اطلاعات هاست‌ها
- تولید Raw Subscription با دقیقاً دو لینک VLESS و دو Path متفاوت
- نمایش دو لینک و دو QR مجزا در صفحه اشتراک
- فعال/غیرفعال، پیش‌فرض، ترتیب، تکثیر، ویرایش و حذف هاست
- خالی‌ماندن اشتراک هنگام غیرفعال‌بودن همه هاست‌ها، بدون بازگشت ناخواسته به endpoint قدیمی
- Backup نسخه ۲ و Restore کاربران و دو هاست
- پذیرش WebSocket روی Path پیشونددار با پاسخ `101 Switching Protocols`

## رابط کاربری

- بخش هاست‌ها در Chromium واقعی با اندازه دسکتاپ `1440×1000` و موبایل `390×844` بررسی شد.
- صفحه اشتراک موبایل با دو کارت کانفیگ و QR جدا بررسی شد.
- هیچ اسکرول افقی، خطای Console یا Page ثبت نشد.
- تصاویر آزمون: `cf-hosts-desktop.png`، `cf-hosts-mobile.png` و `cf-subscription-hosts-mobile.png`.

## مسیر اتصال واقعی پایه

مسیر زیر پیش‌تر روی Worker واقعی Cloudflare آزمایش شد و کد تونل در این تغییر دست‌نخورده مانده است:

`VLESS client → WSS → Cloudflare Worker → cloudflare:sockets → neverssl.com:80`

نتیجه:

- پاسخ: `HTTP/1.1 200 OK`
- دریافت: `4268` بایت
- مصرف ثبت‌شده در D1: `4357` بایت
- اتصال ثبت‌شده در D1: `1`

اطلاعات آزمایشی پس از پایان آزمون از D1 حذف شد.

## محدودیت مهم

Cloudflare اتصال مستقیم TCP از Worker به بازه‌های IP متعلق به خود Cloudflare را مسدود می‌کند. برای مقصدهایی که پشت Cloudflare هستند ممکن است Proxy IP مطمئن لازم باشد. UDP عمومی نیز پشتیبانی نمی‌شود.
