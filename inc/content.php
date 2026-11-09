<?php
defined('APP_ROOT') or exit;

/** Current published content: ['rev'=>int,'savedAt'=>int,'by'=>string,'data'=>array]. Creates it from the shipped seed on first run. */
function content_current(): array {
    $c = store_read('content');
    if (is_array($c) && isset($c['data'], $c['rev'])) return content_needs_pages($c['data']) ? content_add_pages() : $c;
    return with_lock('content', function () {
        $c = store_read('content');
        if (is_array($c) && isset($c['data'], $c['rev'])) return $c;
        $seed = json_decode((string)file_get_contents(APP_ROOT . '/inc/seed.json'), true);
        $c = ['rev' => 1, 'savedAt' => time(), 'by' => 'setup', 'data' => clean_content($seed)];
        store_write('content', $c);
        return $c;
    });
}
/** Sites set up before the public pages were driven by the editor hold a page model that is missing the For buyers / For suppliers
 *  pages (and has two pages, Processed products and How we work, that were never on the public site). */
function content_needs_pages(array $data): bool {
    $ids = array_column($data['pages'] ?? [], 'id');
    return !in_array('buyers', $ids, true) || !in_array('supplier', $ids, true);
}
/** One-time upgrade: replace the pages with the shipped ones (the real site text) and keep the saved catalogue and design.
 *  The previous version stays in Version history. */
function content_add_pages(): array {
    return with_lock('content', function () {
        $c = store_read('content');
        if (!(is_array($c) && isset($c['data'], $c['rev'])) || !content_needs_pages($c['data'])) return $c;
        $seed = json_decode((string)file_get_contents(APP_ROOT . '/inc/seed.json'), true);
        $design = $c['data']['design'] ?? $seed['design'];
        if (strtolower((string)($design['primary'] ?? '')) === '#90c207') $design['primary'] = $seed['design']['primary'];   // the editor's old default was not the site's real green
        $merged = ['pages' => $seed['pages'], 'catalogue' => $c['data']['catalogue'] ?? $seed['catalogue'], 'design' => $design];
        try { $clean = clean_content($merged); } catch (Invalid) { $clean = clean_content($seed); }
        store_write('revisions/r' . (int)$c['rev'], ['rev' => (int)$c['rev'], 'savedAt' => $c['savedAt'], 'by' => $c['by'] ?? '', 'note' => $c['note'] ?? '', 'data' => $c['data']]);
        $new = ['rev' => (int)$c['rev'] + 1, 'savedAt' => time(), 'by' => 'upgrade', 'note' => 'Website pages moved into the editor', 'data' => $clean];
        store_write('content', $new);
        return $new;
    });
}
/** Publish new content. Keeps the previous version in the history. Throws RuntimeException('conflict') when $baseRev is stale. */
function content_publish(array $clean, string $by, ?int $baseRev, string $note = ''): array {
    return with_lock('content', function () use ($clean, $by, $baseRev, $note) {
        $cur = content_current();
        if ($baseRev !== null && $baseRev !== (int)$cur['rev']) throw new RuntimeException('conflict');
        store_write('revisions/r' . (int)$cur['rev'], ['rev' => (int)$cur['rev'], 'savedAt' => $cur['savedAt'], 'by' => $cur['by'], 'note' => $cur['note'] ?? '', 'data' => $cur['data']]);
        $new = ['rev' => (int)$cur['rev'] + 1, 'savedAt' => time(), 'by' => $by, 'note' => $note, 'data' => $clean];
        store_write('content', $new);
        // keep only the newest N history entries
        $keep = (int)cfg('revisions_keep', 30);
        $revs = store_list('revisions');
        usort($revs, fn($a, $b) => (int)substr(basename($b), 1) <=> (int)substr(basename($a), 1));
        foreach (array_slice($revs, $keep) as $old) store_delete($old);
        return $new;
    });
}
function revisions_list(): array {
    $out = [];
    foreach (store_list('revisions') as $name) {
        $r = store_read($name);
        if (!is_array($r)) continue;
        $out[] = ['id' => 'r' . (int)$r['rev'], 'at' => (int)$r['savedAt'], 'by' => (string)($r['by'] ?? ''), 'note' => (string)($r['note'] ?? ''), 'bytes' => strlen(json_encode($r['data']))];
    }
    usort($out, fn($a, $b) => $b['at'] <=> $a['at']);
    return $out;
}
