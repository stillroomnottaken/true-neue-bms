<?php
declare(strict_types=1);
/**
 * Command line only. Creates or resets an admin account:
 *     php tools/set-password.php USERNAME
 * The password is typed at the prompt (not shown) and stored only as a bcrypt hash. Resetting also signs out that user everywhere.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__) . '/inc/bootstrap.php';

$user = $argv[1] ?? '';
if (!preg_match('/^[A-Za-z0-9._-]{3,64}$/', $user)) { fwrite(STDERR, "Usage: php tools/set-password.php USERNAME   (3-64 letters, digits, . _ -)\n"); exit(1); }
$read = function (string $prompt): string {
    fwrite(STDOUT, $prompt);
    $tty = stripos(PHP_OS, 'WIN') !== 0 && function_exists('posix_isatty') && posix_isatty(STDIN);
    if ($tty) shell_exec('stty -echo');
    $v = rtrim((string)fgets(STDIN), "\r\n");
    if ($tty) { shell_exec('stty echo'); fwrite(STDOUT, "\n"); }
    return $v;
};
$p1 = $read('New password (12+ characters): ');
if (mb_strlen($p1) < 12) { fwrite(STDERR, "Too short: use at least 12 characters.\n"); exit(1); }
if ($p1 !== $read('Repeat password: ')) { fwrite(STDERR, "Passwords do not match.\n"); exit(1); }
user_set_password($user, $p1, true);
fwrite(STDOUT, "Password set for $user.\n");
