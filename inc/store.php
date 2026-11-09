<?php
defined('APP_ROOT') or exit;
/**
 * Tiny JSON file store. Every file is saved as  data/<name>.php  with a first line that stops PHP from ever
 * printing the file, so even a misconfigured server (no .htaccess support) cannot show its contents as text.
 * Writes are atomic (temp file + rename) and read-modify-write is serialised with a lock.
 */
const STORE_GUARD = "<?php http_response_code(404); exit; ?>\n";

function store_file(string $name): string {
    if (!preg_match('/^[a-z0-9_\/-]{1,60}$/', $name) || str_contains($name, '..')) throw new InvalidArgumentException('bad store name');
    return data_dir() . '/' . $name . '.php';
}
function store_read(string $name, mixed $default = null): mixed {
    $f = store_file($name);
    $raw = is_file($f) ? file_get_contents($f) : false;
    if ($raw === false) return $default;
    if (str_starts_with($raw, STORE_GUARD)) $raw = substr($raw, strlen(STORE_GUARD));
    $v = json_decode($raw, true);
    return $v === null ? $default : $v;
}
function store_write(string $name, mixed $value): void {
    $f = store_file($name);
    $dir = dirname($f);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) throw new RuntimeException('Cannot create data folder');
    $tmp = $f . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    if (file_put_contents($tmp, STORE_GUARD . $json, LOCK_EX) === false) throw new RuntimeException('Cannot write data file');
    @chmod($tmp, 0640);
    if (!rename($tmp, $f)) { @unlink($tmp); throw new RuntimeException('Cannot save data file'); }
}
function store_delete(string $name): void { $f = store_file($name); if (is_file($f)) @unlink($f); }
function store_list(string $dir): array {
    $d = data_dir() . '/' . $dir;
    $out = [];
    foreach (is_dir($d) ? scandir($d) : [] as $n) if (str_ends_with($n, '.php') && $n[0] !== '.') $out[] = $dir . '/' . substr($n, 0, -4);
    return $out;
}
/** Run $fn while holding an exclusive lock named $name (serialises read-modify-write). */
function with_lock(string $name, callable $fn): mixed {
    if (!is_dir(data_dir())) @mkdir(data_dir(), 0750, true);
    $fp = fopen(data_dir() . '/.lock-' . preg_replace('/[^a-z0-9_-]/', '', $name), 'c');
    if (!$fp) throw new RuntimeException('Cannot lock');
    flock($fp, LOCK_EX);
    try { return $fn(); } finally { flock($fp, LOCK_UN); fclose($fp); }
}
/** Append a line to the audit log (logins, saves, password changes). Rotates at 512 KB. */
function audit(string $event, string $user = '', string $extra = ''): void {
    try {
        $f = data_dir() . '/audit.php';
        if (is_file($f) && filesize($f) > 524288) @rename($f, data_dir() . '/audit-old.php');
        if (!is_file($f)) file_put_contents($f, STORE_GUARD, LOCK_EX);
        $line = date('c') . "\t" . client_ip() . "\t" . $event . "\t" . preg_replace('/[\r\n\t]+/', ' ', $user) . "\t" . preg_replace('/[\r\n\t]+/', ' ', $extra) . "\n";
        file_put_contents($f, $line, FILE_APPEND | LOCK_EX);
    } catch (Throwable) { /* logging must never break a request */ }
}
