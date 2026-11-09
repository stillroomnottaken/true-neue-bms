<?php
// Temporary diagnostic. DELETE this file after use.
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors','1'); error_reporting(E_ALL);
$ok = fn($b) => $b ? 'OK  ' : 'FAIL';
echo "PHP version: " . PHP_VERSION . "  " . $ok(version_compare(PHP_VERSION, '8.0.0', '>=')) . " (need 8.0+)\n";
foreach (['json','mbstring','fileinfo','session'] as $e) echo "ext $e: " . $ok(extension_loaded($e)) . "\n";
foreach (['data','uploads'] as $d) echo "$d/ writable: " . $ok(is_writable(__DIR__."/$d")) . "\n";
foreach (['index.php','inc/bootstrap.php','inc/site.php','inc/seed.json','config.php','.htaccess','admin/app.html','assets/css/main.css','assets/js/main.js','inc/forms.php'] as $f)
  echo "file $f: " . $ok(file_exists(__DIR__."/$f")) . "\n";
echo "Document root: " . ($_SERVER['DOCUMENT_ROOT'] ?? '?') . "\nThis folder:   " . __DIR__ . "\n";
echo "Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? '?') . "\n";
try { require __DIR__.'/inc/bootstrap.php'; require __DIR__.'/inc/site.php'; $c = content_current(); echo "Load site content: OK (" . count($c['data']['catalogue']) . " catalogue items)\n"; }
catch (Throwable $t) { echo "Load site content: FAIL - " . $t->getMessage() . " at " . basename($t->getFile()) . ":" . $t->getLine() . "\n"; }
