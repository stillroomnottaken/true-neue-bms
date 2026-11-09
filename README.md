# BMS website: PHP backend + admin dashboard

Every public page is drawn by PHP from the content you edit in the admin's **Website Editor**. There are no static HTML pages any more. **No Node.js is needed on the server.**
Requires PHP 8.0+ (extensions: json, mbstring, fileinfo, session) on Apache/LiteSpeed (cPanel, Hostinger…) or nginx.

## Install
1. Upload everything in this folder to the web root (`public_html`) of the domain or subdomain. It must be the root of a domain, not a sub-folder.
2. Make `data/` and `uploads/` writable by PHP (chmod 755/775 as your host requires).
3. Open `https://your-domain/admin/` and sign in.
4. Optional: in `config.php` set `base_url` and `notify_email`. Uncomment the HTTPS redirect in `.htaccess` once SSL is active.
   nginx: see the snippet at the bottom.

First login: user `BMSADMIN1250` with the password you gave me. **Change it straight away** in Admin → Account (12+ characters), because it was shared in a chat.
Reset from the server: `php tools/set-password.php BMSADMIN1250`.

## What you get
| URL | |
|---|---|
| `/`, `/about`, `/catalogue`, `/contact`, `/corn-cobs`, `/for-buyers`, `/become-a-supplier` and the Indonesian versions `/id/`, `/id/tentang`, `/id/katalog`, `/id/kontak`, `/id/corn-cobs`, `/id/untuk-buyer`, `/id/jadi-supplier` | Public pages. **All of them are editable** in Admin → Website Editor (text, buttons, images, order of sections, show/hide, EN/ID). The 404 page is editable too. Old `.html` URLs redirect to these. Also sitemap.xml and robots.txt. |
| `/admin/` | Login, then the admin: Website Editor, Pages (names, addresses, menu entries, browser title and search description), catalogue manager, media library (real uploads), version history, contact-form **Inquiries** inbox, password change. |

How the public site is built: `inc/site.php` renders the saved content (pages → sections → elements) with the same classes as the original stylesheet `assets/css/main.css`. `assets/js/main.js` is unchanged (menu, catalogue filter, WhatsApp forms). The editor canvas uses the same markup, so what you see there is what visitors get.

What is still fixed in code (not in the editor): the company facts in `config.php` (WhatsApp number, e-mail, NIB), the menu/footer UI words, and the labels inside the two enquiry forms (`inc/forms.php`: they must match `main.js`). The form headline/hint and the side panel next to each form are editable.

Useful in the editor:
- **Show in: Both / EN only / ID only** on any element or section, for places where the two languages differ.
- **Destination · Indonesian** on buttons/links when the Indonesian page should link elsewhere (for example a Indonesian WhatsApp message).
- Link targets: `@about`, `@catalogue`, `@buyers?material=cocoa` (any page), `@whatsapp?text=Hello%20BMS` (opens the company WhatsApp), `@email?subject=Hi` (company e-mail), or a full URL.
- Text tokens: `{count}` = number of visible catalogue entries, `{nib}`, `{email}`, `{year}`.
- The material list in the forms and the catalogue grid come from Admin → Catalogue.

Upgrading an existing install: upload these files over the old ones. The first visit rebuilds the editor pages from the real site text (your catalogue and design settings are kept; the previous version stays in Version history).

Any change: edit in the admin → **Save & publish** → live immediately.

## Security
- Password stored only as a bcrypt hash (`data/users.php`), never in code. Same error for wrong user or wrong password.
- Brute-force lockout: 5 wrong passwords per IP (20 per username) → blocked 15 min. Session id renewed at login, HttpOnly + SameSite=Strict (+ Secure on HTTPS) cookie, 30 min idle / 8 h max, tied to the browser, ended on password change.
- CSRF token + same-origin check on every change. The editor page and API are never sent without a valid session.
- The server re-validates everything you save against an allow-list (types, ranges, colours, links; `javascript:` etc. refused). All output is HTML-escaped. Strict Content-Security-Policy (no inline scripts on public pages), anti-clickjacking, nosniff, HSTS on HTTPS.
- Uploads: real JPG/PNG/WebP/GIF only (checked by content, max 5 MB), random file names, no SVG, files containing code refused, `uploads/` cannot execute anything.
- `data/`, `inc/`, `tools/`, `config.php` are blocked from the web, and data files are PHP-guarded so they never print even if the block fails. Best practice: set `data_dir` in `config.php` to a folder **outside** the web root.
- Audit log (logins, saves, uploads, password changes): `data/audit.php`.
- Limits: keep PHP updated, use HTTPS, pick a long unique password. Lockout is per IP; behind Cloudflare set `trust_proxy_headers` to true.

## Rebuilding the editor (optional, needs Node)
Source is in `editor-src/` (Next.js static export): `npm ci && npm run build`, then copy `out/index.html` to `admin/app.html` and `out/_next/` to `admin/_next/`. When you change the public look in `assets/css/main.css`, mirror it in `editor-src/app/site.css` so the canvas stays identical (same rules, with `@container site` instead of `@media`).
Site facts (WhatsApp, contacts, NIB) live in `config.php`.

## Local test
`php -S 127.0.0.1:8080 router.php`

## nginx
```
location ~ ^/(data|inc|tools|editor-src)/ { deny all; }
location = /config.php { deny all; }
location ~ ^/uploads/.*\.(php|phtml|html?|svg|js)$ { deny all; }
location / { try_files $uri $uri/ /index.php?$query_string; }
location ~ \.php$ { include fastcgi_params; fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; fastcgi_pass unix:/run/php/php-fpm.sock; }
```
