"use client";
// Editor-only overlays: selection toolbar, drag handle, resize handles. Never rendered in public mode.
import { useState } from "react";
import { nodeLabel, type Node } from "@/lib/model";
import { useEditor } from "@/lib/store";
import { I } from "./icons";

const SNAPS = [25, 33.3, 50, 66.7, 75, 100];

function Bar({ id, kind, label }: { id: string; kind: "section" | "node"; label: string }) {
  const ed = useEditor();
  const vis = (kind === "node" ? ed.selected?.node?.visible : ed.selected?.section.visible) ?? true;
  return (
    <div className={`ed-bar ed-bar-${kind}`} contentEditable={false} onClick={(e) => e.stopPropagation()}>
      <span className="ed-bar-grip" draggable title="Drag to move"
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; const w = (e.currentTarget.closest("[data-sid],[data-nid]") as HTMLElement); if (w) e.dataTransfer.setDragImage(w, 12, 12); ed.patchUi({ drag: { id, kind } }); }}
        onDragEnd={() => ed.patchUi({ drag: null })}>{I.grip}</span>
      <span className="ed-bar-label">{label}</span>
      <button title="Move up (Alt+↑)" onClick={() => ed.nudge(id, -1)}>{I.up}</button>
      <button title="Move down (Alt+↓)" onClick={() => ed.nudge(id, 1)}>{I.down}</button>
      <button title="Duplicate (Ctrl+D)" onClick={() => ed.duplicateItem(id)}>{I.copy}</button>
      <button title={vis ? "Hide" : "Show"} onClick={() => ed.toggleVisible(id)}>{vis ? I.eye : I.eyeOff}</button>
      <button title="Delete (Del)" className="danger" onClick={() => { ed.removeItem(id); ed.select(null); }}>{I.trash}</button>
    </div>
  );
}

function Handle({ axis, onDelta, fmt }: { axis: "x" | "y" | "xy"; onDelta: (dx: number, dy: number, start: { w: number; h: number; pw: number }, el: HTMLElement) => string | void; fmt?: boolean }) {
  const [tip, setTip] = useState<string | null>(null);
  const [st, setSt] = useState<{ x: number; y: number; w: number; h: number; pw: number; el: HTMLElement } | null>(null);
  return (
    <span className={`ed-handle ed-handle-${axis}`} contentEditable={false}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation(); e.preventDefault();
        const el = e.currentTarget.closest("[data-sid],[data-nid]") as HTMLElement;
        const r = el.getBoundingClientRect(); const pr = el.parentElement!.getBoundingClientRect();
        e.currentTarget.setPointerCapture(e.pointerId);
        setSt({ x: e.clientX, y: e.clientY, w: r.width, h: r.height, pw: pr.width, el });
      }}
      onPointerMove={(e) => { if (st) { const t = onDelta(e.clientX - st.x, e.clientY - st.y, { w: st.w, h: st.h, pw: st.pw }, st.el); setTip(typeof t === "string" ? t : null); } }}
      onPointerUp={() => { setSt(null); setTip(null); }} onPointerCancel={() => { setSt(null); setTip(null); }}>
      {tip && fmt !== false && <em className="ed-tip">{tip}</em>}
    </span>
  );
}

export function NodeChrome({ id }: { id: string }) {
  const ed = useEditor();
  const node = ed.selected?.node as Node | undefined;
  if (!node || node.id !== id) return null;
  const zoom = ed.ui.zoom / 100;
  const t = node.type;
  const wide = t !== "spacer" && t !== "divider";
  const tall = t === "image" || t === "spacer";
  const setW = (dx: number, s: { w: number; pw: number }) => {
    let pct = Math.max(10, Math.min(100, ((s.w + dx) / s.pw) * 100));
    const snap = SNAPS.find((x) => Math.abs(x - pct) < 2.2); if (snap) pct = snap;
    pct = Math.round(pct * 10) / 10;
    ed.updateNode(id, (n) => { n.style.width = pct; }, "Resize", `resize:${id}`);
    return `${pct}%${snap ? " · snapped" : ""}`;
  };
  const setH = (dy: number, s: { h: number }) => {
    const h = Math.round(Math.max(t === "spacer" ? 8 : 60, Math.min(900, (s.h + dy) / zoom)));
    ed.updateNode(id, (n) => { n.style.height = h; }, "Resize", `resize:${id}`);
    return `${h}px`;
  };
  return (
    <>
      <Bar id={id} kind="node" label={nodeLabel(node, ed.ui.lang)} />
      {wide && <Handle axis="x" onDelta={(dx, _dy, s) => setW(dx, s)} />}
      {tall && <Handle axis="y" onDelta={(_dx, dy, s) => setH(dy, s)} />}
      {t === "image" && <Handle axis="xy" onDelta={(dx, dy, s) => { setW(dx, s); return setH(dy, s); }} />}
    </>
  );
}

export function SectionChrome({ id }: { id: string }) {
  const ed = useEditor();
  const sec = ed.selected?.section;
  if (!sec || sec.id !== id || ed.selected?.node) return null;
  const zoom = ed.ui.zoom / 100;
  return (
    <>
      <Bar id={id} kind="section" label={sec.name} />
      <Handle axis="y" onDelta={(_dx, dy, s) => { const h = Math.round(Math.max(60, Math.min(1400, (s.h + dy) / zoom))); ed.updateSection(id, (x) => { x.style.minHeight = h; }, "Resize section", `resize:${id}`); return `min ${h}px`; }} />
    </>
  );
}
