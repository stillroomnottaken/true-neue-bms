<?php
/**
 * Router for PHP's built-in web server (local testing only):   php -S 127.0.0.1:8080 router.php
 * On real hosting Apache/LiteSpeed uses .htaccess instead (see README for nginx).
 */
$path = rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (preg_match('#(^|/)\.|^/(data|inc|tools|editor-src)(/|$)|^/config\.php$#', $path)) { http_response_code(404); exit; }
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    if (str_ends_with($path, '.php')) { if (in_array($path, ['/index.php', '/api/index.php', '/admin/index.php'], true)) return false; http_response_code(404); exit; }
    return false;                                   // static file
}
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.php') && $path !== '/') { chdir($file); require rtrim($file, '/') . '/index.php'; return true; }
require __DIR__ . '/index.php';
