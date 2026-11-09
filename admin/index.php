<?php
declare(strict_types=1);
/**
 * /admin/  →  login page, or (when signed in) the visual editor.
 * The editor itself is the pre-built static app in this folder (app.html + _next/). Without a valid session
 * visitors only ever receive the login form: the editor page is never sent to them.
 */
require dirname(__DIR__) . '/inc/bootstrap.php';
session_boot();

$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
$error = ''; $notice = '';

if ($method === 'POST') {
    require_same_origin();
    $action = (string)($_POST['do'] ?? '');
    if (!csrf_ok($_POST['csrf'] ?? null)) { $error = 'This page expired. Please try again.'; }
    elseif ($action === 'login') {
        $r = auth_login(substr((string)($_POST['username'] ?? ''), 0, 64), substr((string)($_POST['password'] ?? ''), 0, 500));
        if ($r['ok']) { header('Location: /admin/', true, 303); exit; }
        $error = ($r['error'] ?? '') === 'locked'
            ? 'Too many failed attempts. Try again in ' . max(1, (int)ceil(($r['wait'] ?? 900) / 60)) . ' minute(s).'
            : 'Incorrect username or password.';
    }
}

if (auth_user() !== null) {
    $file = __DIR__ . '/app.html';
    if (!is_file($file)) { http_response_code(500); echo 'Editor files are missing (admin/app.html).'; exit; }
    $html = (string)file_get_contents($file);
    // allow exactly the inline scripts the editor contains (by hash) and nothing else
    preg_match_all('#<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>#s', $html, $m);
    $hashes = '';
    foreach (array_unique($m[1]) as $js) $hashes .= " 'sha256-" . base64_encode(hash('sha256', $js, true)) . "'";
    $html = preg_replace('#<head>#', '<head><meta name="csrf-token" content="' . e_attr(csrf_token()) . '">', $html, 1);
    security_headers("default-src 'none'; script-src 'self'$hashes; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'", true);
    header('Content-Type: text/html; charset=utf-8');
    header('Referrer-Policy: same-origin');
    echo $html; exit;
}

function e_attr(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
security_headers("default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", true);
header('Content-Type: text/html; charset=utf-8');
header('Referrer-Policy: same-origin');
http_response_code($error !== '' && str_contains($error, 'Too many') ? 429 : 200);
$csrf = csrf_token();
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign in · BMS Admin</title><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/assets/img/favicon.svg">
<style>
@font-face{font-family:Fraunces;font-weight:600;font-display:swap;src:url(/assets/fonts/fraunces-600.woff2) format("woff2")}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#FBF7E6;color:#563D23;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:min(420px,100%);background:#FFFDF4;border:1px solid rgba(86,61,35,.2);border-radius:14px;padding:30px 28px;box-shadow:0 10px 30px rgba(86,61,35,.1)}
.mark{display:inline-grid;place-items:center;width:46px;height:46px;border-radius:10px;background:#90C207;color:#2E2012;font:600 19px Fraunces,Georgia,serif;margin-bottom:10px}
h1{font:600 26px/1.15 Fraunces,Georgia,serif;margin:0 0 4px;color:#2E2012}
p.sub{margin:0 0 20px;color:#6E5238;font-size:15px}
label{display:block;font-weight:600;font-size:14px;margin:14px 0 5px}
input{width:100%;padding:11px 12px;border:1.5px solid rgba(86,61,35,.4);border-radius:8px;font:inherit;background:#fff;color:#2E2012}
input:focus{outline:3px solid #DD9C00;outline-offset:1px;border-color:#563D23}
button{margin-top:22px;width:100%;padding:12px;border:0;border-radius:8px;background:#90C207;color:#2E2012;font:700 16px system-ui,sans-serif;cursor:pointer}
button:hover{background:#7fae05}
.err{margin:14px 0 0;padding:10px 12px;border-radius:8px;background:#fdecea;border:1px solid #f0c1bc;color:#7a1f16;font-size:14px}
small{display:block;margin-top:18px;color:#6E5238;font-size:13px;text-align:center}
</style></head><body>
<main>
  <span class="mark" aria-hidden="true">BMS</span>
  <h1>Website admin</h1>
  <p class="sub">Sign in to edit the BMS website.</p>
  <form method="post" action="/admin/" autocomplete="on">
    <input type="hidden" name="do" value="login">
    <input type="hidden" name="csrf" value="<?= e_attr($csrf) ?>">
    <label for="u">Username</label>
    <input id="u" name="username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="64" required autofocus>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" maxlength="500" required>
    <?php if ($error !== ''): ?><p class="err" role="alert"><?= e_attr($error) ?></p><?php endif; ?>
    <button type="submit">Sign in</button>
  </form>
  <small>Authorised staff only. Sign-in attempts are logged.</small>
</main></body></html>
