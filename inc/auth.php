<?php
defined('APP_ROOT') or exit;

/** A valid bcrypt hash of a random string. Verified against when the username does not exist, so a wrong username
 *  takes as long as a wrong password (no account enumeration by timing). */
const DUMMY_HASH = '$2y$12$yFNI2YlEIsuatUs0Ly53M.uExCXSDWcZFe9OSFqbxjzVnxfzQiM8y';

function session_boot(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $dir = data_dir() . '/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.gc_maxlifetime', (string)cfg('session_max', 28800));
    ini_set('session.gc_probability', '1'); ini_set('session.gc_divisor', '50');
    session_name('bms_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}
function csrf_token(): string {
    session_boot();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_ok(?string $t): bool { return is_string($t) && $t !== '' && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t); }

function users_all(): array { return store_read('users', []); }
function ua_hash(): string { return hash('sha256', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')); }

/** The signed-in username, or null. Enforces idle + absolute timeouts, browser binding and "password changed" logout. */
function auth_user(): ?string {
    session_boot();
    $s = $_SESSION['auth'] ?? null;
    if (!is_array($s)) return null;
    $now = time();
    $users = users_all();
    $u = $users[$s['user']] ?? null;
    $bad = !$u || ($now - $s['last']) > (int)cfg('session_idle', 1800) || ($now - $s['start']) > (int)cfg('session_max', 28800)
        || !hash_equals($s['ua'], ua_hash()) || (int)$s['pwv'] !== (int)($u['pwv'] ?? 0);
    if ($bad) { auth_logout(); return null; }
    $_SESSION['auth']['last'] = $now;
    return (string)$s['user'];
}
function auth_logout(): void {
    session_boot();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    @session_destroy();
}
/** @return array{ok:bool,error?:string,wait?:int} */
function auth_login(string $user, string $pass): array {
    $ipKey = rate_key('login-ip', client_ip());
    $userKey = rate_key('login-user', strtolower($user));
    $max = (int)cfg('login_max_fails_ip', 5); $maxU = (int)cfg('login_max_fails_user', 20); $win = (int)cfg('login_lock_seconds', 900);
    $wait = max(rate_blocked($ipKey, $max, $win), rate_blocked($userKey, $maxU, $win));
    if ($wait > 0) { audit('login-blocked', $user); return ['ok' => false, 'error' => 'locked', 'wait' => $wait]; }

    $users = users_all();
    $rec = (strlen($user) <= 64 && isset($users[$user])) ? $users[$user] : null;
    $valid = password_verify($pass, $rec['hash'] ?? DUMMY_HASH) && $rec !== null;   // always runs a full hash check
    if (!$valid) {
        rate_hit($ipKey, $win); rate_hit($userKey, $win);
        audit('login-fail', $user);
        usleep(random_int(250000, 500000));
        return ['ok' => false, 'error' => 'invalid'];
    }
    rate_clear($ipKey); rate_clear($userKey);
    if (password_needs_rehash($rec['hash'], PASSWORD_BCRYPT, ['cost' => 12])) user_set_password($user, $pass, false);
    session_boot();
    session_regenerate_id(true);                      // new session id on privilege change (stops session fixation)
    $users = users_all();
    $_SESSION['auth'] = ['user' => $user, 'start' => time(), 'last' => time(), 'ua' => ua_hash(), 'pwv' => (int)($users[$user]['pwv'] ?? 0)];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    audit('login-ok', $user);
    return ['ok' => true];
}
/** Create/replace a user's password. $bump = true signs out every other session of that user. */
function user_set_password(string $user, string $pass, bool $bump = true): void {
    with_lock('users', function () use ($user, $pass, $bump) {
        $users = users_all();
        $users[$user] = ['hash' => password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]), 'pwv' => $bump ? time() : (int)($users[$user]['pwv'] ?? time())];
        store_write('users', $users);
    });
}
