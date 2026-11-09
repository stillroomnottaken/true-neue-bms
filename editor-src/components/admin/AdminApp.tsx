"use client";
import { useEffect, useState } from "react";
import { resolveHref, type Lang } from "@/lib/model";
import { useEditor, type Device, type View } from "@/lib/store";
import { I } from "../icons";
import { SitePage } from "../Render";
import { Modal } from "./controls";
import { DEVICE_W, EditorView } from "./EditorView";
import { Account, CatalogueManager, DesignSettings, Inquiries, Languages, MediaLibrary, Overview, Pages } from "./Views";
import { api } from "@/lib/api";

const NAV_ITEMS: [View, string, keyof typeof I][] = [
  ["overview", "Overview", "home"], ["editor", "Website Editor", "edit"], ["pages", "Pages", "pages"], ["catalogue", "Catalogue", "box"],
  ["media", "Media Library", "image"], ["languages", "Languages", "globe"], ["design", "Design Settings", "palette"],
  ["inquiries", "Inquiries", "mail"], ["account", "Account", "lock"],
];

function Preview({ onClose }: { onClose: () => void }) {
  const ed = useEditor();
  const [menu, setMenu] = useState(false);
  const { ui } = ed;
  const page = ed.page;
  // Simulated navigation: internal links switch the previewed page instead of leaving /admin.
  const intercept = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a"); if (!a) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/")) return;
    e.preventDefault();
    const path = href.split("?")[0];
    for (const p of ed.data.pages) for (const l of ["en", "id"] as Lang[]) if (resolveHref(`@${p.id}`, ed.data, l) === path) { ed.patchUi({ pageId: p.id, lang: l }); setMenu(false); return; }
  };
  return (
    <div className="ed-preview" role="dialog" aria-label="Preview">
      <div className="ed-pv-bar">
        <button className="ed-btn sm primary" onClick={onClose}>{I.back} Back to editor</button>
        <span className="ed-pv-note"><b>Preview</b> · shows your edits, including unsaved ones. Visitors only see what you save and publish.</span>
        <div className="ed-grow" />
        <div className="ed-seg" role="group" aria-label="Preview size">{(["desktop", "tablet", "mobile"] as Device[]).map((d) => <button key={d} aria-pressed={ui.device === d} onClick={() => ed.patchUi({ device: d })} title={d}>{I[d]}</button>)}</div>
        <div className="ed-seg" role="group" aria-label="Language">{(["en", "id"] as const).map((l) => <button key={l} aria-pressed={ui.lang === l} onClick={() => ed.patchUi({ lang: l })}>{l.toUpperCase()}</button>)}</div>
      </div>
      <div className="ed-pv-stage">
        <div className="ed-pv-frame" style={{ width: Math.min(DEVICE_W[ui.device], 1600), maxWidth: "100%" }} onClickCapture={intercept}>
          <SitePage page={page} data={ed.data} lang={ui.lang} mode="public" menu={{ open: menu, toggle: setMenu }} />
        </div>
      </div>
    </div>
  );
}

const fmt = (t: number | null) => (t ? new Date(t * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "never");

export default function AdminApp() {
  const ed = useEditor();
  const { ui } = ed;
  const [confirm, setConfirm] = useState(false);
  const view = ui.view;
  // Ctrl/Cmd+S saves from anywhere in the admin
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (ed.isDirty) void ed.save(); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const logout = async () => {
    if (ed.isDirty && !window.confirm("You have unsaved changes. Log out anyway?")) return;
    try { await api.logout(); } finally { window.location.href = "/admin/"; }
  };
  return (
    <div className="ed-app">
      <nav className="ed-side" aria-label="Admin navigation">
        <div className="ed-brand"><span className="ed-mark">BMS</span><span className="ed-brand-t"><b>Website Admin</b><small>{ed.user}</small></span></div>
        <ul>{NAV_ITEMS.map(([id, label, icon]) => (
          <li key={id}><button className={view === id ? "is-active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => ed.patchUi({ view: id })} title={label}>{I[icon]}<span>{label}</span></button></li>
        ))}</ul>
        <div className="ed-side-foot">
          <div className="ed-langchip" title="Current editing language"><span>Editing</span><b>{ui.lang === "en" ? "English" : "Indonesian"}</b></div>
          <a className="ed-btn sm" href={ui.lang === "en" ? "/" : "/id"} target="_blank" rel="noopener">{I.back}<span>Live website</span></a>
          <button className="ed-btn sm ghost" onClick={() => void logout()}>{I.lock}<span>Log out</span></button>
        </div>
      </nav>
      <div className="ed-main">
        <div className={`ed-banner ${ed.isDirty ? "dirty" : "clean"}`} role="status">
          <span className="ed-state">{ed.saving ? "Saving…" : ed.isDirty ? <><b>Unsaved changes</b> — visitors still see the last published version.</> : <><b>All changes published</b> · last saved {fmt(ed.savedAt)}</>}</span>
          <span className="ed-grow" />
          {ed.isDirty && <button className="ed-btn sm ghost" onClick={() => setConfirm(true)} disabled={ed.saving}>Discard changes</button>}
          <button className="ed-btn sm primary" onClick={() => void ed.save()} disabled={!ed.isDirty || ed.saving} title="Save and publish (Ctrl+S)">{ed.saving ? "Saving…" : "Save & publish"}</button>
        </div>
        {ed.conflict && (
          <div className="ed-conflict" role="alert">
            <span><b>Newer version on the server.</b> Someone else (or another tab) published after you opened the editor.</span>
            <button className="ed-btn sm" onClick={() => void ed.discard()}>Load the newer version (lose my edits)</button>
            <button className="ed-btn sm danger" onClick={() => void ed.save(true)}>Overwrite with my version</button>
          </div>
        )}
        <div className="ed-body">
          {view === "overview" && <Overview />}
          {view === "editor" && <EditorView onReset={() => setConfirm(true)} onPreview={() => ed.patchUi({ preview: true })} />}
          {view === "pages" && <Pages onPreview={() => ed.patchUi({ preview: true })} />}
          {view === "catalogue" && <CatalogueManager />}
          {view === "media" && <MediaLibrary />}
          {view === "languages" && <Languages />}
          {view === "design" && <DesignSettings />}
          {view === "inquiries" && <Inquiries />}
          {view === "account" && <Account onLogout={() => void logout()} />}
        </div>
      </div>
      {ui.preview && <Preview onClose={() => ed.patchUi({ preview: false })} />}
      {confirm && (
        <Modal title="Discard unsaved changes?" onClose={() => setConfirm(false)}>
          <p>Your edits since the last save are thrown away and the editor reloads the published version from the server. Undo history is cleared.</p>
          <div className="ed-modal-actions"><button className="ed-btn" onClick={() => setConfirm(false)}>Keep editing</button><button className="ed-btn danger" onClick={() => { void ed.discard(); setConfirm(false); }}>Discard changes</button></div>
        </Modal>
      )}
      <div className={`ed-toast${ui.toast ? " show" : ""}`} role="status" aria-live="polite">{ui.toast}</div>
    </div>
  );
}
