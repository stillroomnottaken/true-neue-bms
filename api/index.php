<?php
declare(strict_types=1);
/**
 * JSON API used by the admin editor (and the public enquiry form).
 *   GET  ?a=content | revisions | media | inquiries
 *   POST ?a=save | restore | upload | media_delete | inquiry_delete | password | logout
 *   POST ?a=inquiry                       (public: website contact form)
 * Every admin call needs a signed-in session. Every POST also needs the CSRF token (X-CSRF-Token header) and a same-site Origin.
 */
require dirname(__DIR__) . '/inc/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
$action = preg_replace('/[^a-z_]/', '', (string)($_GET['a'] ?? ''));
$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');

function body_json(int $max = 3_000_000): array {
    if (!str_starts_with(strtolower((string)($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json')) json_out(['error' => 'Expected JSON'], 415);
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) json_out(['error' => 'Request too large'], 413);
    $d = json_decode($raw, true, 64);
    if (!is_array($d)) json_out(['error' => 'Invalid JSON'], 400);
    return $d;
}

try {
    /* ───────── public: contact form ───────── */
    if ($action === 'inquiry') {
        if ($method !== 'POST') json_out(['error' => 'POST only'], 405);
        require_same_origin();
        $in = body_json(20_000);
        if (!empty($in['website'])) json_out(['ok' => true]);                  // honeypot: bots fill it, people never see it
        $key = rate_key('inq', client_ip());
        if (rate_blocked($key, 6, 600) > 0) json_out(['error' => 'Too many messages. Please try again later.'], 429);
        $t = fn($k, $max) => mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string)($in[$k] ?? '')) ?? ''), 0, $max);
        $phone = preg_replace('/\D/', '', (string)($in['phone'] ?? ''));
        // Indonesian local numbers (08..) -> international, same rule as the form script
        if (!str_starts_with(trim((string)($in['phone'] ?? '')), '+')) {
            if (str_starts_with($phone, '00')) $phone = substr($phone, 2);
            elseif (str_starts_with($phone, '0')) $phone = '62' . substr($phone, 1);
            elseif (str_starts_with($phone, '8')) $phone = '62' . $phone;
        }
        $hasPhone = strlen($phone) >= 9 && strlen($phone) <= 15;
        $email = $t('email', 120);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = '';
        $notes = $t('notes', 2000);
        if ($email !== '') $notes = trim($notes . "\nEmail: " . $email);
        $unitIn = (string)($in['unit'] ?? '');
        $q = [
            'id' => bin2hex(random_bytes(8)), 'at' => time(),
            'role' => ($in['role'] ?? '') === 'supplier' ? 'supplier' : 'buyer',
            'material' => $t('material', 120), 'quantity' => preg_match('/^\d{1,9}([.,]\d{1,3})?$/', $t('qty', 14)) ? $t('qty', 14) : '',
            'unit' => $unitIn === 'kg' ? 'kg' : ($unitIn === 'ton' ? 'ton' : ''), 'location' => $t('location', 120), 'notes' => $notes,
            'name' => $t('name', 100), 'company' => $t('company', 120), 'phone' => $hasPhone ? '+' . $phone : '', 'lang' => ($in['lang'] ?? '') === 'id' ? 'id' : 'en',
        ];
        // a name, a material and at least one way to reach the person (WhatsApp number or e-mail) are required
        if ($q['name'] === '' || $q['material'] === '' || (!$hasPhone && $email === '')) json_out(['error' => 'Please fill in the required fields.'], 422);
        rate_hit($key, 600);
        with_lock('inquiries', function () use ($q) {
            $all = store_read('inquiries', []);
            array_unshift($all, $q);
            store_write('inquiries', array_slice($all, 0, 1000));
        });
        if (($to = (string)cfg('notify_email', '')) !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $host = preg_replace('/:\d+$/', '', request_host());
            $msg = "New website enquiry ({$q['role']})\n\nMaterial: {$q['material']}\nQuantity: {$q['quantity']} {$q['unit']}\nLocation: {$q['location']}\nNotes: {$q['notes']}\n\nName: {$q['name']}\nCompany: {$q['company']}\nWhatsApp: {$q['phone']}\n";
            @mail($to, 'BMS website enquiry', $msg, "From: noreply@$host\r\nContent-Type: text/plain; charset=utf-8");
        }
        json_out(['ok' => true]);
    }

    /* ───────── everything else: signed-in admin only ───────── */
    $user = auth_user();
    if ($user === null) json_out(['error' => 'Not signed in'], 401);
    if ($method === 'POST') {
        require_same_origin();
        if (!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) json_out(['error' => 'Security token missing or expired. Reload the page.'], 403);
    } elseif ($method !== 'GET') json_out(['error' => 'Method not allowed'], 405);

    switch ($action) {
        case 'content': {
            if ($method !== 'GET') json_out(['error' => 'GET only'], 405);
            $c = content_current();
            json_out(['data' => $c['data'], 'rev' => (int)$c['rev'], 'savedAt' => (int)$c['savedAt'], 'user' => $user]);
        }
        case 'save': {
            $in = body_json();
            try { $clean = clean_content($in['data'] ?? null); } catch (Invalid $e) { json_out(['error' => 'Not saved. ' . $e->getMessage()], 422); }
            try { $new = content_publish($clean, $user, !empty($in['force']) ? null : (int)($in['base_rev'] ?? -1)); }
            catch (RuntimeException $e) { if ($e->getMessage() === 'conflict') json_out(['error' => 'A newer version was published by someone else.'], 409); throw $e; }
            audit('content-save', $user, 'rev ' . $new['rev']);
            json_out(['rev' => (int)$new['rev'], 'savedAt' => (int)$new['savedAt']]);
        }
        case 'revisions': json_out(['items' => revisions_list()]);
        case 'restore': {
            $id = (string)(body_json(2000)['id'] ?? '');
            if (!preg_match('/^r\d{1,9}$/', $id)) json_out(['error' => 'Bad version id'], 400);
            $r = store_read('revisions/' . $id);
            if (!is_array($r)) json_out(['error' => 'That version no longer exists'], 404);
            try { $clean = clean_content($r['data']); } catch (Invalid $e) { json_out(['error' => 'That version cannot be restored: ' . $e->getMessage()], 422); }
            $new = content_publish($clean, $user, null, 'Restored version from ' . date('Y-m-d H:i', (int)$r['savedAt']));
            audit('content-restore', $user, $id);
            json_out(['rev' => (int)$new['rev']]);
        }

        case 'media': json_out(['items' => media_list()]);
        case 'upload': json_out(['item' => media_upload($user)]);
        case 'media_delete': {
            $id = (string)(body_json(2000)['id'] ?? '');
            media_delete($id, $user);
            json_out(['ok' => true]);
        }

        case 'inquiries': json_out(['items' => store_read('inquiries', [])]);
        case 'inquiry_delete': {
            $id = (string)(body_json(2000)['id'] ?? '');
            with_lock('inquiries', function () use ($id) { store_write('inquiries', array_values(array_filter(store_read('inquiries', []), fn($q) => $q['id'] !== $id))); });
            json_out(['ok' => true]);
        }

        case 'password': {
            $in = body_json(4000);
            $cur = (string)($in['current'] ?? ''); $new = (string)($in['next'] ?? '');
            $users = users_all();
            $key = rate_key('pw-change', $user);
            if (rate_blocked($key, 5, 900) > 0) json_out(['error' => 'Too many attempts. Try again later.'], 429);
            if (!password_verify($cur, $users[$user]['hash'] ?? DUMMY_HASH)) { rate_hit($key, 900); audit('password-change-fail', $user); json_out(['error' => 'Current password is not correct.'], 403); }
            if (mb_strlen($new) < 12) json_out(['error' => 'The new password must be at least 12 characters.'], 422);
            if (strlen($new) > 200) json_out(['error' => 'The new password is too long.'], 422);
            if (strtolower($new) === strtolower($user) || $new === $cur) json_out(['error' => 'Choose a different password.'], 422);
            user_set_password($user, $new, true);
            $_SESSION['auth']['pwv'] = (int)users_all()[$user]['pwv'];      // keep THIS session signed in, end all others
            rate_clear($key);
            audit('password-change', $user);
            json_out(['ok' => true]);
        }
        case 'logout': audit('logout', $user); auth_logout(); json_out(['ok' => true]);
        default: json_out(['error' => 'Unknown action'], 404);
    }
} catch (Throwable $e) {
    error_log('[api] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    json_out(['error' => 'Server error. Nothing was changed.'], 500);
}

/* ───────── media ───────── */
function media_list(): array {
    $items = [];
    foreach (glob(APP_ROOT . '/assets/img/*.{webp,png,jpg,jpeg,gif}', GLOB_BRACE) ?: [] as $f) {
        $n = basename($f);
        $items[] = ['id' => 'site-' . substr(md5($n), 0, 10), 'name' => $n, 'src' => '/assets/img/' . rawurlencode($n), 'origin' => 'project'];
    }
    foreach (store_read('media', []) as $id => $m) $items[] = ['id' => $id, 'name' => $m['name'], 'src' => '/uploads/' . $m['file'], 'origin' => 'upload'];
    return $items;
}
function media_upload(string $user): array {
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || is_array($f['error'] ?? null)) json_out(['error' => 'No file received'], 400);
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) json_out(['error' => 'The file is too large for this server.'], 413);
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) json_out(['error' => 'Upload failed'], 400);
    $max = (int)cfg('upload_max_bytes', 5242880);
    if ($f['size'] <= 0 || $f['size'] > $max) json_out(['error' => 'Image must be under ' . round($max / 1048576) . ' MB.'], 413);

    $types = ['image/jpeg' => ['jpg', IMAGETYPE_JPEG], 'image/png' => ['png', IMAGETYPE_PNG], 'image/webp' => ['webp', IMAGETYPE_WEBP], 'image/gif' => ['gif', IMAGETYPE_GIF]];
    $mime = function_exists('finfo_open') ? (string)finfo_file(finfo_open(FILEINFO_MIME_TYPE), $f['tmp_name']) : (string)(getimagesize($f['tmp_name'])['mime'] ?? '');
    $info = @getimagesize($f['tmp_name']);
    if (!isset($types[$mime]) || !$info || $info[2] !== $types[$mime][1]) json_out(['error' => 'Only real JPG, PNG, WebP or GIF images are accepted.'], 415);
    if ($info[0] < 1 || $info[1] < 1 || $info[0] > 8000 || $info[1] > 8000 || $info[0] * $info[1] > 40_000_000) json_out(['error' => 'Image dimensions are too large (max 8000 px).'], 413);
    $bytes = (string)file_get_contents($f['tmp_name']);
    if (preg_match('/<\?(php|=)|<script/i', $bytes)) json_out(['error' => 'This file contains code and was rejected.'], 415);

    $dir = rtrim((string)cfg('upload_dir'), '/\\');
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) json_out(['error' => 'Upload folder is not writable'], 500);
    $id = bin2hex(random_bytes(8));
    $file = $id . '.' . $types[$mime][0];                       // random name + extension chosen by us from the real type
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $file)) json_out(['error' => 'Could not store the image'], 500);
    @chmod($dir . '/' . $file, 0644);
    $name = preg_replace('/[^A-Za-z0-9 ._-]/', '', pathinfo((string)$f['name'], PATHINFO_FILENAME)) ?: 'image';
    $name = mb_substr(trim($name), 0, 60) . '.' . $types[$mime][0];
    with_lock('media', function () use ($id, $file, $name, $user, $f) {
        $m = store_read('media', []);
        $m[$id] = ['file' => $file, 'name' => $name, 'at' => time(), 'by' => $user, 'bytes' => (int)$f['size']];
        store_write('media', $m);
    });
    audit('upload', $user, $file);
    return ['id' => $id, 'name' => $name, 'src' => '/uploads/' . $file, 'origin' => 'upload'];
}
function media_delete(string $id, string $user): void {
    if (!preg_match('/^[a-f0-9]{16}$/', $id)) json_out(['error' => 'Bad id'], 400);
    with_lock('media', function () use ($id, $user) {
        $m = store_read('media', []);
        if (!isset($m[$id])) json_out(['error' => 'Image not found'], 404);
        $url = '/uploads/' . $m[$id]['file'];
        $live = json_encode(content_current()['data'], JSON_UNESCAPED_SLASHES);
        if (str_contains((string)$live, $url)) json_out(['error' => 'This image is used on the live website. Remove it from the page, publish, then delete it.'], 409);
        @unlink(rtrim((string)cfg('upload_dir'), '/\\') . '/' . $m[$id]['file']);
        unset($m[$id]);
        store_write('media', $m);
        audit('media-delete', $user, $id);
    });
}
