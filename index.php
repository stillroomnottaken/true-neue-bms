<?php
declare(strict_types=1);
/**
 * Public front controller: every website URL that is not a real file ends up here.
 * Every page is drawn from the content saved in the admin's Website Editor (see inc/site.php).
 */
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/site.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'HEAD'], true)) { http_response_code(405); header('Allow: GET, HEAD'); exit; }

$path = rawurldecode((string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));
if (!preg_match('//u', $path) || str_contains($path, "\0")) { http_response_code(400); exit; }

// Old static-site URLs (/about.html, /id/kontak.html, /index.html) → clean URLs
if (preg_match('#^(.*?)(?:/index)?\.html?$#', $path, $m)) {
    $to = $m[1] === '' ? '/' : $m[1];
    header('Location: ' . $to, true, 301); exit;
}
$path = '/' . trim($path, '/');

$cur = content_current();
$data = $cur['data'];
$site = cfg('site');
$saveVer = (string)(int)@filemtime(__DIR__ . '/assets/js/save.js');
$assetVer = (string)max((int)@filemtime(__DIR__ . '/assets/css/main.css'), (int)@filemtime(__DIR__ . '/assets/js/main.js'), (int)$saveVer, (int)@filemtime(__DIR__ . '/inc/site.php'));

// Editable redirects (Admin → Redirects): checked before anything else so an old address can be retired or moved.
$rkey = redirect_key($path);
foreach (($data['redirects'] ?? []) as $r) {
    if (redirect_key($r['from']) !== $rkey) continue;
    $to = redirect_target($r['to'], $data, str_starts_with($rkey, '/id/') || $rkey === '/id' ? 'id' : 'en', $site);
    if ($to !== '' && $to !== '#') {
        $qs = (string)($_SERVER['QUERY_STRING'] ?? '');
        if ($qs !== '' && !str_contains($to, '?') && str_starts_with($to, '/')) $to .= '?' . $qs;
        header('Cache-Control: no-store'); header('Location: ' . $to, true, (int)$r['code']); exit;
    }
}

if ($path === '/robots.txt') {
    header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: public, max-age=3600');
    echo "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: " . base_url() . "/sitemap.xml\n"; exit;
}
if ($path === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8'); header('Cache-Control: public, max-age=3600');
    $b = base_url(); $lastmod = date('Y-m-d', (int)$cur['savedAt']);
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";
    foreach ($data['pages'] as $p) {
        if ($p['id'] === '404') continue;
        foreach (['en', 'id'] as $l) {
            echo '<url><loc>' . e($b . page_path($data, $p['id'], $l)) . '</loc><lastmod>' . $lastmod . '</lastmod>'
                . '<xhtml:link rel="alternate" hreflang="en" href="' . e($b . page_path($data, $p['id'], 'en')) . '"/><xhtml:link rel="alternate" hreflang="id" href="' . e($b . page_path($data, $p['id'], 'id')) . '"/></url>' . "\n";
        }
    }
    foreach ($data['catalogue'] as $m) {
        if (empty($m['visible']) || !material_has_info($m) || (!empty($m['detail']) && site_page($data, $m['slug']) !== null)) continue;
        echo '<url><loc>' . e($b . '/material/' . $m['slug']) . '</loc><lastmod>' . $lastmod . '</lastmod>'
            . '<xhtml:link rel="alternate" hreflang="en" href="' . e($b . '/material/' . $m['slug']) . '"/><xhtml:link rel="alternate" hreflang="id" href="' . e($b . '/id/material/' . $m['slug']) . '"/></url>' . "\n";
    }
    echo '</urlset>'; exit;
}

// Route: "/id/..." is Indonesian, everything else English. The page is whichever editor page owns that address.
$lang = 'en'; $rest = trim($path, '/');
if ($rest === 'id' || str_starts_with($rest, 'id/')) { $lang = 'id'; $rest = trim(substr($rest, 2), '/'); }
$page = find_page($data, $lang, $rest);
if (!$page && preg_match('#^material/([a-z0-9]+(?:-[a-z0-9]+)*)$#', $rest, $mm)) {   // generated page for a catalogue entry with a further explanation
    $mat = material_by_slug($data, $mm[1]);
    if ($mat && !empty($mat['visible']) && material_has_info($mat)) $page = material_page($mat, $data);
}
$cx = site_ctx($data, $lang, $site, $saveVer);

security_headers("default-src 'self'; script-src 'self' " . inline_js_hash() . "; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'", false);
header('Content-Type: text/html; charset=utf-8');

if (!$page || $page['id'] === '404') {
    http_response_code(404);
    header('Cache-Control: no-store');
    $page = site_page($data, '404') ?? [
        'id' => '404', 'name' => ['en' => 'Page not found', 'id' => 'Halaman tidak ditemukan'], 'slug' => ['en' => '404', 'id' => '404'], 'title' => ['en' => '', 'id' => ''], 'desc' => ['en' => '', 'id' => ''],
        'inBar' => false, 'inMenu' => false,
        'sections' => [['id' => 'e404', 'kind' => 'band', 'name' => 'Page header', 'visible' => true, 'variant' => 'head-maize', 'children' => [
            ['id' => 'e404-h', 'type' => 'heading', 'level' => 1, 'visible' => true, 'style' => [], 'text' => ['en' => 'Page not found', 'id' => 'Halaman tidak ditemukan']]],
            'style' => ['layout' => 'stack', 'columns' => 1, 'padTop' => 40, 'padBottom' => 40, 'marginTop' => 0, 'marginBottom' => 0, 'gap' => 0, 'align' => 'left']]],
    ];
    echo render_page($page, $cx); exit;
}
// Cache: always revalidate, answer 304 when nothing changed
$etag = '"' . md5($cur['rev'] . '|' . $path . '|' . $assetVer . '|' . date('Y')) . '"';
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=0, must-revalidate');
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
if ($method === 'HEAD') exit;
echo render_page($page, $cx);
