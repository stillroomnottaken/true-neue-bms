<?php
defined('APP_ROOT') or exit;
/**
 * Public website renderer. Every page, section and element on the public site is drawn from the content that is edited
 * in Admin → Website Editor (pages → sections → elements, plus the catalogue and the design settings).
 * There are no HTML page files any more: change the text, layout or catalogue in the editor, press Save & publish, it is live.
 * The only things that do not come from the editor are the company facts in config.php (WhatsApp number, e-mail, NIB)
 * and the small fixed UI words (menu, footer, form labels) in SITE_TEXT / inc/forms.php.
 */
require_once __DIR__ . '/forms.php';

function e(mixed $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

const SITE_TEXT = [
    'en' => ['cta' => 'Contact us about this', 'buy' => 'BUY', 'sup' => 'SUPPLY', 'buyAria' => 'Buy from BMS (buyer)', 'supAria' => 'Supply to BMS (supplier)',
             'moreH' => 'Not listed?', 'moreP' => 'Other relevant industrial materials are welcome. Tell us what you need or can supply.',
             'skip' => 'Skip to content', 'menu' => 'Menu', 'close' => 'Close', 'contact' => 'Contact', 'chat' => 'Chat on WhatsApp', 'language' => 'Language', 'nav' => 'Primary',
             'all' => 'All', 'filter' => 'Filter by category', 'locale' => 'en_US', 'empty' => 'No materials to show yet.',
             'cat' => ['agri' => 'Agricultural commodities', 'bio' => 'Bio-based materials', 'industrial' => 'Industrial'], 'other' => 'Other relevant materials',
             'asideLabel' => 'Other ways to reach us', 'aboutM' => 'About %s', 'intM' => 'Interested in %s?', 'intP' => 'Tell us what you need or can supply. We reply on the channel you use.', 'contactUs' => 'CONTACT US'],
    'id' => ['cta' => 'Hubungi kami tentang ini', 'buy' => 'BELI', 'sup' => 'PASOK', 'buyAria' => 'Beli dari BMS (pembeli)', 'supAria' => 'Pasok ke BMS (pemasok)',
             'moreH' => 'Tidak ada di daftar?', 'moreP' => 'Material industri lain yang relevan juga kami terima. Beri tahu kami apa yang Anda butuhkan atau bisa pasok.',
             'skip' => 'Langsung ke konten', 'menu' => 'Menu', 'close' => 'Tutup', 'contact' => 'Kontak', 'chat' => 'Chat via WhatsApp', 'language' => 'Bahasa', 'nav' => 'Utama',
             'all' => 'Semua', 'filter' => 'Filter berdasarkan kategori', 'locale' => 'id_ID', 'empty' => 'Belum ada material untuk ditampilkan.',
             'cat' => ['agri' => 'Komoditas pertanian', 'bio' => 'Bahan berbasis hayati', 'industrial' => 'Industri'], 'other' => 'Material relevan lainnya',
             'asideLabel' => 'Cara lain menghubungi kami', 'aboutM' => 'Tentang %s', 'intM' => 'Tertarik dengan %s?', 'intP' => 'Beri tahu kami apa yang Anda butuhkan atau bisa pasok. Kami membalas lewat saluran yang Anda pakai.', 'contactUs' => 'HUBUNGI KAMI'],
];

/* ───────────────────────── pages & links ───────────────────────── */

function site_page(array $data, string $id): ?array {
    foreach ($data['pages'] as $p) if ($p['id'] === $id) return $p;
    return null;
}
function page_path(array $data, string $id, string $lang): string {
    $p = site_page($data, $id);
    $slug = $p ? (string)($p['slug'][$lang] ?? '') : '';
    return $lang === 'en' ? ($slug === '' ? '/' : "/$slug") : ($slug === '' ? '/id/' : "/id/$slug");
}
/** The page that lives at a request path like "about" (lang en) or "tentang" (lang id); null = not found. */
function find_page(array $data, string $lang, string $rest): ?array {
    foreach ($data['pages'] as $p) if ((string)($p['slug'][$lang] ?? '') === $rest) return $p;
    return null;
}
/** Catalogue entry by slug (visible or not) */
function material_by_slug(array $data, string $slug): ?array {
    foreach ($data['catalogue'] ?? [] as $m) if ($m['slug'] === $slug) return $m;
    return null;
}
function material_has_info(array $m): bool {
    return trim((string)($m['info']['en'] ?? '')) !== '' || trim((string)($m['info']['id'] ?? '')) !== '';
}
/** Where a catalogue name links to: its own editor page (detail), or the generated "further explanation" page; null = plain text. */
function material_link(array $data, array $m, string $lang): ?string {
    if (!empty($m['detail']) && site_page($data, $m['slug']) !== null) return page_path($data, $m['slug'], $lang);
    if (material_has_info($m)) return ($lang === 'en' ? '' : '/id') . '/material/' . $m['slug'];
    return null;
}
function catalogue_items(array $data): array {
    return array_values(array_filter($data['catalogue'] ?? [], fn($m) => !empty($m['visible'])));
}

/** Render context: everything a renderer needs to know. */
function site_ctx(array $data, string $lang, array $site, string $saveVer = ''): array {
    return ['data' => $data, 'lang' => $lang, 'site' => $site, 'saveVer' => $saveVer, 'ribbon' => false, 't' => SITE_TEXT[$lang]];
}
/** {count} {nib} {email} {wa} {year} inside editable text */
function tok(string $s, array $cx): string {
    if (!str_contains($s, '{')) return $s;
    return strtr($s, ['{count}' => (string)count(catalogue_items($cx['data'])), '{nib}' => (string)$cx['site']['nib'], '{email}' => (string)$cx['site']['email'],
                      '{wa}' => (string)$cx['site']['whatsapp'], '{year}' => date('Y')]);
}
/** @return array{0:string,1:bool} [url, opens in a new tab] */
function resolve_href(string $href, array $cx): array {
    if (str_starts_with($href, '@')) {
        [$key, $qs] = array_pad(explode('?', substr($href, 1), 2), 2, null);
        $q = $qs !== null && $qs !== '' ? '?' . $qs : '';
        if ($key === 'whatsapp') return ['https://wa.me/' . $cx['site']['whatsapp'] . $q, true];
        if ($key === 'email') return ['mailto:' . $cx['site']['email'] . $q, false];
        if (site_page($cx['data'], $key) === null) return ['#', false];
        return [page_path($cx['data'], $key, $cx['lang']) . $q, false];
    }
    if ($href === '') return ['#', false];
    return [$href, (bool)preg_match('#^https?://#', $href)];
}
function href_for(array $n, array $cx): array {
    $h = (string)($n['href'] ?? '');
    if ($cx['lang'] === 'id' && !empty($n['hrefId'])) $h = (string)$n['hrefId'];
    return resolve_href($h, $cx);
}
function link_attrs(array $r): string {
    return ' href="' . e($r[0]) . '"' . ($r[1] ? ' target="_blank" rel="noopener noreferrer"' : '');
}

/* ───────────────────────── small helpers ───────────────────────── */

function num(int|float $v): string { return rtrim(rtrim(number_format((float)$v, 3, '.', ''), '0'), '.'); }
function lt(mixed $loc, array $cx): string {   // localised text, with tokens replaced
    if (!is_array($loc)) return '';
    return tok((string)($loc[$cx['lang']] ?? ''), $cx);
}
function hidden_here(array $x, array $cx): bool {
    return empty($x['visible']) || (!empty($x['only']) && $x['only'] !== $cx['lang']);
}
const FONT_CSS = ['serif' => 'var(--serif)', 'sans' => 'var(--sans)', 'mono' => 'ui-monospace,Menlo,monospace'];
function text_css(array $s, bool $withAlign = true): string {
    $o = [];
    if (($s['font'] ?? 'default') !== 'default') $o[] = 'font-family:' . FONT_CSS[$s['font']];
    if (isset($s['size'])) $o[] = 'font-size:' . num($s['size']) . 'px';
    if (isset($s['weight'])) $o[] = 'font-weight:' . (int)$s['weight'];
    if (isset($s['color'])) $o[] = 'color:' . $s['color'];
    if ($withAlign && isset($s['align'])) $o[] = 'text-align:' . $s['align'];
    if (isset($s['lineHeight'])) $o[] = 'line-height:' . num($s['lineHeight']);
    if (isset($s['letterSpacing'])) $o[] = 'letter-spacing:' . num($s['letterSpacing']) . 'px';
    return implode(';', $o);
}
function style_attr(string ...$parts): string {
    $p = array_values(array_filter($parts, fn($x) => $x !== ''));
    return $p ? ' style="' . e(implode(';', $p)) . '"' : '';
}
/** responsive padding: the number is the desktop value, it shrinks on small screens like the original stylesheet did */
function pad_css(string $prop, int|float $px): string {
    $px = max(0, $px);
    if ($px <= 12) return "$prop:" . num($px) . 'px';
    return "$prop:clamp(" . num(round($px * 0.57, 1)) . 'px,' . num(round($px / 11.2, 2)) . 'vw,' . num($px) . 'px)';
}

/* ───────────────────────── graphics ───────────────────────── */

function g_net(string $lang): string {
    [$a, $b] = $lang === 'en' ? ['Suppliers', 'Buyers'] : ['Pemasok', 'Pembeli'];
    $aria = $lang === 'en' ? 'Suppliers to BMS to buyers' : 'Pemasok ke BMS ke pembeli';
    $ys = [60, 140, 220, 300]; $paths = ''; $dots = '';
    foreach ($ys as $y) {
        $paths .= "<path class=\"ln\" d=\"M52 $y C150 $y 150 180 206 180\"/><path class=\"ln\" d=\"M314 180 C370 180 370 $y 468 $y\"/>";
        $dots .= "<circle class=\"src\" cx=\"40\" cy=\"$y\" r=\"11\"/><circle class=\"dst\" cx=\"480\" cy=\"$y\" r=\"11\"/>";
    }
    return '<svg class="net rs-net" viewBox="0 0 520 400" role="img" aria-label="' . e($aria) . '"><g>' . $paths . '</g>' . $dots
        . '<circle class="halo" cx="260" cy="180" r="64"/><circle class="core" cx="260" cy="180" r="50"/><text class="core-t" x="260" y="188" text-anchor="middle">BMS</text>'
        . '<rect class="pill" x="-10" y="344" width="100" height="34" rx="17"/><text class="lbl" x="40" y="366" text-anchor="middle">' . e($a) . '</text>'
        . '<rect class="pill" x="430" y="344" width="100" height="34" rx="17"/><text class="lbl" x="480" y="366" text-anchor="middle">' . e($b) . '</text></svg>';
}
function g_flow(string $lang): string {
    $steps = [
        [$lang === 'en' ? 'Supplier' : 'Pemasok', false, '<path d="M32 58V30"/><path d="M32 40c-9 0-15-6-15-15 9 0 15 6 15 15z"/><path d="M32 32c0-9 6-15 15-15 0 9-6 15-15 15z"/><path d="M20 58h24"/>'],
        ['BMS', true, '<path d="M32 6 56 19v26L32 58 8 45V19z"/><path d="M8 19l24 13 24-13"/><path d="M32 32v26"/>'],
        [$lang === 'en' ? 'Business opportunity' : 'Peluang bisnis', false, '<path d="M6 46 22 30l10 10 24-24"/><path d="M42 16h14v14"/>'],
    ];
    $o = '<div class="rs-flow-wrap bigflow">';
    foreach ($steps as $i => [$t, $core, $d]) {
        if ($i > 0) $o .= '<div class="bf-arrow" aria-hidden="true">→</div>';
        $o .= '<div class="bf-step' . ($core ? ' bf-core' : '') . '"><svg class="bf-ico" viewBox="0 0 64 64" aria-hidden="true">' . $d . '</svg><p class="bf-t">' . e($t) . '</p></div>';
    }
    return $o . '</div>';
}

/* ───────────────────────── elements ───────────────────────── */

function r_nodes(array $list, array $cx): string {
    $o = '';
    foreach ($list as $n) $o .= r_node($n, $cx);
    return $o;
}
function r_node(array $n, array $cx): string {
    if (hidden_here($n, $cx)) return '';
    $s = $n['style'] ?? [];
    $type = $n['type'];
    $wrap = [];
    if (isset($s['width'])) $wrap[] = 'width:' . num($s['width']) . '%';
    if (isset($s['maxWidth'])) $wrap[] = 'max-width:' . num($s['maxWidth']) . 'px';
    if (isset($s['self'])) $wrap[] = 'justify-self:' . ['left' => 'start', 'center' => 'center', 'right' => 'end'][$s['self']];
    $t = text_css($s);
    $body = '';
    switch ($type) {
        case 'heading': { $l = max(1, min(3, (int)$n['level'])); $body = "<h$l" . style_attr($t) . '>' . e(lt($n['text'], $cx)) . "</h$l>"; break; }
        case 'paragraph': {
            $c = !empty($n['variant']) ? ' class="' . e($n['variant']) . '"' : '';
            $body = '<p' . $c . style_attr($t) . '>' . e(lt($n['text'], $cx)) . '</p>'; break;
        }
        case 'richtext': $body = '<p' . style_attr($t, 'white-space:pre-wrap') . '>' . e(lt($n['text'], $cx)) . '</p>'; break;
        case 'eyebrow':
            $body = $cx['ribbon'] ? '<span class="ribbon-tag"' . style_attr($t) . '>' . e(lt($n['text'], $cx)) . '</span>'
                                  : '<p class="eyebrow"' . style_attr($t) . '>' . e(lt($n['text'], $cx)) . '</p>';
            break;
        case 'button': {
            $cls = 'btn btn-' . $n['variant'] . ($n['size'] === 'lg' ? ' btn-lg' : ($n['size'] === 'sm' ? ' btn-sm' : ''));
            $st = style_attr(isset($s['radius']) ? 'border-radius:' . num($s['radius']) . 'px' : '', text_css($s, false));
            $body = '<a class="' . $cls . '"' . link_attrs(href_for($n, $cx)) . $st . '><span>' . e(lt($n['label'], $cx)) . '</span></a>'; break;
        }
        case 'link': {
            $st = style_attr(text_css($s), 'text-decoration:underline', 'font-weight:' . (int)($s['weight'] ?? 600));
            $body = '<a class="rs-link"' . link_attrs(href_for($n, $cx)) . $st . '><span>' . e(lt($n['label'], $cx)) . '</span></a>'; break;
        }
        case 'divider': $body = '<hr class="rs-divider"' . style_attr(isset($s['color']) ? 'border-top-color:' . $s['color'] : '', isset($s['height']) && $s['height'] ? 'border-top-width:' . num(min($s['height'], 12)) . 'px' : '') . '>'; break;
        case 'spacer': $body = '<div style="height:' . num($s['height'] ?? 32) . 'px" aria-hidden="true"></div>'; break;
        case 'image': {
            $img = [];
            if (!empty($s['height'])) $img[] = 'height:' . num($s['height']) . 'px';
            elseif (!empty($s['aspect']) && $s['aspect'] !== 'auto') $img[] = 'aspect-ratio:' . $s['aspect'];
            $img[] = 'object-fit:' . ($s['fit'] ?? 'cover');
            if (isset($s['position'])) $img[] = 'object-position:' . $s['position'];
            if (isset($s['radius'])) $img[] = 'border-radius:' . num($s['radius']) . 'px';
            $alt = lt($n['alt'], $cx);
            $body = ($n['src'] ?? '') !== ''
                ? '<img class="rs-img" src="' . e($n['src']) . '" alt="' . e($alt) . '"' . style_attr(...$img) . ' loading="lazy" decoding="async">'
                : '<div class="rs-img rs-img-ph" role="img" aria-label="' . e($alt) . '"' . style_attr(...$img) . '></div>';
            break;
        }
        case 'card': {
            $title = lt($n['title'], $cx);
            if ($n['variant'] === 'step') $body = '<div class="rs-step"><b>' . e($title) . '</b><span>' . e(lt($n['text'], $cx)) . '</span></div>';
            else $body = '<article class="ind">' . (($n['src'] ?? '') !== '' ? '<img class="ind-img" src="' . e($n['src']) . '" alt="' . e($title) . '" loading="lazy" decoding="async">' : '<div class="ind-img ind-ph" role="img" aria-label="' . e($title) . '"></div>')
                . '<h3>' . e($title) . '</h3></article>';
            break;
        }
        case 'facts': {
            $body = '<dl class="facts">';
            foreach ($n['rows'] as $r) $body .= '<div><dt>' . e(lt($r['label'], $cx)) . '</dt><dd' . (!empty($r['soon']) ? ' class="soon"' : '') . '>' . e(lt($r['value'], $cx)) . '</dd></div>';
            $body .= '</dl>'; break;
        }
        case 'graphic': $body = $n['kind'] === 'net' ? g_net($cx['lang']) : g_flow($cx['lang']); break;
        case 'container': {
            $layout = $s['layout'] ?? 'stack';
            $var = $n['variant'] ?? '';
            $cols = $layout === 'grid' ? (int)($s['columns'] ?? 2) : 1;
            $kids = array_values(array_filter($n['children'], fn($k) => !hidden_here($k, $cx)));
            $cls = $layout === 'row' ? 'rs-flex' : 'rs-grid';
            $cls .= ['card' => ' card', 'channels' => ' channels', 'channel' => ' channel', 'pair' => ' pair rs-v-pair', 'steps' => ' rs-steps', 'chips' => ' rs-chips', 'crumbs' => ' rs-crumbs'][$var] ?? '';
            $vars = '--gap:' . num($s['gap'] ?? 12) . 'px;--c:' . $cols . ';--ct:' . ($cols >= 3 ? 2 : 1) . ';--cm:1';
            if ($var === 'steps') { $vars .= ';--n:' . max(1, count($kids)); $cls = 'rs-steps steps'; }
            $body = '<div class="' . $cls . '" style="' . e($vars) . '">' . r_nodes($n['children'], $cx) . '</div>';
            break;
        }
    }
    return '<div class="rs-node rs-' . $type . '"' . style_attr(...$wrap) . '>' . $body . '</div>';
}

/* ───────────────────────── catalogue + forms ───────────────────────── */

function cat_pair(array $cx, string $slug): string {
    $t = $cx['t']; $l = $cx['lang']; $q = '?material=' . rawurlencode($slug);
    return '<div class="pair">' . "\n"
        . '  <a class="btn btn-forest btn-need" href="' . e(page_path($cx['data'], 'buyers', $l) . $q) . '" aria-label="' . e($t['buyAria']) . '">' . e($t['buy']) . '</a>' . "\n"
        . '  <a class="btn btn-gold" href="' . e(page_path($cx['data'], 'supplier', $l) . $q) . '" aria-label="' . e($t['supAria']) . '">' . e($t['sup']) . '</a>' . "\n"
        . '</div>' . "\n";
}
function cat_cta(array $cx, string $slug): string {
    return '        <div class="mat-body">' . "\n" . '          <div class="mat-cta">' . "\n" . '            <small>' . e($cx['t']['cta']) . '</small>' . "\n"
        . '            ' . cat_pair($cx, $slug) . "\n" . '          </div>' . "\n" . '        </div>' . "\n";
}
function render_catalogue(array $cx, int $cols = 3): string {
    $t = $cx['t']; $lang = $cx['lang']; $data = $cx['data'];
    $filters = '<button class="filter" type="button" data-filter="all" aria-pressed="true">' . e($t['all']) . '</button>';
    foreach ($t['cat'] as $k => $label) $filters .= '<button class="filter" type="button" data-filter="' . e($k) . '" aria-pressed="false">' . e($label) . '</button>';
    $o = '<div class="filters" role="group" aria-label="' . e($t['filter']) . '">' . $filters . '</div>' . "\n"
       . '<div class="mat-grid" style="--c:' . max(1, min(6, $cols)) . '">';
    foreach (catalogue_items($data) as $m) {
        $name = (string)($m['name'][$lang] ?? '') !== '' ? (string)$m['name'][$lang] : (string)($m['name']['en'] ?? '');
        $slug = (string)$m['slug'];
        $link = material_link($data, $m, $lang);
        $h3 = $link !== null
            ? '<a href="' . e($link) . '"' . (!empty($m['underline']) ? ' style="border-bottom-color:' . e($m['underline']) . '"' : '') . '>' . e($name) . '</a>'
            : e($name);
        $img = ($m['image'] ?? '') !== ''
            ? '<img class="mat-img" src="' . e($m['image']) . '" alt="' . e($name) . '" width="640" height="360" loading="lazy" decoding="async">'
            : '<div class="mat-img mat-ph" role="img" aria-label="' . e($name) . '"></div>';
        $desc = (string)($m['desc'][$lang] ?? '');
        $o .= "\n" . '      <article class="mat" data-cat="' . e($m['cat']) . '">' . "\n"
            . '        <div class="mat-body mat-head"><h3>' . $h3 . '</h3></div>' . "\n" . $img . ($desc !== '' ? "\n" . '        <p class="mat-desc" style="padding:10px 16px 0;margin:0">' . e($desc) . '</p>' : '') . "\n"
            . cat_cta($cx, $slug) . '      </article>';
    }
    $o .= "\n" . '      <article class="mat mat-more">' . "\n" . '        <div class="mat-body">' . "\n" . '          <h3>' . e($t['moreH']) . '</h3>' . "\n" . '          <p>' . e($t['moreP']) . '</p>' . "\n"
        . '          <div class="mat-cta">' . "\n" . '            <small>' . e($t['cta']) . '</small>' . "\n" . '            ' . cat_pair($cx, 'other') . "\n" . '          </div>' . "\n" . '        </div>' . "\n" . '      </article>';
    return $o . "\n    </div>\n";
}
function render_options(array $cx): string {
    $o = '';
    foreach (catalogue_items($cx['data']) as $m) $o .= '<option value="' . e($m['slug']) . '">' . e(($m['name'][$cx['lang']] ?? '') !== '' ? $m['name'][$cx['lang']] : ($m['name']['en'] ?? '')) . '</option>';
    return $o;
}
function render_form(array $s, array $cx): string {
    $tpl = FORM_HTML[$s['form'] . '-' . $cx['lang']] ?? FORM_HTML['buyer-en'];
    $title = lt($s['formTitle'] ?? [], $cx); $hint = lt($s['formHint'] ?? [], $cx);
    $titleHtml = $title === '' ? '' : ($s['form'] === 'buyer' ? '<h2 id="inq-h" style="font-size:1.5rem">' . e($title) . '</h2>' : '<h3>' . e($title) . '</h3>');
    $hintHtml = $hint === '' ? '' : '<p class="hint" style="margin-top:0">' . e($hint) . '</p>';
    return strtr($tpl, ['{{TITLE}}' => $titleHtml, '{{HINT}}' => $hintHtml, '{{OPTIONS}}' => render_options($cx) === '' ? '' : render_options($cx) . "\n", '{{WA}}' => e($cx['site']['whatsapp'])]);
}

/* ───────────────────────── sections ───────────────────────── */

const JUSTIFY = ['left' => 'stretch', 'center' => 'center', 'right' => 'end', 'stretch' => 'stretch'];

function r_section(array $s, array $cx): string {
    if (hidden_here($s, $cx)) return '';
    $st = $s['style']; $kind = $s['kind']; $var = (string)($s['variant'] ?? '');
    $sp = max(0.2, (float)$cx['data']['design']['sectionSpacing'] / 100);
    $css = [];
    if (isset($st['bg'])) $css[] = 'background:' . $st['bg'];
    if (isset($st['bgImage'])) $css[] = 'background-image:url("' . $st['bgImage'] . '");background-size:cover;background-position:center';
    $css[] = pad_css('padding-top', $st['padTop'] * $sp); $css[] = pad_css('padding-bottom', $st['padBottom'] * $sp);
    if ($st['marginTop']) $css[] = 'margin-top:' . num($st['marginTop']) . 'px';
    if ($st['marginBottom']) $css[] = 'margin-bottom:' . num($st['marginBottom']) . 'px';
    if (!empty($st['minHeight'])) $css[] = 'min-height:' . num($st['minHeight']) . 'px';
    $cls = ['rs-sec', 'sec-' . $kind];
    if ($kind === 'hero') $cls[] = 'hero';
    elseif ($kind === 'cta') { $cls[] = 'cta'; $cls[] = 'on-dark'; }
    elseif ($kind === 'band' && str_starts_with($var, 'head-')) { $cls[] = 'head'; $cls[] = $var; }
    elseif ($kind === 'band' && str_starts_with($var, 'ribbon-')) { $cls[] = 'ribbon'; $cls[] = 'r-' . substr($var, 7); }
    elseif (in_array($kind, ['content', 'form', 'catalogue', 'contact'], true)) { $cls[] = 'sec'; if ($var === 'alt') $cls[] = 'sec-alt'; }
    if (($st['tone'] ?? '') === 'light') $cls[] = 'tone-light';
    $cols = $kind === 'catalogue' ? (int)$st['columns'] : ($st['layout'] === 'stack' ? 1 : (int)$st['columns']);
    $wrapW = isset($st['contentWidth']) ? 'max-width:' . num($st['contentWidth']) . 'px' : '';
    $inner = ['--c:' . $cols, '--ct:' . ($cols >= 3 ? 2 : 1), '--cm:1', '--gap:' . num($st['gap']) . 'px', $wrapW,
              $st['align'] === 'stretch' ? '' : 'text-align:' . $st['align'], 'justify-items:' . JUSTIFY[$st['align']],
              $kind === 'hero' || $kind === 'cta' ? 'align-items:center' : 'align-items:start'];
    $open = '<section class="' . implode(' ', $cls) . '"' . style_attr(...$css) . '>';
    $close = '</section>' . "\n";
    switch ($kind) {
        case 'catalogue':
            return $open . '<div class="wrap"' . style_attr($wrapW) . '>' . render_catalogue($cx, $cols) . '</div>' . $close;
        case 'form': {
            $side = r_nodes($s['children'], $cx);
            $form = render_form($s, $cx);
            $sideHtml = $s['form'] === 'buyer' ? '<aside class="info" aria-label="' . e($cx['t']['asideLabel']) . '">' . $side . '</aside>' : '<div>' . $side . '</div>';
            return $open . '<div class="wrap form-grid"' . style_attr($wrapW) . '>' . ($s['form'] === 'buyer' ? $form . $sideHtml : $sideHtml . $form) . '</div>' . $close;
        }
        case 'cta':
            return $open . '<div class="wrap cta-in"' . style_attr($wrapW) . '>' . r_nodes($s['children'], $cx) . '</div>' . $close;
        case 'band':
            if (str_starts_with($var, 'ribbon-')) {
                $cx2 = $cx; $cx2['ribbon'] = true;
                $href = (string)($s['href'] ?? ''); if ($cx['lang'] === 'id' && !empty($s['hrefId'])) $href = (string)$s['hrefId'];
                $in = '<div class="wrap ribbon-in"' . style_attr($wrapW) . '>' . r_nodes($s['children'], $cx2) . '<span class="ribbon-go" aria-hidden="true">→</span></div>';
                if ($href === '') return '<div class="' . implode(' ', $cls) . '"' . style_attr(...$css) . '>' . $in . '</div>' . "\n";
                $r = resolve_href($href, $cx);
                return '<a class="' . implode(' ', $cls) . '"' . link_attrs($r) . style_attr(...$css) . '>' . $in . '</a>' . "\n";
            }
            // fall through: heads and plain bands are ordinary grids
        default:
            return $open . '<div class="wrap rs-grid"' . style_attr(...$inner) . '>' . r_nodes($s['children'], $cx) . '</div>' . $close;
    }
}

/* ───────────────────────── generated "further explanation" page ───────────────────────── */

function mk_nd(string $type, array $f, array $style = []): array { return ['id' => 'g' . substr(md5(json_encode($f) . $type . mt_rand()), 0, 8), 'visible' => true, 'type' => $type, 'style' => $style] + $f; }
function mk_sec(string $kind, array $children, array $st = [], array $extra = []): array {
    return ['id' => 'gs' . substr(md5($kind . mt_rand()), 0, 8), 'kind' => $kind, 'name' => $kind, 'visible' => true, 'children' => $children,
        'style' => $st + ['layout' => 'stack', 'columns' => 1, 'padTop' => 56, 'padBottom' => 56, 'marginTop' => 0, 'marginBottom' => 0, 'gap' => 0, 'align' => 'left']] + $extra;
}
function sprintf_loc(array $tpl, array $name): array { return ['en' => sprintf($tpl['en'], $name['en']), 'id' => sprintf($tpl['id'], $name['id'])]; }
/** A page built on the fly from a catalogue entry that has a further explanation. */
function material_page(array $m, array $data): array {
    $name = ['en' => (string)$m['name']['en'], 'id' => (string)($m['name']['id'] ?: $m['name']['en'])];
    $L = fn(string $k) => ['en' => SITE_TEXT['en'][$k], 'id' => SITE_TEXT['id'][$k]];
    $homeP = site_page($data, 'home'); $catP = site_page($data, 'catalogue');
    $homeN = $homeP ? $homeP['name'] : ['en' => 'Home', 'id' => 'Beranda']; $catN = $catP ? $catP['name'] : ['en' => 'Catalogue', 'id' => 'Katalog'];
    $slug = $m['slug'];
    $info = ['en' => trim((string)($m['info']['en'] ?? '')), 'id' => trim((string)($m['info']['id'] ?? ''))];
    if ($info['id'] === '') $info['id'] = $info['en'];
    if ($info['en'] === '') $info['en'] = $info['id'];
    $paras = [];
    foreach (['en', 'id'] as $l) $paras[$l] = array_values(array_filter(array_map('trim', preg_split('/\R{2,}/u', $info[$l]) ?: []), fn($x) => $x !== ''));
    $n = max(count($paras['en']), count($paras['id']));
    $body = [mk_nd('heading', ['level' => 2, 'text' => sprintf_loc($L('aboutM'), $name)])];
    for ($i = 0; $i < $n; $i++) $body[] = mk_nd('richtext', ['text' => ['en' => $paras['en'][$i] ?? '', 'id' => $paras['id'][$i] ?? '']]);
    $kids = [mk_nd('container', ['children' => $body], ['layout' => 'stack', 'gap' => 0])];
    if (($m['image'] ?? '') !== '') $kids[] = mk_nd('image', ['src' => $m['image'], 'alt' => $name], ['aspect' => '16/9', 'fit' => 'cover']);
    $crumbs = mk_nd('container', ['variant' => 'crumbs', 'children' => [
        mk_nd('link', ['label' => $homeN, 'href' => '@home']), mk_nd('link', ['label' => $catN, 'href' => '@catalogue']), mk_nd('paragraph', ['text' => $name])]], ['layout' => 'row', 'gap' => 6]);
    $pair = mk_nd('container', ['variant' => 'pair', 'children' => [
        mk_nd('button', ['label' => $L('buy'), 'href' => '@buyers?material=' . $slug, 'variant' => 'forest', 'size' => 'md']),
        mk_nd('button', ['label' => $L('sup'), 'href' => '@supplier?material=' . $slug, 'variant' => 'gold', 'size' => 'md'])]], ['layout' => 'grid', 'columns' => 2, 'gap' => 8, 'maxWidth' => 360]);
    $head = [$crumbs, mk_nd('eyebrow', ['text' => ['en' => SITE_TEXT['en']['cat'][$m['cat']], 'id' => SITE_TEXT['id']['cat'][$m['cat']]]]), mk_nd('heading', ['level' => 1, 'text' => $name])];
    if (trim((string)($m['desc']['en'] ?? '')) !== '' || trim((string)($m['desc']['id'] ?? '')) !== '') $head[] = mk_nd('paragraph', ['variant' => 'lead', 'text' => ['en' => (string)($m['desc']['en'] ?? ''), 'id' => (string)(($m['desc']['id'] ?? '') ?: ($m['desc']['en'] ?? ''))]]);
    $head[] = $pair;
    $cta = [mk_nd('container', ['children' => [mk_nd('heading', ['level' => 2, 'text' => sprintf_loc($L('intM'), $name)]), mk_nd('paragraph', ['text' => $L('intP')])]], ['layout' => 'stack', 'gap' => 0]),
            mk_nd('button', ['label' => $L('contactUs'), 'href' => '@contact', 'variant' => 'maize', 'size' => 'lg'])];
    return [
        'id' => 'material', 'name' => $name, 'slug' => ['en' => 'material/' . $slug, 'id' => 'material/' . $slug], 'inBar' => false, 'inMenu' => false,
        'title' => ['en' => $name['en'] . ' | PT Berkat Muri Sejahtera (BMS)', 'id' => $name['id'] . ' | PT Berkat Muri Sejahtera (BMS)'],
        'desc' => ['en' => (string)($m['desc']['en'] ?? ''), 'id' => (string)($m['desc']['id'] ?? '')],
        'paths' => ['en' => '/material/' . $slug, 'id' => '/id/material/' . $slug],
        'sections' => [
            mk_sec('band', $head, ['padTop' => 40, 'padBottom' => 40], ['variant' => 'head-maize']),
            mk_sec('content', $kids, ['layout' => 'columns', 'columns' => count($kids) > 1 ? 2 : 1, 'gap' => 40]),
            mk_sec('cta', $cta, ['layout' => 'columns', 'columns' => 2, 'gap' => 40, 'padTop' => 52, 'padBottom' => 28]),
        ],
    ];
}

/** Resolve a redirect rule's target ("@page", "/path" or a URL) for the language of the address that was requested. */
function redirect_target(string $to, array $data, string $lang, array $site): string {
    return resolve_href($to, site_ctx($data, $lang, $site))[0];
}

/* ───────────────────────── page chrome ───────────────────────── */

function asset_url(string $path): string {
    $f = APP_ROOT . $path;
    return $path . (is_file($f) ? '?v=' . substr(md5((string)filemtime($f)), 0, 8) : '');
}
function nav_items(array $cx, string $flag, string $currentId): string {
    $o = '';
    foreach ($cx['data']['pages'] as $p) {
        if (empty($p[$flag])) continue;
        $name = (string)($p['name'][$cx['lang']] ?? '') !== '' ? (string)$p['name'][$cx['lang']] : (string)($p['name']['en'] ?? $p['id']);
        $o .= '<li><a href="' . e(page_path($cx['data'], $p['id'], $cx['lang'])) . '"' . ($p['id'] === $currentId ? ' aria-current="page"' : '') . '>' . e($name) . '</a></li>' . "\n        ";
    }
    return $o;
}
function design_css(array $d): string {
    $fam = ['serif' => ['var(--serif)', 'var(--serif)'], 'sans' => ['var(--sans)', 'var(--sans)'], 'mono' => ['ui-monospace,Menlo,monospace', 'ui-monospace,Menlo,monospace']][$d['font']] ?? ['var(--sans)', 'var(--serif)'];
    $v = ['--forest:' . $d['primary'], '--gold:' . $d['secondary'], '--paper:' . $d['background'], '--body-font:' . $fam[0], '--head-font:' . $fam[1],
          '--body-size:' . (int)$d['body'] . 'px', '--btn-r:' . (int)$d['buttonRadius'] . 'px', '--content-w:' . (int)$d['contentWidth'] . 'px'];
    if ((int)$d['h1'] > 0) { $v[] = '--h1-size:' . (int)$d['h1'] . 'px'; $v[] = '--h2-size:' . (int)round($d['h1'] * 0.7) . 'px'; }
    return ':root{' . implode(';', $v) . '}';
}

/** The complete HTML document for one page. */
function render_page(array $page, array $cx): string {
    $lang = $cx['lang']; $t = $cx['t']; $data = $cx['data']; $site = $cx['site']; $base = base_url();
    $id = $page['id'];
    $pname = (string)($page['name'][$lang] ?? '') !== '' ? (string)$page['name'][$lang] : (string)($page['name']['en'] ?? '');
    $title = trim((string)($page['title'][$lang] ?? '')) !== '' ? (string)$page['title'][$lang] : $pname . ' | ' . $site['name'] . ' (' . $site['short'] . ')';
    $desc = trim((string)($page['desc'][$lang] ?? ''));
    $enUrl = $base . ($page['paths']['en'] ?? page_path($data, $id, 'en')); $idUrl = $base . ($page['paths']['id'] ?? page_path($data, $id, 'id'));
    $self = $lang === 'en' ? $enUrl : $idUrl;
    $isErr = $id === '404';
    $homeHref = page_path($data, 'home', $lang);
    $contactHref = page_path($data, 'contact', $lang);
    $d = $data['design'];
    $h = '<!doctype html>' . "\n" . '<html lang="' . $lang . '" class="no-js">' . "\n<head>\n"
       . '  <meta charset="utf-8">' . "\n" . '  <meta name="viewport" content="width=device-width, initial-scale=1">' . "\n"
       . '  <title>' . e($title) . '</title>' . "\n"
       . ($desc !== '' ? '  <meta name="description" content="' . e($desc) . '">' . "\n" : '')
       . '  <meta name="theme-color" content="#90C207">' . "\n";
    if ($isErr) $h .= '  <meta name="robots" content="noindex">' . "\n";
    else $h .= '  <link rel="alternate" hreflang="en" href="' . e($enUrl) . '">' . "\n" . '  <link rel="alternate" hreflang="id" href="' . e($idUrl) . '">' . "\n" . '  <link rel="canonical" href="' . e($self) . '">' . "\n"
        . '  <meta property="og:type" content="website">' . "\n" . '  <meta property="og:site_name" content="' . e($site['name']) . '">' . "\n"
        . '  <meta property="og:title" content="' . e($title) . '">' . "\n" . ($desc !== '' ? '  <meta property="og:description" content="' . e($desc) . '">' . "\n" : '')
        . '  <meta property="og:locale" content="' . e($t['locale']) . '">' . "\n";
    $h .= '  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">' . "\n"
        . '  <link rel="preload" href="/assets/fonts/fraunces-600.woff2" as="font" type="font/woff2" crossorigin>' . "\n"
        . '  <link rel="stylesheet" href="' . e(asset_url('/assets/css/main.css')) . '">' . "\n"
        . '  <style>' . design_css($d) . '</style>' . "\n"
        . '  <script>' . INLINE_JS . '</script>' . "\n";
    if ($id === 'home') $h .= '<script type="application/ld+json">' . json_encode(['@context' => 'https://schema.org', '@type' => 'Organization', 'name' => $site['name'], 'alternateName' => $site['short'], 'foundingDate' => '2025',
        'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Jakarta', 'addressCountry' => 'ID'], 'identifier' => 'NIB ' . $site['nib']], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) . '</script>' . "\n";
    $h .= "</head>\n" . '<body data-btn="' . e($d['buttonStyle']) . '">' . "\n";
    $h .= '  <a class="skip" href="#main">' . e($t['skip']) . '</a>' . "\n\n  <header class=\"hdr\">\n    <div class=\"wrap bar\">\n"
        . '      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu">' . "\n"
        . '        <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>' . "\n" . '        <span>' . e($t['menu']) . '</span>' . "\n      </button>\n"
        . '      <a class="brand" href="' . e($homeHref) . '" aria-label="' . e($site['name']) . '">' . "\n"
        . '        <img src="' . e(asset_url('/assets/img/LogoBMS.png')) . '" alt="BMS" width="119" height="84">' . "\n      </a>\n"
        . '      <div class="hdr-r">' . "\n" . '        <div class="lang" role="group" aria-label="' . e($t['language']) . '">' . "\n"
        . '          <a href="' . e($isErr ? '/' : ($page['paths']['en'] ?? page_path($data, $id, 'en'))) . '" hreflang="en" lang="en"' . ($lang === 'en' ? ' aria-current="true"' : '') . '>EN</a>' . "\n"
        . '          <a href="' . e($isErr ? '/id/' : ($page['paths']['id'] ?? page_path($data, $id, 'id'))) . '" hreflang="id" lang="id"' . ($lang === 'id' ? ' aria-current="true"' : '') . '>ID</a>' . "\n        </div>\n"
        . '        <a class="btn btn-gold btn-sm hdr-cta" href="' . e($contactHref) . '">' . e($t['contact']) . '</a>' . "\n      </div>\n    </div>\n"
        . '    <nav class="subnav" aria-label="' . e($t['nav']) . '">' . "\n      <ul class=\"wrap\">\n        " . nav_items($cx, 'inBar', $id) . "</ul>\n    </nav>\n\n"
        . '    <div class="scrim" data-menu-close></div>' . "\n" . '    <div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="' . e($t['menu']) . '">' . "\n"
        . '      <div class="menu-top">' . "\n" . '        <button class="menu-btn menu-close" type="button" data-menu-close>' . "\n" . '          <span class="x" aria-hidden="true"></span>' . "\n"
        . '          <span>' . e($t['close']) . '</span>' . "\n        </button>\n      </div>\n"
        . '      <nav aria-label="' . e($t['nav']) . '">' . "\n        <ul class=\"menu-links\">\n          " . nav_items($cx, 'inMenu', $id) . "</ul>\n      </nav>\n"
        . '      <div class="menu-foot">' . "\n" . '        <a class="btn btn-gold" href="https://wa.me/' . e($site['whatsapp']) . '" target="_blank" rel="noopener">' . e($t['chat']) . '</a>' . "\n      </div>\n    </div>\n  </header>\n\n";
    $h .= '  <main id="main">' . "\n";
    foreach ($page['sections'] as $s) $h .= r_section($s, $cx);
    $h .= "  </main>\n\n" . '  <footer class="ftr">' . "\n" . '    <div class="wrap ftr-grid">' . "\n      <div>\n"
        . '        <strong class="ftr-name">' . e($site['name']) . '</strong>' . "\n" . '        <p>NIB ' . e($site['nib']) . '</p>' . "\n" . '        <p>Jakarta, Indonesia</p>' . "\n      </div>\n"
        . '      <ul class="ftr-contacts">' . "\n" . '<li><a href="mailto:' . e($site['email']) . '">' . e($site['email']) . '</a></li>      </ul>' . "\n"
        . '      <p class="ftr-copy">&copy; ' . date('Y') . ' ' . e($site['name']) . '</p>' . "\n    </div>\n"
        . '    <div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' . "\n  </footer>\n\n"
        . '  <script src="' . e(asset_url('/assets/js/main.js')) . '" defer></script>' . "\n";
    if (str_contains($h, 'data-kind=')) $h .= '  <script src="/assets/js/save.js?v=' . e($cx['saveVer']) . '" defer></script>' . "\n";
    return $h . "</body>\n</html>\n";
}

/** Hash of the one inline script every page contains (adds the "js" class), for the Content-Security-Policy */
const INLINE_JS = "document.documentElement.className='js'";
function inline_js_hash(): string { return "'sha256-" . base64_encode(hash('sha256', INLINE_JS, true)) . "'"; }
