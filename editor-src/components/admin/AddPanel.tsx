"use client";
import { NODE_TEMPLATES, SECTION_TEMPLATES } from "@/lib/templates";
import { useEditor } from "@/lib/store";
import { I } from "../icons";

export function AddPanel() {
  const ed = useEditor();
  const sel = ed.selected;
  const where = !sel ? "end of page" : sel.node ? "after the selected element" : "inside the selected section";
  return (
    <div className="ed-add">
      <h4>Sections</h4>
      <p className="ed-hint">Adds below {sel ? "the selected section" : "the last section"}.</p>
      <div className="ed-tiles">
        {SECTION_TEMPLATES.map((t) => (
          <button key={t.label} className="ed-tile" onClick={() => { const s = t.make(); ed.insertSection(s, sel?.section.id ?? null); ed.select(s.id); ed.toast(`${t.label} added`); }}>
            <span>{I.plus}</span><b>{t.label}</b><small>{t.hint}</small>
          </button>
        ))}
      </div>
      <h4>Elements</h4>
      <p className="ed-hint">Added {where}.</p>
      <div className="ed-tiles">
        {NODE_TEMPLATES.map((t) => (
          <button key={t.label} className="ed-tile" disabled={ed.page.sections.length === 0 || (!sel?.node && (sel?.section.kind === "catalogue"))} onClick={() => { const n = t.make(); ed.insertNode(n, sel ? (sel.node?.id ?? sel.section.id) : null); ed.select(n.id); ed.toast(`${t.label} added`); }}>
            <span>{I.plus}</span><b>{t.label}</b><small>{t.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
