<?php
defined('APP_ROOT') or exit;

function is_https(): bool {
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') return true;
    if ((int)($_SERVER['SERVER_PORT'] ?? 0) === 443) return true;
    return cfg('trust_proxy_headers') && strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}
function client_ip(): string {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    if (cfg('trust_proxy_headers')) {
        $h = (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? '');
        if ($h === '') $h = trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
        if (filter_var($h, FILTER_VALIDATE_IP)) $ip = $h;
    }
    return $ip;
}
/** Host the visitor used, restricted to safe characters (it is echoed into canonical links and the sitemap). */
function request_host(): string {
    $h = strtolower((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost'));
    return preg_match('/^[a-z0-9.-]+(:\d{1,5})?$/', $h) ? $h : 'localhost';
}
function base_url(): string {
    $b = rtrim((string)cfg('base_url', ''), '/');
    return $b !== '' ? $b : (is_https() ? 'https://' : 'http://') . request_host();
}
function security_headers(string $csp, bool $noStore = false): void {
    header('Content-Security-Policy: ' . $csp);
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    if (is_https()) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    if ($noStore) { header('Cache-Control: no-store, max-age=0'); header('Pragma: no-cache'); }
    header_remove('X-Powered-By');
}
function json_out(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
/** Reject cross-site POSTs: the Origin (or Sec-Fetch-Site) must be this site. */
function require_same_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? null;
    if ($origin !== null && $origin !== '' && $origin !== 'null') {
        $o = parse_url($origin);
        $host = strtolower(($o['host'] ?? '') . (isset($o['port']) && !in_array((int)$o['port'], [80, 443], true) ? ':' . $o['port'] : ''));
        $mine = strtolower(preg_replace('/:(80|443)$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        if ($host !== $mine) json_or_text_fail(403, 'Cross-site request blocked');
        return;
    }
    $sfs = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? null;
    if ($sfs !== null && !in_array($sfs, ['same-origin', 'none'], true)) json_or_text_fail(403, 'Cross-site request blocked');
    if ($origin === 'null') json_or_text_fail(403, 'Cross-site request blocked');
}
function json_or_text_fail(int $code, string $msg): never {
    if (str_contains((string)($_SERVER['HTTP_ACCEPT'] ?? ''), 'json') || str_contains((string)($_SERVER['SCRIPT_NAME'] ?? ''), '/api/')) json_out(['error' => $msg], $code);
    http_response_code($code); header('Content-Type: text/plain; charset=utf-8'); echo $msg; exit;
}

/* ---------------- rate limiting (login attempts, public enquiry form) ---------------- */
function rate_key(string $prefix, string $who): string { return $prefix . ':' . substr(hash('sha256', $who), 0, 24); }
/** Seconds the bucket is still blocked (>= $max hits inside $window), else 0. */
function rate_blocked(string $key, int $max, int $window): int {
    $t = store_read('throttle', []);
    $e = $t[$key] ?? null;
    if (!$e || time() - $e['last'] > $window || $e['n'] < $max) return 0;
    return max(1, $window - (time() - $e['last']));
}
/** Count one hit; returns the new count inside the window. */
function rate_hit(string $key, int $window): int {
    return (int)with_lock('throttle', function () use ($key, $window) {
        $t = store_read('throttle', []);
        $now = time();
        foreach ($t as $k => $e) if ($now - ($e['last'] ?? 0) > 86400) unset($t[$k]);   // tidy old buckets
        $e = $t[$key] ?? ['n' => 0, 'last' => 0];
        if ($now - $e['last'] > $window) $e['n'] = 0;
        $e['n']++; $e['last'] = $now;
        $t[$key] = $e;
        store_write('throttle', $t);
        return $e['n'];
    });
}
function rate_clear(string $key): void {
    with_lock('throttle', function () use ($key) { $t = store_read('throttle', []); if (isset($t[$key])) { unset($t[$key]); store_write('throttle', $t); } });
}
