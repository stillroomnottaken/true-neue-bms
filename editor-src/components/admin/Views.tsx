"use client";
import { useEffect, useState } from "react";
import { api, type Inquiry, type Revision } from "@/lib/api";
import { CATS, countSections, resolveHref, walk, textOf, isTextual, type CatalogueItem, type Node, type Page } from "@/lib/model";
import { DESIGN } from "@/lib/seed";
import { useEditor } from "@/lib/store";
import { I } from "../icons";
import { SitePage } from "../Render";
import { ColorField, Field, Group, Num, Sel, Seg } from "./controls";
import { MediaGrid, MediaPicker } from "./MediaPicker";

const ago = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };
const View = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
  <div className="ed-viewwrap"><div className="ed-view"><header className="ed-viewhead"><h1>{title}</h1>{sub && <p>{sub}</p>}</header>{children}</div></div>
);

const when = (t: number) => new Date(t * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export function Overview() {
  const ed = useEditor();
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newInq, setNewInq] = useState<number | null>(null);
  const load = () => api.revisions().then((r) => setRevs(r.items)).catch((e) => setErr(e.message));
  useEffect(() => { void load(); api.inquiries().then((r) => setNewInq(r.items.length)).catch(() => {}); }, [ed.rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const restore = async (r: Revision) => {
    if (!window.confirm(`Restore the version from ${when(r.at)}? It becomes the live site immediately. (The current version is kept in the history.)`)) return;
    try { await api.restore(r.id); const c = await api.content(); ed.setRevision(c.data, c.rev, "Version restored and published"); } catch (e) { ed.toast(e instanceof Error ? e.message : "Restore failed"); }
  };
  const stats: [string, string | number][] = [["Pages", ed.data.pages.length], ["Catalogue entries", ed.data.catalogue.length], ["Editable sections", countSections(ed.data)], ["Inquiries received", newInq ?? "…"], ["Last published", ed.savedAt ? when(ed.savedAt) : "never"]];
  return (
    <View title="Overview" sub="Edit the BMS website. Changes go live when you press Save & publish.">
      <div className="ed-stats">{stats.map(([k, v]) => <div key={k} className="ed-stat"><small>{k}</small><b>{v}</b></div>)}</div>
      <div className="ed-cols">
        <section className="ed-card"><h3>Version history</h3>
          {err && <p className="ed-empty">{err}</p>}
          {!revs && !err && <p className="ed-empty">Loading…</p>}
          {revs && revs.length === 0 && <p className="ed-empty">No earlier versions yet. Every publish keeps the previous version here (the last 30).</p>}
          {revs && revs.length > 0 && <ul className="ed-revlist">{revs.map((r) => <li key={r.id}><span>{when(r.at)}<small style={{ display: "block", color: "var(--ed-muted)" }}>{r.note || "Published"} · {r.by}</small></span><button className="ed-btn sm" onClick={() => void restore(r)}>Restore</button></li>)}</ul>}
        </section>
        <section className="ed-card"><h3>Start here</h3>
          <div className="ed-quick"><button className="ed-btn primary" onClick={() => ed.patchUi({ view: "editor" })}>{I.edit} Open Website Editor</button><button className="ed-btn" onClick={() => ed.patchUi({ view: "catalogue" })}>{I.box} Manage catalogue</button><button className="ed-btn" onClick={() => ed.patchUi({ view: "design" })}>{I.palette} Design settings</button><button className="ed-btn" onClick={() => ed.patchUi({ view: "inquiries" })}>{I.mail} Read inquiries</button></div>
          <p className="ed-hint" style={{ marginTop: 12 }}>Tips: click any text on the canvas to type directly. Drag the ⠿ handle to move a block. Drag the edge handles to resize. Ctrl+Z undoes, Ctrl+S saves and publishes.</p>
        </section>
      </div>
    </View>
  );
}

const setLoc = (cur: { en: string; id: string } | undefined, l: "en" | "id", v: string) => ({ en: cur?.en ?? "", id: cur?.id ?? "", [l]: v });

export function Pages({ onPreview }: { onPreview: () => void }) {
  const ed = useEditor();
  const [selId, setSelId] = useState<string>(ed.data.pages[0]?.id ?? "home");
  const sel = ed.data.pages.find((p) => p.id === selId) ?? ed.data.pages[0];
  const up = (label: string, fn: (p: Page) => void, key?: string) => ed.commit(label, (d) => { const p = d.pages.find((x) => x.id === sel.id); if (p) fn(p); }, key ? `page:${sel.id}:${key}` : undefined);
  const fixedSlug = sel.id === "home";
  return (
    <View title="Pages" sub="Every page of the website, in both languages. Open one to edit it, or change its address, menu entry and search-engine text below.">
      <div className="ed-table">
        <div className="ed-tr head"><span>Page</span><span>English route</span><span>Indonesian route</span><span>Actions</span></div>
        {ed.data.pages.map((p) => (
          <div className={`ed-tr${p.id === sel.id ? " is-sel" : ""}`} key={p.id} onClick={() => setSelId(p.id)}>
            <span><b>{p.name[ed.ui.lang]}</b><small>{p.sections.length} sections{p.inBar ? " · top bar" : ""}{p.inMenu ? " · menu" : ""}</small></span>
            <span>{ed.ui.pageId === p.id && ed.ui.lang === "en" && <i className="ed-dot" />}/{p.slug.en}</span>
            <span>/id/{p.slug.id}</span>
            <span className="ed-acts">
              {(["en", "id"] as const).map((l) => <button key={l} className="ed-btn sm" onClick={() => ed.patchUi({ pageId: p.id, lang: l, view: "editor", selectedId: null })}>Edit {l.toUpperCase()}</button>)}
              <button className="ed-btn sm ghost" onClick={() => { ed.patchUi({ pageId: p.id, selectedId: null }); onPreview(); }}>Preview</button>
              {p.id !== "404" && <a className="ed-btn sm ghost" href={resolveHref(`@${p.id}`, ed.data, ed.ui.lang)} target="_blank" rel="noopener">Live page ↗</a>}
            </span>
          </div>
        ))}
      </div>
      {sel && (
        <section className="ed-card" style={{ marginTop: 14 }}>
          <div className="ed-form" key={sel.id}>
            <h3>Page settings · {sel.name.en}</h3>
            <div className="ed-two">
              <Field label="Name · English" hint="Shown in the menu."><input value={sel.name.en} onChange={(e) => up("Rename page", (p) => { p.name.en = e.target.value; }, "n-en")} /></Field>
              <Field label="Name · Indonesian"><input value={sel.name.id} onChange={(e) => up("Rename page", (p) => { p.name.id = e.target.value; }, "n-id")} /></Field>
              <Field label="Address · English" hint={fixedSlug ? "The home page always lives at /" : "Lowercase letters, numbers and hyphens."}><input disabled={fixedSlug} value={sel.slug.en} onChange={(e) => up("Change address", (p) => { p.slug.en = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }, "s-en")} /></Field>
              <Field label="Address · Indonesian"><input disabled={fixedSlug} value={sel.slug.id} onChange={(e) => up("Change address", (p) => { p.slug.id = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }, "s-id")} /></Field>
              <Field label="Browser title · English" hint="Shown on the browser tab and in Google."><input value={sel.title?.en ?? ""} onChange={(e) => up("Edit page title", (p) => { p.title = setLoc(p.title, "en", e.target.value); }, "t-en")} /></Field>
              <Field label="Browser title · Indonesian"><input value={sel.title?.id ?? ""} onChange={(e) => up("Edit page title", (p) => { p.title = setLoc(p.title, "id", e.target.value); }, "t-id")} /></Field>
              <Field label="Search description · English"><textarea rows={3} value={sel.desc?.en ?? ""} onChange={(e) => up("Edit page description", (p) => { p.desc = setLoc(p.desc, "en", e.target.value); }, "d-en")} /></Field>
              <Field label="Search description · Indonesian"><textarea rows={3} value={sel.desc?.id ?? ""} onChange={(e) => up("Edit page description", (p) => { p.desc = setLoc(p.desc, "id", e.target.value); }, "d-id")} /></Field>
            </div>
            {sel.id !== "404" && (
              <div className="ed-row2">
                <label className="ed-check"><input type="checkbox" checked={!!sel.inBar} onChange={(e) => up("Top bar link", (p) => { p.inBar = e.target.checked; })} /> Show in the top navigation bar</label>
                <label className="ed-check"><input type="checkbox" checked={!!sel.inMenu} onChange={(e) => up("Menu link", (p) => { p.inMenu = e.target.checked; })} /> Show in the slide-in menu</label>
              </div>
            )}
          </div>
        </section>
      )}
    </View>
  );
}

export function CatalogueManager() {
  const ed = useEditor();
  const items = ed.data.catalogue;
  const [selId, setSelId] = useState<string | null>(items[0]?.id ?? null);
  const [pick, setPick] = useState(false);
  const sel = items.find((m) => m.id === selId) ?? null;
  const lang = ed.ui.lang;
  const up = (fn: (c: CatalogueItem) => void, key?: string) => sel && ed.catalogue.update(sel.id, fn, key ? `cat:${sel.id}:${key}` : undefined);
  const catPage = ed.data.pages.find((p) => p.id === "catalogue");
  return (
    <View title="Catalogue" sub="The materials shown on the Catalogue page. Changes appear in the preview below, and on the live site after you save.">
      <div className="ed-catgrid">
        <section className="ed-card ed-list">
          <div className="ed-listhead"><h3>Entries ({items.length})</h3><button className="ed-btn sm primary" onClick={() => setSelId(ed.catalogue.add())}>{I.plus} Add commodity</button></div>
          {items.length === 0 && <p className="ed-empty">The catalogue is empty. Add a commodity.</p>}
          {items.map((m, i) => (
            <div key={m.id} className={`ed-item${m.id === selId ? " is-sel" : ""}${m.visible ? "" : " is-hidden"}`} onClick={() => setSelId(m.id)}>
              <span className="ed-num-badge">{i + 1}</span><span className="ed-llabel"><b>{m.name[lang] || "(untitled)"}</b><small>{CATS[m.cat][lang]}</small></span>
              <span className="ed-lact vis">
                <button title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); ed.catalogue.move(m.id, -1); }}>{I.up}</button>
                <button title="Move down" disabled={i === items.length - 1} onClick={(e) => { e.stopPropagation(); ed.catalogue.move(m.id, 1); }}>{I.down}</button>
                <button title={m.visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); ed.catalogue.update(m.id, (c) => { c.visible = !c.visible; }); }}>{m.visible ? I.eye : I.eyeOff}</button>
                <button title="Delete" className="danger" onClick={(e) => { e.stopPropagation(); ed.catalogue.remove(m.id); if (selId === m.id) setSelId(null); }}>{I.trash}</button>
              </span>
            </div>
          ))}
        </section>
        <section className="ed-card">
          {!sel ? <p className="ed-empty">Select an entry to edit it.</p> : (
            <div className="ed-form" key={sel.id}>
              <h3>Edit entry</h3>
              <div className="ed-two">
                <Field label="Name · English"><input className={lang === "en" ? "active-lang" : ""} value={sel.name.en} onChange={(e) => up((c) => { c.name.en = e.target.value; }, "n-en")} /></Field>
                <Field label="Name · Indonesian"><input className={lang === "id" ? "active-lang" : ""} value={sel.name.id} onChange={(e) => up((c) => { c.name.id = e.target.value; }, "n-id")} /></Field>
                <Field label="Description · English"><textarea rows={3} value={sel.desc.en} onChange={(e) => up((c) => { c.desc.en = e.target.value; }, "d-en")} /></Field>
                <Field label="Description · Indonesian"><textarea rows={3} value={sel.desc.id} onChange={(e) => up((c) => { c.desc.id = e.target.value; }, "d-id")} /></Field>
              </div>
              <div className="ed-two">
                <Sel label="Category" value={sel.cat} options={(Object.keys(CATS) as (keyof typeof CATS)[]).map((c) => [c, CATS[c].en] as [typeof c, string])} onChange={(v) => up((c) => { c.cat = v; })} />
                <Field label="Slug"><input value={sel.slug} onChange={(e) => up((c) => { c.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"); }, "slug")} /></Field>
              </div>
              <div className="ed-field"><span className="ed-lbl">Image</span>
                <div className="ed-row2">{sel.image && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ed-thumb sm" src={sel.image} alt="" />}<button className="ed-btn" onClick={() => setPick(true)}>{I.image} {sel.image ? "Replace" : "Choose"} image</button>{sel.image && <button className="ed-btn ghost" onClick={() => up((c) => { c.image = ""; })}>Remove</button>}</div>
              </div>
              <div className="ed-row2"><label className="ed-check"><input type="checkbox" checked={sel.visible} onChange={(e) => up((c) => { c.visible = e.target.checked; })} /> Visible on the website</label><span className="ed-hint">Display order: {items.indexOf(sel) + 1} of {items.length} (use ↑ ↓ in the list)</span></div>
              {pick && <MediaPicker current={sel.image} onClose={() => setPick(false)} onPick={(src) => up((c) => { c.image = src; })} />}
            </div>
          )}
        </section>
      </div>
      <h3 className="ed-sub">Catalogue preview ({lang === "en" ? "English" : "Indonesian"})</h3>
      {catPage && <div className="ed-prevframe"><SitePage page={{ ...catPage, sections: catPage.sections.filter((s) => s.kind === "catalogue") }} data={ed.data} lang={lang} mode="public" /></div>}
    </View>
  );
}

export function MediaLibrary() {
  return <View title="Media library" sub="Images on the website. Upload new ones here, then choose them from the editor's inspector."><div className="ed-card"><MediaGrid /></div><p className="ed-hint" style={{ marginTop: 10 }}>Uploaded images are stored on your server. An image that is still used on the live website cannot be deleted.</p></View>;
}

export function Languages() {
  const ed = useEditor();
  const rows: Node[] = [];
  ed.page.sections.forEach((s) => walk(s.children, (n) => { if (isTextual(n) || n.type === "button" || n.type === "link" || n.type === "card") rows.push(n); }));
  const field = (n: Node): "text" | "label" | "title" => (n.type === "button" || n.type === "link" ? "label" : n.type === "card" ? "title" : "text");
  return (
    <View title="Languages" sub="Indonesian and English text are stored separately. Editing one never overwrites the other.">
      <div className="ed-card ed-langbar"><span>Editing language</span>
        <div className="ed-seg big" role="group">{(["en", "id"] as const).map((l) => <button key={l} aria-pressed={ed.ui.lang === l} onClick={() => ed.patchUi({ lang: l })}>{l === "en" ? "English" : "Indonesian"}{ed.ui.lang === l && <i className="ed-dot" />}</button>)}</div>
        <span className="ed-hint">Page: <b>{ed.page.name[ed.ui.lang]}</b></span>
      </div>
      <div className="ed-table tr2">
        <div className="ed-tr head"><span>Element</span><span className={ed.ui.lang === "en" ? "act" : ""}>English</span><span className={ed.ui.lang === "id" ? "act" : ""}>Indonesian</span></div>
        {rows.map((n) => { const f = field(n); const loc = (n as unknown as Record<string, { en: string; id: string }>)[f]; return (
          <div className="ed-tr" key={n.id}>
            <span><small>{n.type}</small>{textOf(n, ed.ui.lang).slice(0, 28)}</span>
            {(["en", "id"] as const).map((l) => <textarea key={l} rows={2} className={ed.ui.lang === l ? "active-lang" : ""} value={loc[l]} onChange={(e) => ed.setText(n.id, f, l, e.target.value)} aria-label={`${n.type} ${l}`} />)}
          </div>); })}
        {rows.length === 0 && <p className="ed-empty">This page has no editable text elements.</p>}
      </div>
    </View>
  );
}

export function DesignSettings() {
  const ed = useEditor();
  const d = ed.data.design;
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K], label = "Design settings") => ed.commit(label, (x) => { x.design[k] = v; }, `design:${k}`);
  const home = ed.data.pages[0];
  return (
    <View title="Design settings" sub="Global styles. They apply to the whole website once you save and publish.">
      <div className="ed-catgrid">
        <section className="ed-card ed-form">
          <Group title="Colors">
            <ColorField label="Primary color" value={d.primary} allowClear={false} onChange={(v) => v && set("primary", v)} />
            <ColorField label="Secondary color" value={d.secondary} allowClear={false} onChange={(v) => v && set("secondary", v)} />
            <ColorField label="Background color" value={d.background} allowClear={false} onChange={(v) => v && set("background", v)} />
          </Group>
          <Group title="Typography">
            <Sel label="Default font family" value={d.font} options={[["default", "BMS default (serif headings, system body)"], ["serif", "Serif everywhere"], ["sans", "Sans everywhere"], ["mono", "Monospace"]]} onChange={(v) => set("font", v)} />
            <Num label="Heading size (H1)" value={d.h1 || undefined} min={24} max={72} unit="px" onChange={(v) => set("h1", v ?? 0)} />
            <Num label="Body font size" value={d.body} min={13} max={22} unit="px" onChange={(v) => set("body", v ?? 16)} />
          </Group>
          <Group title="Buttons & layout">
            <Seg label="Button style" value={d.buttonStyle} options={[["solid", "Solid"], ["outline", "Outline"]]} onChange={(v) => set("buttonStyle", v)} />
            <Num label="Button radius" value={d.buttonRadius} min={0} max={40} unit="px" onChange={(v) => set("buttonRadius", v ?? 6)} />
            <Num label="Section spacing" value={d.sectionSpacing} min={40} max={200} step={5} unit="%" onChange={(v) => set("sectionSpacing", v ?? 100)} />
            <Num label="Content width" value={d.contentWidth} min={720} max={1400} step={10} unit="px" onChange={(v) => set("contentWidth", v ?? 1120)} />
          </Group>
          <button className="ed-btn" onClick={() => ed.commit("Reset design to defaults", (x) => { x.design = structuredClone(DESIGN); })}>{I.reset} Reset design to defaults</button>
        </section>
        <section className="ed-card"><h3>Live preview (Home)</h3><div className="ed-prevframe tall"><SitePage page={{ ...home, sections: home.sections.slice(0, 3) }} data={ed.data} lang={ed.ui.lang} mode="public" /></div></section>
      </div>
    </View>
  );
}

export function Inquiries() {
  const ed = useEditor();
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.inquiries().then((r) => setItems(r.items)).catch((e) => setErr(e.message)); }, []);
  const del = async (q: Inquiry) => {
    if (!window.confirm(`Delete the inquiry from ${q.name}?`)) return;
    try { await api.deleteInquiry(q.id); setItems((l) => (l ?? []).filter((x) => x.id !== q.id)); } catch (e) { ed.toast(e instanceof Error ? e.message : "Delete failed"); }
  };
  return (
    <View title="Inquiries" sub="Enquiries sent through the website contact form. They are also sent to WhatsApp, so you never lose a lead.">
      {err && <p className="ed-empty">{err}</p>}
      {!items && !err && <p className="ed-empty">Loading…</p>}
      {items && items.length === 0 && <p className="ed-empty">No inquiries yet.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {items?.map((q) => (
          <article className="ed-inq" key={q.id}>
            <header><span className={`tag ${q.role === "supplier" ? "have" : ""}`}>{q.role === "supplier" ? "Supplier" : "Buyer"}</span><b>{q.name}</b>{q.company && <span>· {q.company}</span>}<span className="ed-hint">{when(q.at)} · {q.lang.toUpperCase()}</span><span className="ed-grow" /><button className="ed-btn sm danger" onClick={() => void del(q)}>{I.trash} Delete</button></header>
            <p><b>{q.material || "—"}</b>{q.quantity ? ` · ${q.quantity} ${q.unit}` : ""}{q.location ? ` · ${q.location}` : ""}</p>
            {q.notes && <p>{q.notes}</p>}
            <p><a href={`https://wa.me/${q.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp {q.phone}</a></p>
          </article>
        ))}
      </div>
    </View>
  );
}

export function Account({ onLogout }: { onLogout: () => void }) {
  const ed = useEditor();
  const [cur, setCur] = useState(""); const [n1, setN1] = useState(""); const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (n1.length < 12) return setMsg({ ok: false, t: "Use at least 12 characters. A few random words works well." });
    if (n1 !== n2) return setMsg({ ok: false, t: "The two new passwords do not match." });
    setBusy(true);
    try { await api.password(cur, n1); setMsg({ ok: true, t: "Password changed. Other sessions were signed out." }); setCur(""); setN1(""); setN2(""); }
    catch (er) { setMsg({ ok: false, t: er instanceof Error ? er.message : "Could not change password" }); }
    setBusy(false);
  };
  return (
    <View title="Account" sub={`Signed in as ${ed.user}. Sessions end after 30 minutes without activity.`}>
      <section className="ed-card"><h3>Change password</h3>
        <form className="ed-form-narrow" onSubmit={submit} autoComplete="off">
          <Field label="Current password"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></Field>
          <Field label="New password (12+ characters)"><input type="password" value={n1} onChange={(e) => setN1(e.target.value)} autoComplete="new-password" minLength={12} required /></Field>
          <Field label="Repeat new password"><input type="password" value={n2} onChange={(e) => setN2(e.target.value)} autoComplete="new-password" required /></Field>
          {msg && <p role="status" style={{ margin: 0, color: msg.ok ? "#2c5a1f" : "#a52f23" }}>{msg.t}</p>}
          <div><button className="ed-btn primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button></div>
        </form>
      </section>
      <p style={{ marginTop: 14 }}><button className="ed-btn" onClick={onLogout}>{I.lock} Log out</button></p>
    </View>
  );
}
