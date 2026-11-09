"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, type Device } from "@/lib/store";
import { I } from "../icons";
import { SitePage, type Drop } from "../Render";
import { AddPanel } from "./AddPanel";
import { Inspector } from "./Inspector";
import { Layers } from "./Layers";

export const DEVICE_W: Record<Device, number> = { desktop: 1200, tablet: 820, mobile: 390 };

export function Toolbar({ onReset, onPreview }: { onReset: () => void; onPreview: () => void }) {
  const ed = useEditor();
  const { ui } = ed;
  return (
    <div className="ed-toolbar" role="toolbar" aria-label="Editor toolbar">
      <div className="ed-tgroup">
        <button className="ed-ibtn" title="Undo (Ctrl+Z)" disabled={!ed.canUndo} onClick={ed.undo}>{I.undo}</button>
        <button className="ed-ibtn" title="Redo (Ctrl+Y)" disabled={!ed.canRedo} onClick={ed.redo}>{I.redo}</button>
      </div>
      <div className="ed-tgroup"><span className="ed-pagename" title="Current page">{ed.page.name[ui.lang]}</span></div>
      <div className="ed-tgroup ed-seg" role="group" aria-label="Preview size">
        {(["desktop", "tablet", "mobile"] as Device[]).map((d) => <button key={d} aria-pressed={ui.device === d} title={`${d} (${DEVICE_W[d]}px)`} onClick={() => ed.patchUi({ device: d })}>{I[d]}</button>)}
      </div>
      <div className="ed-tgroup">
        <button className="ed-ibtn" title="Zoom out" onClick={() => ed.patchUi({ zoom: Math.max(40, ui.zoom - 10) })}>−</button>
        <span className="ed-zoom">{ui.zoom}%</span>
        <button className="ed-ibtn" title="Zoom in" onClick={() => ed.patchUi({ zoom: Math.min(150, ui.zoom + 10) })}>+</button>
        <button className="ed-btn sm ghost" onClick={() => window.dispatchEvent(new Event("ed-fit"))} title="Fit canvas to window">Fit</button>
      </div>
      <div className="ed-grow" />
      <div className="ed-tgroup ed-seg" role="group" aria-label="Editing language">
        {(["en", "id"] as const).map((l) => <button key={l} aria-pressed={ui.lang === l} onClick={() => ed.patchUi({ lang: l })} title={l === "en" ? "Edit English" : "Edit Indonesian"}>{l.toUpperCase()}</button>)}
      </div>
      <div className="ed-tgroup">
        <button className="ed-btn sm" onClick={onPreview}>{I.play} Preview</button>
        {ed.isDirty && <button className="ed-btn sm ghost" onClick={onReset}>{I.reset} Discard</button>}
        <button className="ed-btn sm primary" disabled={!ed.isDirty || ed.saving} onClick={() => void ed.save()} title="Save and publish (Ctrl+S)">{ed.saving ? "Saving…" : ed.isDirty ? "Save & publish" : "Published"}</button>
      </div>
    </div>
  );
}

export function EditorView({ onReset, onPreview }: { onReset: () => void; onPreview: () => void }) {
  const ed = useEditor();
  const { ui } = ed;
  const [drop, setDrop] = useState<Drop>(null);
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => { if (window.innerWidth < 1180) { setLeft(false); setRight(false); } }, []);
  // fit canvas
  useEffect(() => {
    const fit = () => { const w = canvas.current?.clientWidth ?? 900; ed.patchUi({ zoom: Math.max(40, Math.min(100, Math.floor(((w - 56) / DEVICE_W[ui.device]) * 100 / 5) * 5)) }); };
    fit(); window.addEventListener("ed-fit", fit);
    return () => window.removeEventListener("ed-fit", fit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.device, left, right]);
  // keep selection in view
  useEffect(() => {
    if (!ui.selectedId) return;
    const el = canvas.current?.querySelector(`[data-sid="${ui.selectedId}"],[data-nid="${ui.selectedId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.selectedId]);
  useEffect(() => { if (!ui.drag) setDrop(null); }, [ui.drag]);

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = t.closest("input,textarea,select") || t.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); (document.activeElement as HTMLElement)?.blur?.(); ed.undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); (document.activeElement as HTMLElement)?.blur?.(); ed.redo(); return; }
      if (typing) return;
      const id = ui.selectedId;
      if (e.key === "Escape") ed.select(null);
      if (!id) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); ed.removeItem(id); ed.select(null); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); ed.duplicateItem(id); }
      else if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); ed.nudge(id, -1); }
      else if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); ed.nudge(id, 1); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="ed-editor">
      <Toolbar onReset={onReset} onPreview={onPreview} />
      <div className="ed-workspace">
        <aside className={`ed-left ${left ? "open" : ""}`} aria-label="Pages, layers and components">
          <div className="ed-panel-in">
            <div className="ed-pad">
              <label className="ed-lbl" htmlFor="pgsel">Page</label>
              <select id="pgsel" value={ed.page.id} onChange={(e) => ed.patchUi({ pageId: e.target.value, selectedId: null })}>{ed.data.pages.map((p) => <option key={p.id} value={p.id}>{p.name[ui.lang]} · /{p.slug[ui.lang]}</option>)}</select>
            </div>
            <div className="ed-tabs" role="tablist">
              <button role="tab" aria-selected={ui.leftTab === "layers"} onClick={() => ed.patchUi({ leftTab: "layers" })}>{I.layers} Layers</button>
              <button role="tab" aria-selected={ui.leftTab === "add"} onClick={() => ed.patchUi({ leftTab: "add" })}>{I.plus} Add</button>
            </div>
            <div className="ed-scroll">{ui.leftTab === "layers" ? <Layers /> : <AddPanel />}</div>
          </div>
        </aside>
        <button className="ed-edge ed-edge-l" onClick={() => setLeft(!left)} aria-label={left ? "Hide left panel" : "Show left panel"} title={left ? "Hide panel" : "Show panel"}>{left ? I.back : I.chev}</button>

        <div className="ed-canvas" ref={canvas} onClick={() => ed.select(null)}>
          <div className="ed-frame-wrap" style={{ width: DEVICE_W[ui.device] * ui.zoom / 100 }}>
            <div className={`ed-frame dev-${ui.device}`} style={{ width: DEVICE_W[ui.device], zoom: ui.zoom / 100, ['--zz' as string]: ui.zoom / 100 }}>
              <div className="ed-page-anim" key={ed.page.id}><SitePage page={ed.page} data={ed.data} lang={ui.lang} mode="edit" drop={drop} setDrop={setDrop} /></div>
            </div>
          </div>
        </div>

        <button className="ed-edge ed-edge-r" onClick={() => setRight(!right)} aria-label={right ? "Hide properties" : "Show properties"} title={right ? "Hide panel" : "Show panel"}>{right ? I.chev : I.back}</button>
        <aside className={`ed-right ${right ? "open" : ""}`} aria-label="Properties inspector">
          <div className="ed-panel-in"><div className="ed-scroll"><Inspector /></div></div>
        </aside>
      </div>
    </div>
  );
}
