"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { isContainer, nodeLabel, type Node, type Section } from "@/lib/model";
import { useEditor } from "@/lib/store";
import { I } from "../icons";

type Drop = { id: string; pos: "before" | "after" | "inside" } | null;

export function Layers() {
  const ed = useEditor();
  const [drop, setDrop] = useState<Drop>(null);
  const drag = ed.ui.drag;
  const collapsed = new Set(ed.ui.collapsed);
  const toggle = (id: string) => ed.patchUi({ collapsed: collapsed.has(id) ? ed.ui.collapsed.filter((x) => x !== id) : [...ed.ui.collapsed, id] });
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.querySelector(".is-sel")?.scrollIntoView({ block: "nearest" }); }, [ed.ui.selectedId]);

  const rowDnD = (id: string, kind: "section" | "node", box: boolean) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; ed.patchUi({ drag: { id, kind } }); },
    onDragEnd: () => { ed.patchUi({ drag: null }); setDrop(null); },
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (!drag || drag.id === id) return;
      if (drag.kind === "section" && kind !== "section") return;
      e.preventDefault(); e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect(); const y = (e.clientY - r.top) / r.height;
      const pos: "before" | "after" | "inside" = kind === "section" && drag.kind === "node" ? "inside" : box && y > 0.3 && y < 0.7 ? "inside" : y < 0.5 ? "before" : "after";
      if (!drop || drop.id !== id || drop.pos !== pos) setDrop({ id, pos });
    },
    onDrop: (e: React.DragEvent) => {
      if (!drag || !drop || drop.id !== id) return; e.preventDefault(); e.stopPropagation();
      if (drag.kind === "section") ed.moveSectionTo(drag.id, id, drop.pos === "after");
      else if (drop.pos === "inside") ed.moveNodeInto(drag.id, id);
      else ed.moveNodeTo(drag.id, id, drop.pos === "after");
      setDrop(null); ed.patchUi({ drag: null });
    },
  });
  const cls = (id: string, hidden: boolean) => ["ed-lrow", ed.ui.selectedId === id && "is-sel", hidden && "is-hidden", drop?.id === id && `drop-${drop.pos}`, drag?.id === id && "is-drag"].filter(Boolean).join(" ");

  const actions = (id: string, visible: boolean) => (
    <span className="ed-lact">
      <button title={visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); ed.toggleVisible(id); }}>{visible ? I.eye : I.eyeOff}</button>
      <button title="Duplicate" onClick={(e) => { e.stopPropagation(); ed.duplicateItem(id); }}>{I.copy}</button>
      <button title="Delete" className="danger" onClick={(e) => { e.stopPropagation(); ed.removeItem(id); if (ed.ui.selectedId === id) ed.select(null); }}>{I.trash}</button>
    </span>
  );
  const nodeRow = (n: Node, depth: number): React.ReactNode => {
    const box = isContainer(n); const open = !collapsed.has(n.id);
    return (
      <div key={n.id} style={{ display: "contents" }}>
        <div className={cls(n.id, !n.visible)} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => ed.select(n.id)} {...rowDnD(n.id, "node", box)} role="treeitem" aria-selected={ed.ui.selectedId === n.id}>
          {box ? <button className={`ed-chev${open ? " open" : ""}`} onClick={(e) => { e.stopPropagation(); toggle(n.id); }} aria-label={open ? "Collapse" : "Expand"}>{I.chev}</button> : <span className="ed-chev-sp" />}
          <span className="ed-ltype">{n.type.slice(0, 3)}</span><span className="ed-llabel">{nodeLabel(n, ed.ui.lang)}</span>{actions(n.id, n.visible)}
        </div>
        {box && open && n.children.map((c) => nodeRow(c, depth + 1))}
      </div>
    );
  };
  const secRow = (s: Section): React.ReactNode => {
    const open = !collapsed.has(s.id); const has = s.children.length > 0;
    return (
      <div key={s.id} style={{ display: "contents" }}>
        <div className={cls(s.id, !s.visible)} onClick={() => ed.select(s.id)} {...rowDnD(s.id, "section", false)} role="treeitem" aria-selected={ed.ui.selectedId === s.id}>
          {has ? <button className={`ed-chev${open ? " open" : ""}`} onClick={(e) => { e.stopPropagation(); toggle(s.id); }} aria-label={open ? "Collapse" : "Expand"}>{I.chev}</button> : <span className="ed-chev-sp" />}
          <span className="ed-ltype sec">sec</span><span className="ed-llabel"><b>{s.name}</b></span>{actions(s.id, s.visible)}
        </div>
        {has && open && s.children.map((c) => nodeRow(c, 1))}
      </div>
    );
  };
  return (
    <div className="ed-layers" ref={listRef} role="tree" aria-label="Page layers">
      {ed.page.sections.map((s) => secRow(s))}
      {ed.page.sections.length === 0 && <p className="ed-empty">No sections on this page. Use the Add tab to insert one.</p>}
      <p className="ed-hint" style={{ padding: "8px 10px" }}>Drag rows to reorder. Drop onto a container to move into it.</p>
    </div>
  );
}
