<?php
declare(strict_types=1);
if (PHP_VERSION_ID < 80000) { http_response_code(500); exit('This site needs PHP 8.0 or newer.'); }
define('APP_ROOT', dirname(__DIR__));

$GLOBALS['BMS_CFG'] = require APP_ROOT . '/config.php';
function cfg(string $key, mixed $default = null): mixed { return $GLOBALS['BMS_CFG'][$key] ?? $default; }
function data_dir(): string { return rtrim((string)cfg('data_dir'), '/\\'); }

date_default_timezone_set((string)cfg('timezone', 'UTC'));
mb_internal_encoding('UTF-8');
error_reporting(E_ALL);
ini_set('display_errors', '0');       // never show PHP errors to visitors
ini_set('log_errors', '1');
if (is_dir(data_dir()) && is_writable(data_dir())) ini_set('error_log', data_dir() . '/php-errors.log');

require __DIR__ . '/store.php';
require __DIR__ . '/security.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/sanitize.php';
require __DIR__ . '/content.php';
