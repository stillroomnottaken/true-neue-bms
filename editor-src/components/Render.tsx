"use client";
// One rendering system for the editor canvas AND the public site.
// In mode="public" no editor chrome, handlers or attributes are emitted.
import { createContext, createElement, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CATS, hrefFor, isContainer, materialLink, pageForUrl, resolveHref, tok, type CatalogueItem, type Design, type EditorData, type Lang, type Node, type Page, type Section, type Style } from "@/lib/model";
import { SITE } from "@/lib/site";
import { useEditor } from "@/lib/store";
import { NodeChrome, SectionChrome } from "./Chrome";

export type Mode = "edit" | "public";
interface RCtx { mode: Mode; lang: Lang; data: EditorData; drop: Drop; setDrop: (d: Drop) => void }
export type Drop = { id: string; pos: "before" | "after" | "inside"; axis: "x" | "y" } | null;
const RenderCtx = createContext<RCtx>(null as unknown as RCtx);
const useR = () => useContext(RenderCtx);
const RibbonCtx = createContext(false);

const FONT = { serif: "var(--serif)", sans: "var(--sans)", mono: "ui-monospace,Menlo,monospace" } as const;
const textStyle = (s: Style): CSSProperties => ({
  fontFamily: s.font && s.font !== "default" ? FONT[s.font] : undefined, fontSize: s.size, fontWeight: s.weight, color: s.color,
  textAlign: s.align, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing != null ? `${s.letterSpacing}px` : undefined,
});
const selfMap = { left: "start", center: "center", right: "end" } as const;

export function designVars(d: Design): CSSProperties {
  const fam = d.font === "serif" ? ["var(--serif)", "var(--serif)"] : d.font === "sans" ? ["var(--sans)", "var(--sans)"] : d.font === "mono" ? ["ui-monospace,Menlo,monospace", "ui-monospace,Menlo,monospace"] : ["var(--sans)", "var(--serif)"];
  return {
    "--forest": d.primary, "--gold": d.secondary, "--paper": d.background, "--body-font": fam[0], "--head-font": fam[1],
    "--h1-size": d.h1 > 0 ? `${d.h1}px` : undefined, "--h2-size": d.h1 > 0 ? `${Math.round(d.h1 * 0.7)}px` : undefined,
    "--body-size": `${d.body}px`, "--btn-r": `${d.buttonRadius}px`, "--content-w": `${d.contentWidth}px`,
  } as CSSProperties;
}

/* ───────────────────────── editable text ───────────────────────── */
function Editable({ tag, value, onChange, active, multiline, className, style }: { tag: string; value: string; onChange: (v: string) => void; active: boolean; multiline?: boolean; className?: string; style?: CSSProperties }) {
  const { mode, data } = useR();
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el && mode === "edit" && el.textContent !== value) el.textContent = value; });
  if (mode === "public") return createElement(tag, { className, style }, tok(value, data));
  const live = active;
  return createElement(tag, {
    ref, className, style: { ...style, whiteSpace: multiline ? "pre-wrap" : undefined, outline: "none", cursor: live ? "text" : undefined },
    contentEditable: live, suppressContentEditableWarning: true, spellCheck: false, "data-editable": live ? "1" : undefined,
    onInput: (e: React.FormEvent<HTMLElement>) => onChange(e.currentTarget.textContent ?? ""),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Enter") { e.preventDefault(); if (multiline) document.execCommand("insertText", false, "\n"); else e.currentTarget.blur(); }
      if (e.key === "Escape") e.currentTarget.blur();
    },
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(multiline ? /\r/g : /\s*\n\s*/g, multiline ? "" : " ")); },
  });
}

/* ───────────────────────── links ───────────────────────── */
function A({ href, className, style, children, current }: { href: string; className?: string; style?: CSSProperties; children: ReactNode; current?: boolean }) {
  const { mode, data, lang } = useR();
  const url = resolveHref(href, data, lang);
  const ed = useEditor();
  if (mode === "edit") {
    const hit = pageForUrl(data, url);
    return <a className={className} style={style} href={url} aria-current={current ? "page" : undefined} title={hit ? `Ctrl+click to open “${hit.page.name[hit.lang]}”` : url}
      onClick={(e) => { e.preventDefault(); if (hit && (e.ctrlKey || e.metaKey)) ed.patchUi({ pageId: hit.page.id, lang: hit.lang, selectedId: null }); }}>{children}</a>;
  }
  if (url.startsWith("/")) return <a className={className} style={style} href={url} aria-current={current ? "page" : undefined}>{children}</a>;
  const ext = /^https?:/.test(url);
  return <a className={className} style={style} href={url} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>;
}

/* ───────────────────────── editor wrapper (selection + drag & drop) ───────────────────────── */
function axisOf(el: HTMLElement): "x" | "y" {
  const p = el.parentElement; if (!p) return "y";
  const cs = getComputedStyle(p);
  if (cs.display.includes("grid")) return cs.gridTemplateColumns.split(" ").length > 1 ? "x" : "y";
  if (cs.display.includes("flex")) return cs.flexDirection.startsWith("row") ? "x" : "y";
  return "y";
}
function EditWrap({ id, kind, selected, hidden, className, style, children, isBox }: { id: string; kind: "section" | "node"; selected: boolean; hidden: boolean; className: string; style?: CSSProperties; children: ReactNode; isBox?: boolean }) {
  const ed = useEditor();
  const { drop, setDrop } = useR();
  const drag = ed.ui.drag;
  const over = (e: React.DragEvent<HTMLElement>) => {
    if (!drag) return;
    if (drag.kind === "section" && kind !== "section") return;       // sections only reorder among sections
    if (drag.kind === "node" && kind === "section" && (e.target as HTMLElement).closest("[data-nid]")) return;
    if (drag.id === id) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    let next: Drop;
    if (kind === "section" && drag.kind === "node") next = { id, pos: "inside", axis: "y" };
    else if (kind === "node" && isBox && e.clientY > r.top + r.height * 0.3 && e.clientY < r.bottom - r.height * 0.3 && e.clientX > r.left + 12 && e.clientX < r.right - 12) next = { id, pos: "inside", axis: "y" };
    else { const axis = axisOf(e.currentTarget); const after = axis === "x" ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2; next = { id, pos: after ? "after" : "before", axis }; }
    if (!drop || drop.id !== next.id || drop.pos !== next.pos) setDrop(next);
  };
  const dropIt = (e: React.DragEvent<HTMLElement>) => {
    if (!drag || !drop || drop.id !== id) return;
    e.preventDefault(); e.stopPropagation();
    if (drag.kind === "section") ed.moveSectionTo(drag.id, id, drop.pos === "after");
    else if (drop.pos === "inside") ed.moveNodeInto(drag.id, id);
    else ed.moveNodeTo(drag.id, id, drop.pos === "after");
    setDrop(null); ed.patchUi({ drag: null, selectedId: drag.id });
  };
  const cls = [className, "ed-wrap", selected && "ed-selected", hidden && "ed-hidden", drop?.id === id && `ed-drop ed-drop-${drop.pos} ed-axis-${drop.axis}`, drag?.id === id && "ed-dragging"].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} data-sid={kind === "section" ? id : undefined} data-nid={kind === "node" ? id : undefined}
      onClick={(e) => {
        e.stopPropagation();
        const t = e.target as HTMLElement; const x = e.clientX, y = e.clientY;
        if (!t.closest("[data-editable='1']") || !selected) ed.select(id);
        if (t.closest(".ed-bar,.ed-handle")) return;
        // first click selects AND puts the caret in the text, so typing works immediately
        requestAnimationFrame(() => {
          const el = t.closest("[data-editable='1']") as HTMLElement | null;
          if (!el || document.activeElement === el) return;
          el.focus();
          const r = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(x, y);
          if (r && el.contains(r.startContainer)) { const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
        });
      }}
      onDragOver={over} onDrop={dropIt}>
      {children}
      {selected && (kind === "section" ? <SectionChrome id={id} /> : <NodeChrome id={id} />)}
    </div>
  );
}

/* ───────────────────────── nodes ───────────────────────── */
function NodeView({ node, siblingsCount }: { node: Node; siblingsCount?: number }) {
  const { mode, lang, data } = useR();
  const ed = useEditor();
  const inRibbon = useContext(RibbonCtx);
  if (mode === "public" && !node.visible) return null;
  if (node.only && node.only !== lang) return null;
  const sel = mode === "edit" && ed.ui.selectedId === node.id;
  const s = node.style;
  const wrapStyle: CSSProperties = { width: s.width ? `${s.width}%` : undefined, maxWidth: s.maxWidth ? `${s.maxWidth}px` : undefined, justifySelf: s.self ? selfMap[s.self] : undefined, alignSelf: s.self ? undefined : undefined };
  const setText = (field: "text" | "label" | "title" | "alt") => (v: string) => ed.setText(node.id, field, lang, v);
  let body: ReactNode = null;
  let isBox = false;
  switch (node.type) {
    case "heading": body = <Editable tag={`h${node.level}`} value={node.text[lang]} onChange={setText("text")} active={sel} style={textStyle(s)} />; break;
    case "paragraph": body = <Editable tag="p" className={node.variant} value={node.text[lang]} onChange={setText("text")} active={sel} style={textStyle(s)} />; break;
    case "richtext": body = <Editable tag="p" multiline value={node.text[lang]} onChange={setText("text")} active={sel} style={{ ...textStyle(s), whiteSpace: "pre-wrap" }} />; break;
    case "eyebrow": body = <Editable tag={inRibbon ? "span" : "p"} className={inRibbon ? "ribbon-tag" : "eyebrow"} value={node.text[lang]} onChange={setText("text")} active={sel} style={textStyle(s)} />; break;
    case "button": {
      const cls = `btn btn-${node.variant}${node.size === "lg" ? " btn-lg" : node.size === "sm" ? " btn-sm" : ""}`;
      body = <A href={hrefFor(node, lang)} className={cls} style={{ borderRadius: s.radius != null ? s.radius : undefined, ...textStyle({ ...s, align: undefined }) }}><Editable tag="span" value={node.label[lang]} onChange={setText("label")} active={sel} /></A>; break;
    }
    case "link": body = <A href={hrefFor(node, lang)} className="rs-link" style={{ ...textStyle(s), textDecoration: "underline", fontWeight: s.weight ?? 600 }}><Editable tag="span" value={node.label[lang]} onChange={setText("label")} active={sel} /></A>; break;
    case "divider": body = <hr className="rs-divider" style={{ borderTopColor: s.color, borderTopWidth: s.height ? Math.min(s.height, 12) : undefined }} />; break;
    case "spacer": body = <div style={{ height: s.height ?? 32 }} aria-hidden="true" className={mode === "edit" ? "ed-spacer" : undefined} />; break;
    case "image": {
      const style: CSSProperties = { height: s.height ? `${s.height}px` : undefined, aspectRatio: s.height ? undefined : s.aspect && s.aspect !== "auto" ? s.aspect : undefined, objectFit: s.fit ?? "cover", objectPosition: s.position, borderRadius: s.radius };
      body = node.src ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="rs-img" src={node.src} alt={node.alt[lang]} style={style} draggable={false} />
        : <div className="rs-img rs-img-ph" role="img" aria-label={node.alt[lang]} style={{ ...style, aspectRatio: style.aspectRatio ?? "16/9" }}>{mode === "edit" ? "Select, then choose an image →" : ""}</div>;
      break;
    }
    case "card":
      if (node.variant === "step") body = <div className="rs-step"><Editable tag="b" value={node.title[lang]} onChange={setText("title")} active={sel} /><Editable tag="span" value={node.text[lang]} onChange={setText("text")} active={sel} /></div>;
      else body = (
        <article className="ind">
          {node.src ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="ind-img" src={node.src} alt={node.title[lang]} draggable={false} /> : <div className="ind-img ind-ph" role="img" aria-label={node.title[lang]} />}
          <Editable tag="h3" value={node.title[lang]} onChange={setText("title")} active={sel} />
        </article>
      );
      break;
    case "facts":
      body = (
        <dl className="facts">
          {node.rows.map((r) => (
            <div key={r.id}>
              <Editable tag="dt" value={r.label[lang]} active={sel} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "facts") n.rows.find((x) => x.id === r.id)!.label[lang] = v; }, "Edit text", `row:${r.id}:l:${lang}`)} />
              <Editable tag="dd" className={r.soon ? "soon" : undefined} value={r.value[lang]} active={sel} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "facts") n.rows.find((x) => x.id === r.id)!.value[lang] = v; }, "Edit text", `row:${r.id}:v:${lang}`)} />
            </div>
          ))}
        </dl>
      );
      break;
    case "graphic": body = node.kind === "net" ? <NetGraphic lang={lang} /> : <FlowGraphic lang={lang} />; break;
    case "container": {
      isBox = true;
      const cols = s.layout === "grid" ? s.columns ?? 2 : 1;
      const kids = node.children;
      const v = node.variant;
      const vcls = v === "steps" ? "rs-steps steps" : `${s.layout === "row" ? "rs-flex" : "rs-grid"}${v ? ({ card: " card", channels: " channels", channel: " channel", pair: " pair rs-v-pair", chips: " rs-chips", crumbs: " rs-crumbs" } as Record<string, string>)[v] ?? "" : ""}`;
      body = (
        <div className={vcls} style={{ "--gap": `${s.gap ?? 12}px`, "--c": cols, "--ct": cols >= 3 ? 2 : 1, "--cm": 1, ...(v === "steps" ? { "--n": Math.max(1, kids.filter((k) => !k.only || k.only === lang).length) } : {}) } as CSSProperties}>
          {kids.map((k) => <NodeView key={k.id} node={k} />)}
          {mode === "edit" && kids.length === 0 && <div className="rs-empty">Empty container. Add a component from the left panel or drag one in.</div>}
        </div>
      );
      break;
    }
  }
  const cls = `rs-node rs-${node.type}`;
  if (mode === "public") return <div className={cls} style={wrapStyle}>{body}</div>;
  return <EditWrap id={node.id} kind="node" selected={sel} hidden={!node.visible} className={cls} style={wrapStyle} isBox={isBox}>{body}</EditWrap>;
}

function NetGraphic({ lang }: { lang: Lang }) {
  const t = lang === "en" ? ["Suppliers", "Buyers"] : ["Pemasok", "Pembeli"];
  return (
    <svg className="net rs-net" viewBox="0 0 520 400" role="img" aria-label={lang === "en" ? "Suppliers to BMS to buyers" : "Pemasok ke BMS ke pembeli"}>
      <g>{[60, 140, 220, 300].map((y) => <g key={y}><path className="ln" d={`M52 ${y} C150 ${y} 150 180 206 180`} /><path className="ln" d={`M314 180 C370 180 370 ${y} 468 ${y}`} /></g>)}</g>
      {[60, 140, 220, 300].map((y) => <g key={y}><circle className="src" cx="40" cy={y} r="11" /><circle className="dst" cx="480" cy={y} r="11" /></g>)}
      <circle className="halo" cx="260" cy="180" r="64" /><circle className="core" cx="260" cy="180" r="50" />
      <text className="core-t" x="260" y="188" textAnchor="middle">BMS</text>
      <rect className="pill" x="-10" y="344" width="100" height="34" rx="17" /><text className="lbl" x="40" y="366" textAnchor="middle">{t[0]}</text>
      <rect className="pill" x="430" y="344" width="100" height="34" rx="17" /><text className="lbl" x="480" y="366" textAnchor="middle">{t[1]}</text>
    </svg>
  );
}
function FlowGraphic({ lang }: { lang: Lang }) {
  const steps = [
    { t: lang === "en" ? "Supplier" : "Pemasok", d: <><path d="M32 58V30" /><path d="M32 40c-9 0-15-6-15-15 9 0 15 6 15 15z" /><path d="M32 32c0-9 6-15 15-15 0 9-6 15-15 15z" /><path d="M20 58h24" /></> },
    { t: "BMS", core: true, d: <><path d="M32 6 56 19v26L32 58 8 45V19z" /><path d="M8 19l24 13 24-13" /><path d="M32 32v26" /></> },
    { t: lang === "en" ? "Business opportunity" : "Peluang bisnis", d: <><path d="M6 46 22 30l10 10 24-24" /><path d="M42 16h14v14" /></> },
  ];
  return (
    <div className="rs-flow-wrap" style={{ gridColumn: "1/-1" }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <div className="bf-arrow" aria-hidden="true">→</div>}
          <div className={`bf-step${s.core ? " bf-core" : ""}`}><svg className="bf-ico" viewBox="0 0 64 64" aria-hidden="true">{s.d}</svg><p className="bf-t">{s.t}</p></div>
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────── catalogue + contact sections ───────────────────────── */
function CatalogueGrid({ items, lang, cols }: { items: CatalogueItem[]; lang: Lang; cols: number }) {
  const { data } = useR();
  const [f, setF] = useState<string>("all");
  const shown = items.filter((m) => m.visible && (f === "all" || m.cat === f));
  const T = (en: string, id: string) => (lang === "en" ? en : id);
  const filters: [string, string][] = [["all", T("All", "Semua")], ...(Object.keys(CATS) as (keyof typeof CATS)[]).map((c) => [c, CATS[c][lang]] as [string, string])];
  return (
    <>
      <div className="filters" role="group" aria-label={T("Filter by category", "Filter berdasarkan kategori")}>
        {filters.map(([k, label]) => <button key={k} className="filter" type="button" aria-pressed={f === k} onClick={(e) => { e.stopPropagation(); setF(k); }}>{label}</button>)}
      </div>
      <div className="mat-grid" style={{ "--c": cols } as CSSProperties}>
        {shown.map((m) => (
          <article className="mat" key={m.id}>
            <div className="mat-body mat-head"><h3>{materialLink(data, m, lang) ? <A href={materialLink(data, m, lang)!} style={m.underline ? { borderBottomColor: m.underline } : undefined}>{m.name[lang] || m.name.en}</A> : m.name[lang] || m.name.en}</h3></div>
            {m.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="mat-img" src={m.image} alt={m.name[lang]} draggable={false} /> : <div className="mat-img mat-ph" role="img" aria-label={m.name[lang]} />}
            {m.desc[lang] && <p className="mat-desc" style={{ padding: "10px 16px 0" }}>{m.desc[lang]}</p>}
            <div className="mat-body"><div className="mat-cta"><small>{T("Contact us about this", "Hubungi kami tentang ini")}</small><Pair slug={m.slug} /></div></div>
          </article>
        ))}
        <article className="mat mat-more"><div className="mat-body"><h3>{T("Not listed?", "Tidak ada di daftar?")}</h3><p>{T("Other relevant industrial materials are welcome. Tell us what you need or can supply.", "Material industri lain yang relevan juga kami terima. Beri tahu kami apa yang Anda butuhkan atau bisa pasok.")}</p><div className="mat-cta"><small>{T("Contact us about this", "Hubungi kami tentang ini")}</small><Pair slug="other" /></div></div></article>
        {shown.length === 0 && <div className="rs-empty">{data.catalogue.length ? T("No visible entries in this category.", "Tidak ada entri terlihat di kategori ini.") : T("The catalogue is empty. Add entries in the Catalogue panel.", "Katalog kosong.")}</div>}
      </div>
    </>
  );
}
function Pair({ slug }: { slug: string }) {
  const { lang } = useR();
  const T = (en: string, id: string) => (lang === "en" ? en : id);
  return <div className="pair"><A href={`@buyers?material=${slug}`} className="btn btn-forest btn-need">{T("BUY", "BELI")}</A><A href={`@supplier?material=${slug}`} className="btn btn-gold">{T("SUPPLY", "PASOK")}</A></div>;
}
function FormPreview({ s, lang }: { s: Section; lang: Lang }) {
  const T = (en: string, id: string) => (lang === "en" ? en : id);
  const buyer = s.form !== "supplier";
  const fields = buyer ? [T("Material", "Material"), T("Quantity needed", "Jumlah dibutuhkan"), T("Delivery location", "Lokasi pengiriman"), T("Your name", "Nama Anda"), T("WhatsApp number / Email", "Nomor WhatsApp / Email")]
    : [T("Your name or organisation", "Nama atau organisasi"), T("WhatsApp / phone number", "Nomor WhatsApp / telepon"), T("Material offered", "Material ditawarkan"), T("Location", "Lokasi")];
  return (
    <div className="form" aria-hidden="true">
      {s.formTitle?.[lang] && (buyer ? <h2 style={{ fontSize: "1.5rem" }}>{s.formTitle[lang]}</h2> : <h3>{s.formTitle[lang]}</h3>)}
      {s.formHint?.[lang] && <p className="hint" style={{ marginTop: 0 }}>{s.formHint[lang]}</p>}
      {fields.map((f) => <div className="field" key={f}><span className="l">{f}</span><input type="text" disabled /></div>)}
      <span className="btn btn-forest">{T("Continue on WhatsApp", "Lanjutkan di WhatsApp")}</span>
      <p className="hint">{T("The live form is generated by the site: its fields cannot be edited here.", "Formulir asli dibuat oleh situs: kolomnya tidak dapat diubah di sini.")}</p>
    </div>
  );
}

/* ───────────────────────── sections ───────────────────────── */
const jmap = { left: "stretch", center: "center", right: "end", stretch: "stretch" } as const;
function SectionView({ s }: { s: Section }) {
  const { mode, lang, data } = useR();
  const ed = useEditor();
  if (mode === "public" && !s.visible) return null;
  if (s.only && s.only !== lang) return null;
  const st = s.style; const sp = data.design.sectionSpacing / 100;
  const sel = mode === "edit" && ed.ui.selectedId === s.id;
  const v = s.variant ?? "";
  const cols = s.kind === "catalogue" ? st.columns : st.layout === "stack" ? 1 : st.columns;
  const style: CSSProperties = {
    background: st.bg, backgroundImage: st.bgImage ? `url("${st.bgImage}")` : undefined, backgroundSize: "cover", backgroundPosition: "center",
    paddingTop: st.padTop * sp, paddingBottom: st.padBottom * sp, marginTop: st.marginTop, marginBottom: st.marginBottom, minHeight: st.minHeight,
  };
  const inner: CSSProperties = { "--c": cols, "--ct": cols >= 3 ? 2 : 1, "--cm": 1, "--gap": `${st.gap}px`, maxWidth: st.contentWidth ? `${st.contentWidth}px` : undefined, textAlign: st.align === "stretch" ? undefined : st.align, justifyItems: jmap[st.align], alignItems: s.kind === "hero" || s.kind === "cta" ? "center" : "start" } as CSSProperties;
  const kids = (cls: string, extra?: ReactNode) => (
    <>
      <div className={cls} style={cls.includes("rs-grid") ? inner : { maxWidth: st.contentWidth ? `${st.contentWidth}px` : undefined }}>
        {s.children.map((n) => <NodeView key={n.id} node={n} />)}
        {extra}
        {mode === "edit" && s.children.length === 0 && <div className="rs-empty">This section is empty. Use “Add” on the left to insert a heading, text, image or button.</div>}
      </div>
    </>
  );
  let content: ReactNode;
  const ribbon = s.kind === "band" && v.startsWith("ribbon-");
  if (s.kind === "catalogue") content = <div className="wrap" style={{ maxWidth: st.contentWidth }}><CatalogueGrid items={data.catalogue} lang={lang} cols={st.columns} /></div>;
  else if (s.kind === "form") {
    const side = <>{s.children.map((n) => <NodeView key={n.id} node={n} />)}{mode === "edit" && s.children.length === 0 && <div className="rs-empty">Add a heading or text for the side panel.</div>}</>;
    content = <div className="wrap form-grid" style={{ maxWidth: st.contentWidth }}>{s.form === "supplier" ? <><div>{side}</div><FormPreview s={s} lang={lang} /></> : <><FormPreview s={s} lang={lang} /><aside className="info">{side}</aside></>}</div>;
  } else if (s.kind === "cta") content = kids("wrap cta-in");
  else if (ribbon) content = <RibbonCtx.Provider value={true}>{kids("wrap ribbon-in", <span className="ribbon-go" aria-hidden="true">→</span>)}</RibbonCtx.Provider>;
  else content = kids("wrap rs-grid");
  const cls = ["rs-sec", `sec-${s.kind}`,
    s.kind === "hero" ? "hero" : s.kind === "cta" ? "cta on-dark" : s.kind === "band" && v.startsWith("head-") ? `head ${v}` : ribbon ? `ribbon r-${v.slice(7)}` : ["content", "form", "catalogue", "contact"].includes(s.kind) ? `sec${v === "alt" ? " sec-alt" : ""}` : "",
    st.tone === "light" ? "tone-light" : ""].filter(Boolean).join(" ");
  if (mode === "public") return ribbon ? <a className={cls} style={style} href={resolveHref(hrefFor(s, lang), data, lang)}>{content}</a> : <section className={cls} style={style}>{content}</section>;
  return <EditWrap id={s.id} kind="section" selected={sel} hidden={!s.visible} className={cls} style={style}>{content}</EditWrap>;
}

/* ───────────────────────── site chrome ───────────────────────── */
const pname = (p: Page, lang: Lang) => p.name[lang] || p.name.en;
export function SiteHeader({ page, onMenu }: { page: Page; onMenu?: () => void }) {
  const { lang, mode, data } = useR();
  return (
    <header className="hdr" style={{ position: mode === "edit" ? "relative" : undefined }}>
      <div className="wrap bar">
        <button className="menu-btn" type="button" onClick={onMenu} aria-label="Menu"><span className="bars" aria-hidden="true"><i /><i /><i /></span><span>Menu</span></button>
        <A href="@home" className="brand">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/assets/img/LogoBMS.png" alt="BMS" width={119} height={84} /></A>
        <div className="hdr-r">
          <div className="lang" role="group"><LangLink l="en" cur={lang} page={page} /><LangLink l="id" cur={lang} page={page} /></div>
          <A href="@contact" className="btn btn-gold btn-sm hdr-cta">{lang === "en" ? "Contact" : "Kontak"}</A>
        </div>
      </div>
      <nav className="subnav"><ul className="wrap">{data.pages.filter((p) => p.inBar).map((p) => <li key={p.id}><A href={`@${p.id}`} className="" style={undefined} current={p.id === page.id}>{pname(p, lang)}</A></li>)}</ul></nav>
    </header>
  );
}
function LangLink({ l, cur, page }: { l: Lang; cur: Lang; page: Page }) {
  const { mode } = useR();
  const slug = page.slug[l];
  const href = l === "en" ? (slug ? `/${slug}` : "/") : (slug ? `/id/${slug}` : "/id/");
  if (mode === "edit") return <a href={href} onClick={(e) => e.preventDefault()} aria-current={l === cur ? "true" : undefined}>{l.toUpperCase()}</a>;
  return <a href={href} aria-current={l === cur ? "true" : undefined}>{l.toUpperCase()}</a>;
}
export function SiteMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, data } = useR();
  return (
    <div className={open ? "menu-open" : ""}>
      <div className="scrim" onClick={onClose} />
      <div className="menu" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="menu-top"><button className="menu-btn menu-close" type="button" onClick={onClose}><span className="x" aria-hidden="true" /><span>{lang === "en" ? "Close" : "Tutup"}</span></button></div>
        <nav><ul className="menu-links" onClick={onClose}>{data.pages.filter((p) => p.inMenu).map((p) => <li key={p.id}><A href={`@${p.id}`} className="" style={undefined}>{pname(p, lang)}</A></li>)}</ul></nav>
        <div className="menu-foot"><a className="btn btn-gold" href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noopener noreferrer">{lang === "en" ? "Chat on WhatsApp" : "Chat via WhatsApp"}</a></div>
      </div>
    </div>
  );
}
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="ftr">
      <div className="wrap ftr-grid">
        <div><strong className="ftr-name">{SITE.name}</strong><p>NIB {SITE.nib}</p><p>Jakarta, Indonesia</p></div>
        <ul className="ftr-contacts"><li><a href={`mailto:${SITE.email}`}>{SITE.email}</a></li></ul>
        <p className="ftr-copy">© {year} {SITE.name}</p>
      </div>
      <div className="stripe" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </footer>
  );
}

/* ───────────────────────── page ───────────────────────── */
export function SitePage({ page, data, lang, mode, drop = null, setDrop = () => {}, menu }: { page: Page; data: EditorData; lang: Lang; mode: Mode; drop?: Drop; setDrop?: (d: Drop) => void; menu?: { open: boolean; toggle: (v: boolean) => void } }) {
  const ed = useEditor();
  const ctx: RCtx = { mode, lang, data, drop, setDrop };
  return (
    <RenderCtx.Provider value={ctx}>
      <div className="site-root" data-btn={data.design.buttonStyle} style={designVars(data.design)} lang={lang}
        onClick={mode === "edit" ? () => ed.select(null) : undefined}>
        <SiteHeader page={page} onMenu={menu ? () => menu.toggle(true) : undefined} />
        <main id="main">
          {page.sections.map((s) => <SectionView key={s.id} s={s} />)}
          {mode === "edit" && page.sections.length === 0 && <div className="rs-empty" style={{ margin: 40 }}>This page has no sections yet. Add one from the “Add” tab.</div>}
        </main>
        <SiteFooter />
      </div>
      {menu && <div style={designVars(data.design)}><SiteMenu open={menu.open} onClose={() => menu.toggle(false)} /></div>}
    </RenderCtx.Provider>
  );
}
export { isContainer };
