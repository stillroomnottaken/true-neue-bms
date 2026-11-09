<?php
defined('APP_ROOT') or exit;
/**
 * Strict validation of the website model (pages → sections → elements, catalogue, design).
 * The admin editor is trusted to be well-behaved, but the SERVER never is: everything that will later be printed into
 * HTML or CSS is rebuilt here from an allow-list of fields, with enums, ranges, colours and URLs checked.
 * Unknown fields are dropped. Anything wrong throws Invalid with the path of the problem.
 */
final class Invalid extends RuntimeException {}

const SECTION_KINDS = ['hero', 'band', 'content', 'catalogue', 'cta', 'contact', 'form'];
const SECTION_VARIANTS = ['head-maize', 'head-gold', 'head-moss', 'head-forest', 'ribbon-maize', 'ribbon-gold', 'ribbon-moss', 'ribbon-noir', 'alt'];
const PARAGRAPH_VARIANTS = ['lead', 'muted', 'note'];
const CONTAINER_VARIANTS = ['card', 'channels', 'channel', 'steps', 'chips', 'crumbs', 'pair'];
const RESERVED_PAGE_IDS = ['whatsapp', 'email'];
const RESERVED_SLUGS = ['admin', 'api', 'assets', 'uploads', 'data', 'inc', 'tools', 'id', 'index', 'robots', 'sitemap', 'material'];

function bad(string $path, string $msg): never { throw new Invalid("$path: $msg"); }

function v_text(mixed $v, string $path, int $max = 500, bool $multiline = false): string {
    if ($v === null) return '';
    if (!is_string($v)) bad($path, 'must be text');
    if (strlen($v) > $max * 4) bad($path, 'text is too long');
    if (!preg_match('//u', $v)) bad($path, 'invalid characters');
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $v) ?? '';
    if (!$multiline) $v = trim(preg_replace('/\s*\n\s*/', ' ', $v) ?? '');
    if (mb_strlen($v) > $max) bad($path, "text is longer than $max characters");
    return $v;
}
function v_loc(mixed $v, string $path, int $max = 500, bool $ml = false): array {
    if ($v === null) $v = [];
    if (!is_array($v)) bad($path, 'must have en and id text');
    return ['en' => v_text($v['en'] ?? '', "$path.en", $max, $ml), 'id' => v_text($v['id'] ?? '', "$path.id", $max, $ml)];
}
function v_num(mixed $v, string $path, float $min, float $max, bool $int = false): int|float {
    if (is_string($v) && is_numeric($v)) $v = $v + 0;
    if (!(is_int($v) || is_float($v)) || !is_finite((float)$v)) bad($path, 'must be a number');
    $v = max($min, min($max, $v));
    return $int ? (int)round($v) : round((float)$v, 3);
}
function v_enum(mixed $v, string $path, array $allowed): string {
    if (!is_string($v) || !in_array($v, $allowed, true)) bad($path, 'must be one of: ' . implode(', ', $allowed));
    return $v;
}
function v_bool(mixed $v, string $path, bool $default = true): bool { if ($v === null) return $default; if (!is_bool($v)) bad($path, 'must be true or false'); return $v; }
function v_id(mixed $v, string $path): string {
    if (!is_string($v) || !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $v)) bad($path, 'invalid id');
    return $v;
}
/** CSS colour: #hex, var(--name), rgb()/rgba(), or a safe keyword. */
function v_color(mixed $v, string $path): string {
    if (!is_string($v)) bad($path, 'must be a colour');
    $v = trim($v);
    $ok = preg_match('/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $v)
       || preg_match('/^var\(--[a-z0-9-]{1,30}\)$/', $v)
       || preg_match('/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(?:0|1|0?\.\d{1,3}|1\.0+)\s*)?\)$/', $v)
       || in_array(strtolower($v), ['transparent', 'inherit', 'currentcolor'], true);
    if (!$ok) bad($path, 'not a valid colour');
    return $v;
}
/** Image / background URL: a path on this site or an https URL. No quotes, brackets or spaces, so it cannot leave url("...") or an attribute. */
function v_url(mixed $v, string $path): string {
    if ($v === null || $v === '') return '';
    if (!is_string($v) || strlen($v) > 500) bad($path, 'invalid image address');
    $ok = preg_match('#^/(?!/)[A-Za-z0-9._~/%+@!$&*,;=:-]*$#', $v) || preg_match('#^https://[A-Za-z0-9.-]+(?::\d{1,5})?(?:/[A-Za-z0-9._~/%+@!$&*,;=:?\#-]*)?$#', $v);
    if (!$ok || str_contains($v, '..')) bad($path, 'image address must be a path on this site (/uploads/…) or an https:// address');
    return $v;
}
/** Link target: "@pageid?query" (internal page), /path, https://, http://, mailto:, tel:, #anchor. Never javascript: or data:. */
function v_href(mixed $v, string $path): string {
    if ($v === null) return '';
    if (!is_string($v) || strlen($v) > 600) bad($path, 'invalid link');
    $v = trim($v);
    if ($v === '') return '';
    if (preg_match('/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i', $v) && !str_contains($v, ':')) $v = 'https://' . $v;     // "www.example.com" → https://
    $ok = preg_match('/^@[a-z0-9-]{1,60}(\?[A-Za-z0-9=&_%.-]{0,200})?$/', $v)
       || preg_match('#^/(?!/)[A-Za-z0-9._~/%+@!$&*,;=:?\#-]*$#', $v)
       || preg_match('#^https?://[A-Za-z0-9.-]+(:\d{1,5})?(/[A-Za-z0-9._~/%+@!$&*,;=:?\#-]*)?$#', $v)
       || preg_match('/^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/', $v)
       || preg_match('/^tel:\+?[0-9 ()-]{3,30}$/', $v)
       || preg_match('/^#[A-Za-z0-9_-]{1,60}$/', $v);
    if (!$ok) bad($path, 'link not allowed. Use a page (@page), /path, https://…, mailto: or tel:');
    return $v;
}

function clean_style(mixed $st, string $path): array {
    if ($st === null || $st === []) return [];
    if (!is_array($st)) bad($path, 'style must be an object');
    $o = [];
    foreach ($st as $k => $v) {
        if ($v === null) continue;
        $p = "$path.$k";
        switch ($k) {
            case 'font': $o[$k] = v_enum($v, $p, ['default', 'serif', 'sans', 'mono']); break;
            case 'size': $o[$k] = v_num($v, $p, 8, 200); break;
            case 'weight': $o[$k] = v_num($v, $p, 100, 900, true); break;
            case 'color': $o[$k] = v_color($v, $p); break;
            case 'align': $o[$k] = v_enum($v, $p, ['left', 'center', 'right']); break;
            case 'lineHeight': $o[$k] = v_num($v, $p, 0.5, 4); break;
            case 'letterSpacing': $o[$k] = v_num($v, $p, -10, 40); break;
            case 'maxWidth': $o[$k] = v_num($v, $p, 40, 3000); break;
            case 'width': $o[$k] = v_num($v, $p, 1, 100); break;
            case 'height': $o[$k] = v_num($v, $p, 0, 2000); break;
            case 'aspect': $o[$k] = v_enum($v, $p, ['auto', '1/1', '4/3', '16/9', '3/2']); break;
            case 'fit': $o[$k] = v_enum($v, $p, ['cover', 'contain', 'fill']); break;
            case 'position': if (!is_string($v) || !preg_match('/^[a-z0-9% .-]{1,40}$/i', $v)) bad($p, 'invalid position'); $o[$k] = $v; break;
            case 'radius': $o[$k] = v_num($v, $p, 0, 200); break;
            case 'self': $o[$k] = v_enum($v, $p, ['left', 'center', 'right']); break;
            case 'gap': $o[$k] = v_num($v, $p, 0, 200); break;
            case 'layout': $o[$k] = v_enum($v, $p, ['stack', 'row', 'grid']); break;
            case 'columns': $o[$k] = v_num($v, $p, 1, 6, true); break;
            default: /* unknown style keys are dropped */ break;
        }
    }
    return $o;
}

final class Ctx { public int $nodes = 0; }

function clean_node(mixed $n, string $path, int $depth, Ctx $ctx): array {
    if (!is_array($n)) bad($path, 'invalid element');
    if ($depth > 6) bad($path, 'containers are nested too deeply');
    if (++$ctx->nodes > 3000) bad($path, 'too many elements');
    $type = v_enum($n['type'] ?? null, "$path.type", ['heading', 'paragraph', 'richtext', 'eyebrow', 'image', 'button', 'link', 'divider', 'spacer', 'facts', 'card', 'graphic', 'container']);
    $o = ['id' => v_id($n['id'] ?? null, "$path.id"), 'type' => $type, 'visible' => v_bool($n['visible'] ?? null, "$path.visible"), 'style' => clean_style($n['style'] ?? [], "$path.style")];
    if (isset($n['name']) && $n['name'] !== '') $o['name'] = v_text($n['name'], "$path.name", 80);
    if (isset($n['only']) && $n['only'] !== '') $o['only'] = v_enum($n['only'], "$path.only", ['en', 'id']);
    switch ($type) {
        case 'heading': $o['level'] = v_num($n['level'] ?? 2, "$path.level", 1, 3, true); $o['text'] = v_loc($n['text'] ?? null, "$path.text", 600); break;
        case 'paragraph': case 'richtext':
            $o['text'] = v_loc($n['text'] ?? null, "$path.text", 8000, true);
            if (isset($n['variant']) && $n['variant'] !== '') $o['variant'] = v_enum($n['variant'], "$path.variant", PARAGRAPH_VARIANTS);
            break;
        case 'eyebrow': $o['text'] = v_loc($n['text'] ?? null, "$path.text", 200); break;
        case 'image': $o['src'] = v_url($n['src'] ?? '', "$path.src"); $o['alt'] = v_loc($n['alt'] ?? null, "$path.alt", 300); break;
        case 'button':
            $o['label'] = v_loc($n['label'] ?? null, "$path.label", 120); $o['href'] = v_href($n['href'] ?? '', "$path.href");
            if (isset($n['hrefId']) && $n['hrefId'] !== '') $o['hrefId'] = v_href($n['hrefId'], "$path.hrefId");
            $o['variant'] = v_enum($n['variant'] ?? 'forest', "$path.variant", ['forest', 'gold', 'maize', 'line']);
            $o['size'] = v_enum($n['size'] ?? 'md', "$path.size", ['sm', 'md', 'lg']); break;
        case 'link':
            $o['label'] = v_loc($n['label'] ?? null, "$path.label", 160); $o['href'] = v_href($n['href'] ?? '', "$path.href");
            if (isset($n['hrefId']) && $n['hrefId'] !== '') $o['hrefId'] = v_href($n['hrefId'], "$path.hrefId");
            break;
        case 'divider': case 'spacer': break;
        case 'facts':
            $rows = $n['rows'] ?? [];
            if (!is_array($rows) || count($rows) > 40) bad("$path.rows", 'too many rows');
            $o['rows'] = [];
            foreach (array_values($rows) as $i => $r) {
                if (!is_array($r)) bad("$path.rows[$i]", 'invalid row');
                $row = ['id' => v_id($r['id'] ?? null, "$path.rows[$i].id"), 'label' => v_loc($r['label'] ?? null, "$path.rows[$i].label", 200), 'value' => v_loc($r['value'] ?? null, "$path.rows[$i].value", 400)];
                if (!empty($r['soon'])) $row['soon'] = true;
                $o['rows'][] = $row;
            }
            break;
        case 'card':
            $o['variant'] = v_enum($n['variant'] ?? 'image', "$path.variant", ['image', 'step']);
            $o['title'] = v_loc($n['title'] ?? null, "$path.title", 200); $o['text'] = v_loc($n['text'] ?? null, "$path.text", 400); $o['src'] = v_url($n['src'] ?? '', "$path.src"); break;
        case 'graphic': $o['kind'] = v_enum($n['kind'] ?? null, "$path.kind", ['net', 'flow']); break;
        case 'container':
            if (isset($n['variant']) && $n['variant'] !== '') $o['variant'] = v_enum($n['variant'], "$path.variant", CONTAINER_VARIANTS);
            $o['children'] = clean_nodes($n['children'] ?? [], "$path.children", $depth + 1, $ctx); break;
    }
    return $o;
}
function clean_nodes(mixed $list, string $path, int $depth, Ctx $ctx): array {
    if (!is_array($list)) bad($path, 'must be a list');
    if (count($list) > 200) bad($path, 'too many elements in one place');
    $out = [];
    foreach (array_values($list) as $i => $n) $out[] = clean_node($n, "{$path}[$i]", $depth, $ctx);
    return $out;
}
function clean_section(mixed $s, string $path, Ctx $ctx): array {
    if (!is_array($s)) bad($path, 'invalid section');
    $st = $s['style'] ?? [];
    if (!is_array($st)) bad("$path.style", 'invalid');
    $style = [
        'layout' => v_enum($st['layout'] ?? 'stack', "$path.style.layout", ['stack', 'columns', 'grid']),
        'columns' => v_num($st['columns'] ?? 1, "$path.style.columns", 1, 6, true),
        'padTop' => v_num($st['padTop'] ?? 56, "$path.style.padTop", 0, 600), 'padBottom' => v_num($st['padBottom'] ?? 56, "$path.style.padBottom", 0, 600),
        'marginTop' => v_num($st['marginTop'] ?? 0, "$path.style.marginTop", -200, 600), 'marginBottom' => v_num($st['marginBottom'] ?? 0, "$path.style.marginBottom", -200, 600),
        'gap' => v_num($st['gap'] ?? 16, "$path.style.gap", 0, 200),
        'align' => v_enum($st['align'] ?? 'left', "$path.style.align", ['left', 'center', 'right', 'stretch']),
    ];
    if (isset($st['bg']) && $st['bg'] !== '') $style['bg'] = v_color($st['bg'], "$path.style.bg");
    if (isset($st['bgImage']) && $st['bgImage'] !== '') $style['bgImage'] = v_url($st['bgImage'], "$path.style.bgImage");
    if (isset($st['tone']) && $st['tone'] !== '') $style['tone'] = v_enum($st['tone'], "$path.style.tone", ['dark', 'light']);
    if (isset($st['contentWidth'])) $style['contentWidth'] = v_num($st['contentWidth'], "$path.style.contentWidth", 300, 2400);
    if (isset($st['minHeight'])) $style['minHeight'] = v_num($st['minHeight'], "$path.style.minHeight", 0, 3000);
    $out = [
        'id' => v_id($s['id'] ?? null, "$path.id"), 'kind' => v_enum($s['kind'] ?? null, "$path.kind", SECTION_KINDS),
        'name' => v_text($s['name'] ?? '', "$path.name", 100), 'visible' => v_bool($s['visible'] ?? null, "$path.visible"),
        'style' => $style, 'children' => clean_nodes($s['children'] ?? [], "$path.children", 0, $ctx),
    ];
    if (isset($s['variant']) && $s['variant'] !== '') $out['variant'] = v_enum($s['variant'], "$path.variant", SECTION_VARIANTS);
    if (isset($s['only']) && $s['only'] !== '') $out['only'] = v_enum($s['only'], "$path.only", ['en', 'id']);
    if (isset($s['href']) && $s['href'] !== '') $out['href'] = v_href($s['href'], "$path.href");
    if (isset($s['hrefId']) && $s['hrefId'] !== '') $out['hrefId'] = v_href($s['hrefId'], "$path.hrefId");
    if ($out['kind'] === 'form') {
        $out['form'] = v_enum($s['form'] ?? 'buyer', "$path.form", ['buyer', 'supplier']);
        $out['formTitle'] = v_loc($s['formTitle'] ?? null, "$path.formTitle", 200);
        $out['formHint'] = v_loc($s['formHint'] ?? null, "$path.formHint", 300);
    }
    return $out;
}
function v_slug(mixed $v, string $path): string {
    if ($v === null) return '';
    if (!is_string($v) || !preg_match('/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/', $v) || strlen($v) > 60) bad($path, 'use lowercase letters, numbers and hyphens');
    if (in_array($v, RESERVED_SLUGS, true)) bad($path, "“$v” is reserved");
    return $v;
}

/** Validate a full editor payload {pages, catalogue, design}. Returns the clean copy. */
function clean_content(mixed $in): array {
    if (!is_array($in)) bad('content', 'must be an object');
    $ctx = new Ctx();
    $pages = $in['pages'] ?? null;
    if (!is_array($pages) || !$pages || count($pages) > 30) bad('pages', 'must have 1 to 30 pages');
    $outPages = []; $ids = []; $slugs = ['en' => [], 'id' => []];
    foreach (array_values($pages) as $i => $p) {
        $pp = "pages[$i]";
        if (!is_array($p)) bad($pp, 'invalid page');
        $id = v_id($p['id'] ?? null, "$pp.id");
        if (in_array($id, RESERVED_PAGE_IDS, true)) bad("$pp.id", "“$id” is reserved");
        if (isset($ids[$id])) bad("$pp.id", 'duplicate page id');
        $ids[$id] = true;
        $slug = ['en' => v_slug($p['slug']['en'] ?? '', "$pp.slug.en"), 'id' => v_slug($p['slug']['id'] ?? '', "$pp.slug.id")];
        foreach (['en', 'id'] as $l) { if (isset($slugs[$l][$slug[$l]])) bad("$pp.slug.$l", 'two pages share the same address'); $slugs[$l][$slug[$l]] = true; }
        if ($id === 'home' && ($slug['en'] !== '' || $slug['id'] !== '')) bad("$pp.slug", 'the home page must stay at the root address');
        $secs = $p['sections'] ?? [];
        if (!is_array($secs) || count($secs) > 80) bad("$pp.sections", 'too many sections');
        $outPages[] = ['id' => $id, 'name' => v_loc($p['name'] ?? null, "$pp.name", 120), 'slug' => $slug,
            'title' => v_loc($p['title'] ?? null, "$pp.title", 200), 'desc' => v_loc($p['desc'] ?? null, "$pp.desc", 400),
            'inBar' => v_bool($p['inBar'] ?? null, "$pp.inBar", false), 'inMenu' => v_bool($p['inMenu'] ?? null, "$pp.inMenu", false),
            'sections' => array_map(fn($s, $j) => clean_section($s, "$pp.sections[$j]", $ctx), array_values($secs), array_keys(array_values($secs)))];
    }
    if (!isset($ids['home'])) bad('pages', 'a page with id "home" is required');

    $cat = $in['catalogue'] ?? [];
    if (!is_array($cat) || count($cat) > 300) bad('catalogue', 'too many entries');
    $outCat = []; $cslugs = [];
    foreach (array_values($cat) as $i => $c) {
        $cp = "catalogue[$i]";
        if (!is_array($c)) bad($cp, 'invalid entry');
        $slug = $c['slug'] ?? null;
        if (!is_string($slug) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 60) bad("$cp.slug", 'use lowercase letters, numbers and hyphens');
        if (isset($cslugs[$slug])) bad("$cp.slug", 'two entries share the same slug');
        $cslugs[$slug] = true;
        $e = ['id' => v_id($c['id'] ?? null, "$cp.id"), 'slug' => $slug, 'name' => v_loc($c['name'] ?? null, "$cp.name", 120), 'desc' => v_loc($c['desc'] ?? null, "$cp.desc", 600, true),
              'cat' => v_enum($c['cat'] ?? null, "$cp.cat", ['agri', 'bio', 'industrial']), 'image' => v_url($c['image'] ?? '', "$cp.image"), 'visible' => v_bool($c['visible'] ?? null, "$cp.visible")];
        if (!empty($c['detail'])) $e['detail'] = true;
        if (isset($c['info']) && is_array($c['info'])) $e['info'] = v_loc($c['info'], "$cp.info", 8000, true);
        if (isset($c['underline']) && $c['underline'] !== '') {
            if (!is_string($c['underline']) || !preg_match('/^#[0-9a-fA-F]{6}$/', $c['underline'])) bad("$cp.underline", 'must be a #RRGGBB colour');
            $e['underline'] = strtolower($c['underline']);
        }
        $outCat[] = $e;
    }

    $d = $in['design'] ?? null;
    if (!is_array($d)) bad('design', 'missing');
    $hex = function ($v, $p) { if (!is_string($v) || !preg_match('/^#[0-9a-fA-F]{6}$/', $v)) bad($p, 'must be a #RRGGBB colour'); return strtolower($v); };
    $design = [
        'primary' => $hex($d['primary'] ?? null, 'design.primary'), 'secondary' => $hex($d['secondary'] ?? null, 'design.secondary'), 'background' => $hex($d['background'] ?? null, 'design.background'),
        'font' => v_enum($d['font'] ?? 'default', 'design.font', ['default', 'serif', 'sans', 'mono']),
        'h1' => v_num($d['h1'] ?? 0, 'design.h1', 0, 120, true), 'body' => v_num($d['body'] ?? 16, 'design.body', 12, 30, true),
        'buttonStyle' => v_enum($d['buttonStyle'] ?? 'solid', 'design.buttonStyle', ['solid', 'outline']),
        'buttonRadius' => v_num($d['buttonRadius'] ?? 6, 'design.buttonRadius', 0, 60, true),
        'sectionSpacing' => v_num($d['sectionSpacing'] ?? 100, 'design.sectionSpacing', 20, 300, true),
        'contentWidth' => v_num($d['contentWidth'] ?? 1120, 'design.contentWidth', 600, 2000, true),
    ];
    return ['pages' => $outPages, 'catalogue' => $outCat, 'design' => $design, 'redirects' => clean_redirects($in['redirects'] ?? [])];
}

const REDIRECT_BLOCKED = ['/admin', '/api', '/assets', '/uploads', '/inc', '/data', '/tools'];
/** Normalise a request path for redirect matching: lowercase, no trailing slash ("/" stays "/"). */
function redirect_key(string $p): string {
    $p = strtolower(rawurldecode($p));
    return $p === '/' ? '/' : rtrim($p, '/');
}
/** Editable redirect rules: {id, from: "/old-address", to: "@page" | "/path" | "https://…", code: 301|302} */
function clean_redirects(mixed $in): array {
    if (!is_array($in)) bad('redirects', 'must be a list');
    if (count($in) > 200) bad('redirects', 'at most 200 redirects');
    $out = []; $seen = [];
    foreach (array_values($in) as $i => $r) {
        $rp = "redirects[$i]";
        if (!is_array($r)) bad($rp, 'invalid redirect');
        $from = is_string($r['from'] ?? null) ? trim($r['from']) : '';
        if (!preg_match('#^/[A-Za-z0-9._~/%-]{1,198}$#', $from)) bad("$rp.from", 'must start with / and use letters, numbers, - _ . only (no ? or #)');
        $key = redirect_key($from);
        if ($key === '/') bad("$rp.from", 'the home page cannot be redirected');
        foreach (REDIRECT_BLOCKED as $b) if ($key === $b || str_starts_with($key, $b . '/')) bad("$rp.from", 'this address belongs to the system');
        if (isset($seen[$key])) bad("$rp.from", 'two redirects start at the same address');
        $seen[$key] = true;
        $to = v_href($r['to'] ?? '', "$rp.to");
        if ($to === '' || $to === '#') bad("$rp.to", 'choose where it should go');
        if (str_starts_with($to, '/') && redirect_key(explode('?', $to)[0]) === $key) bad("$rp.to", 'a redirect cannot point to itself');
        $code = (int)($r['code'] ?? 301);
        if (!in_array($code, [301, 302], true)) bad("$rp.code", 'must be 301 or 302');
        $out[] = ['id' => v_id($r['id'] ?? null, "$rp.id"), 'from' => $from, 'to' => $to, 'code' => $code];
    }
    return $out;
}
