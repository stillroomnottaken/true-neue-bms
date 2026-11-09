"use client";
import { useState } from "react";
import { isTextual, nodeLabel, uid, type ContainerVariant, type Lang, type Node, type ParagraphVariant, type Section, type SectionVariant, type Style } from "@/lib/model";
import { useEditor } from "@/lib/store";
import { I } from "../icons";
import { ColorField, Field, Group, Num, Sel, Seg, Switch } from "./controls";
import { MediaPicker } from "./MediaPicker";

export function Inspector() {
  const ed = useEditor();
  const sel = ed.selected;
  if (!sel) return (
    <div className="ed-insp-empty"><div>{I.edit}</div><b>Nothing selected</b><p>Click a section, heading, image or button on the canvas, or pick a row in Layers, to edit its properties.</p></div>
  );
  return sel.node ? <NodeInspector node={sel.node} /> : <SectionInspector s={sel.section} />;
}

const ONLY: [string, string][] = [["both", "Both"], ["en", "EN only"], ["id", "ID only"]];
const HREF_HELP = "Pick a site page (@page), WhatsApp (@whatsapp?text=…), e-mail (@email?subject=…) or type a full URL.";
function DestList() {
  const ed = useEditor();
  return <datalist id="dest-list">{ed.data.pages.map((p) => <option key={p.id} value={`@${p.id}`}>{p.name.en}</option>)}<option value="@whatsapp">WhatsApp</option><option value="@email">E-mail</option></datalist>;
}

function Head({ title, sub, id, visible }: { title: string; sub: string; id: string; visible: boolean }) {
  const ed = useEditor();
  return (
    <div className="ed-insp-head">
      <div><b>{title}</b><small>{sub}</small></div>
      <div className="ed-lact vis">
        <button title="Move up" onClick={() => ed.nudge(id, -1)}>{I.up}</button><button title="Move down" onClick={() => ed.nudge(id, 1)}>{I.down}</button>
        <button title={visible ? "Hide" : "Show"} onClick={() => ed.toggleVisible(id)}>{visible ? I.eye : I.eyeOff}</button>
        <button title="Duplicate" onClick={() => ed.duplicateItem(id)}>{I.copy}</button>
        <button title="Delete" className="danger" onClick={() => { ed.removeItem(id); ed.select(null); }}>{I.trash}</button>
      </div>
    </div>
  );
}

function SectionInspector({ s }: { s: Section }) {
  const ed = useEditor();
  const [pick, setPick] = useState(false);
  const set = (label: string, fn: (s: Section["style"]) => void, key?: string) => ed.updateSection(s.id, (x) => fn(x.style), label, key ?? `sec:${s.id}:${label}`);
  const st = s.style;
  const generic = s.kind !== "catalogue" && s.kind !== "contact" && s.kind !== "form";
  return (
    <div className="ed-insp" key={s.id}>
      <Head title={s.name} sub={`Section · ${s.kind}`} id={s.id} visible={s.visible} />
      <Group title="Section">
        {(s.kind === "band" || s.kind === "content" || s.kind === "form") && (
          <Sel label="Style" value={s.variant ?? "none"} options={(s.kind === "band" ? [["none", "Plain"], ["head-maize", "Page header · maize"], ["head-gold", "Page header · gold"], ["head-moss", "Page header · moss"], ["head-forest", "Page header · green"], ["ribbon-maize", "Ribbon link · maize"], ["ribbon-gold", "Ribbon link · gold"], ["ribbon-moss", "Ribbon link · moss"], ["ribbon-noir", "Ribbon link · dark"]] : [["none", "Normal"], ["alt", "Tinted background"]]) as [string, string][]}
            onChange={(v) => ed.updateSection(s.id, (x) => { x.variant = v === "none" ? undefined : (v as SectionVariant); }, "Section style")} />
        )}
        <Seg label="Show in" value={s.only ?? "both"} options={ONLY} onChange={(v) => ed.updateSection(s.id, (x) => { x.only = v === "both" ? undefined : (v as Lang); }, "Section language")} />
        <Field label="Name"><input value={s.name} onChange={(e) => ed.updateSection(s.id, (x) => { x.name = e.target.value; }, "Rename section", `secname:${s.id}`)} /></Field>
        <Switch label="Visible" on={s.visible} onChange={() => ed.toggleVisible(s.id)} />
      </Group>
      <Group title="Background">
        <ColorField label="Color" value={st.bg} onChange={(v) => set("Section background", (x) => { x.bg = v; })} />
        <div className="ed-field"><span className="ed-lbl">Background image</span>
          <div className="ed-row2"><button className="ed-btn" onClick={() => setPick(true)}>{I.image} {st.bgImage ? "Change" : "Choose"}</button>{st.bgImage && <button className="ed-btn ghost" onClick={() => set("Remove background image", (x) => { x.bgImage = undefined; })}>Remove</button>}</div>
        </div>
        {generic && <Seg label="Text tone" value={st.tone ?? "dark"} options={[["dark", "Dark text"], ["light", "Light text"]]} onChange={(v) => set("Section tone", (x) => { x.tone = v; })} />}
      </Group>
      <Group title="Layout">
        <Num label="Content width" value={st.contentWidth} min={480} max={1400} step={10} unit="px" auto={ed.data.design.contentWidth} onChange={(v) => set("Content width", (x) => { x.contentWidth = v; })} />
        {generic && <Sel label="Layout" value={st.layout} options={[["stack", "Stack (1 column)"], ["columns", "Columns"], ["grid", "Grid"]]} onChange={(v) => set("Section layout", (x) => { x.layout = v; if (v !== "stack" && x.columns < 2) x.columns = 2; })} />}
        {(st.layout !== "stack" || s.kind === "catalogue") && <Num label="Columns" value={st.columns} min={1} max={4} unit="" onChange={(v) => set("Columns", (x) => { x.columns = v ?? 1; })} />}
        <Num label="Gap" value={st.gap} min={0} max={80} unit="px" onChange={(v) => set("Gap", (x) => { x.gap = v ?? 0; })} />
        <Seg label="Alignment" value={st.align} options={[["left", "Left"], ["center", "Center"], ["right", "Right"], ["stretch", "Fill"]]} onChange={(v) => set("Alignment", (x) => { x.align = v; })} />
        <Num label="Min height" value={st.minHeight} min={60} max={1400} step={10} unit="px" onChange={(v) => set("Min height", (x) => { x.minHeight = v; })} />
      </Group>
      <Group title="Spacing">
        <Num label="Padding top" value={st.padTop} min={0} max={200} unit="px" onChange={(v) => set("Padding", (x) => { x.padTop = v ?? 0; })} />
        <Num label="Padding bottom" value={st.padBottom} min={0} max={200} unit="px" onChange={(v) => set("Padding", (x) => { x.padBottom = v ?? 0; })} />
        <Num label="Margin top" value={st.marginTop} min={0} max={160} unit="px" onChange={(v) => set("Margin", (x) => { x.marginTop = v ?? 0; })} />
        <Num label="Margin bottom" value={st.marginBottom} min={0} max={160} unit="px" onChange={(v) => set("Margin", (x) => { x.marginBottom = v ?? 0; })} />
      </Group>
      {s.kind === "band" && s.variant?.startsWith("ribbon-") && (
        <Group title="Ribbon link">
          <Field label="Destination" hint={HREF_HELP}><input list="dest-list" value={s.href ?? ""} onChange={(e) => ed.updateSection(s.id, (x) => { x.href = e.target.value; }, "Ribbon link", `href:${s.id}`)} /></Field>
          <Field label="Destination · Indonesian (optional)"><input list="dest-list" value={s.hrefId ?? ""} onChange={(e) => ed.updateSection(s.id, (x) => { x.hrefId = e.target.value || undefined; }, "Ribbon link", `hrefid:${s.id}`)} /></Field>
          <DestList />
        </Group>
      )}
      {s.kind === "form" && (
        <Group title="Enquiry form">
          <Sel label="Form" value={s.form ?? "buyer"} options={[["buyer", "Buyer enquiry"], ["supplier", "Supplier offer"]]} onChange={(v) => ed.updateSection(s.id, (x) => { x.form = v as "buyer" | "supplier"; }, "Form type")} />
          {(["en", "id"] as const).map((l) => <Field key={l} label={`Form title · ${l.toUpperCase()}`}><input value={s.formTitle?.[l] ?? ""} onChange={(e) => ed.updateSection(s.id, (x) => { x.formTitle = { en: "", id: "", ...x.formTitle, [l]: e.target.value }; }, "Form title", `ft:${s.id}:${l}`)} /></Field>)}
          {(["en", "id"] as const).map((l) => <Field key={l} label={`Hint under title · ${l.toUpperCase()}`}><input value={s.formHint?.[l] ?? ""} onChange={(e) => ed.updateSection(s.id, (x) => { x.formHint = { en: "", id: "", ...x.formHint, [l]: e.target.value }; }, "Form hint", `fh:${s.id}:${l}`)} /></Field>)}
          <p className="ed-note">The fields, WhatsApp hand-off and the material list (from the Catalogue) are built by the site. The elements inside this section fill the side panel.</p>
        </Group>
      )}
      {s.kind === "catalogue" && <p className="ed-note">Entries in this grid are managed in the <button className="ed-link" onClick={() => ed.patchUi({ view: "catalogue" })}>Catalogue</button> panel.</p>}
      {pick && <MediaPicker current={st.bgImage} onClose={() => setPick(false)} onPick={(src) => set("Background image", (x) => { x.bgImage = src; })} />}
    </div>
  );
}

function NodeInspector({ node }: { node: Node }) {
  const ed = useEditor();
  const [pick, setPick] = useState(false);
  const lang = ed.ui.lang;
  const sty = (label: string, fn: (s: Style) => void) => ed.updateNode(node.id, (n) => fn(n.style), label, `style:${node.id}:${label}`);
  const s = node.style;
  const showWidth = node.type !== "spacer" && node.type !== "divider";
  return (
    <div className="ed-insp" key={node.id}>
      <Head title={nodeLabel(node, lang)} sub={`Element · ${node.type}`} id={node.id} visible={node.visible} />

      <Group title="Visibility">
        <Seg label="Show in" value={node.only ?? "both"} options={ONLY} onChange={(v) => ed.updateNode(node.id, (n) => { n.only = v === "both" ? undefined : (v as Lang); }, "Element language")} />
      </Group>
      {isTextual(node) && (
        <Group title={`Text · ${lang.toUpperCase()}`}>
          <Field label="Content" hint={`Edits the ${lang === "en" ? "English" : "Indonesian"} text only.`}>
            <textarea rows={node.type === "heading" ? 2 : 4} value={node.text[lang]} onChange={(e) => ed.setText(node.id, "text", lang, e.target.value)} />
          </Field>
          {node.type === "paragraph" && <Sel label="Look" value={node.variant ?? "none"} options={[["none", "Normal"], ["lead", "Lead (larger)"], ["muted", "Muted"], ["note", "Small note"]]} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "paragraph") n.variant = v === "none" ? undefined : (v as ParagraphVariant); }, "Paragraph look")} />}
          {isTextual(node) && <p className="ed-hint">Tokens: {"{count}"} catalogue size, {"{nib}"}, {"{email}"}, {"{year}"}.</p>}
          {node.type === "heading" && <Seg label="Level" value={String(node.level)} options={[["1", "H1"], ["2", "H2"], ["3", "H3"]]} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "heading") n.level = Number(v) as 1 | 2 | 3; }, "Heading level")} />}
        </Group>
      )}
      {isTextual(node) && (
        <Group title="Typography">
          <Sel label="Font family" value={s.font ?? "default"} options={[["default", "Site default"], ["serif", "Serif (Fraunces)"], ["sans", "Sans (system)"], ["mono", "Monospace"]]} onChange={(v) => sty("Font family", (x) => { x.font = v; })} />
          <Num label="Font size" value={s.size} min={10} max={96} unit="px" onChange={(v) => sty("Font size", (x) => { x.size = v; })} />
          <Sel label="Font weight" value={String(s.weight ?? 0)} options={[["0", "Default"], ["400", "Regular 400"], ["500", "Medium 500"], ["600", "Semibold 600"], ["700", "Bold 700"]]} onChange={(v) => sty("Font weight", (x) => { x.weight = Number(v) || undefined; })} />
          <ColorField label="Text color" value={s.color} onChange={(v) => sty("Text color", (x) => { x.color = v; })} />
          <Seg label="Alignment" value={s.align} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => sty("Text align", (x) => { x.align = v; })} />
          <Num label="Line height" value={s.lineHeight} min={1} max={2.4} step={0.05} onChange={(v) => sty("Line height", (x) => { x.lineHeight = v; })} />
          <Num label="Letter spacing" value={s.letterSpacing} min={-2} max={12} step={0.5} unit="px" onChange={(v) => sty("Letter spacing", (x) => { x.letterSpacing = v; })} />
          <Num label="Maximum width" value={s.maxWidth} min={120} max={1200} step={10} unit="px" onChange={(v) => sty("Max width", (x) => { x.maxWidth = v; })} />
        </Group>
      )}

      {node.type === "image" && (
        <>
          <Group title="Image">
            {node.src && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ed-thumb" src={node.src} alt="" />}
            <div className="ed-row2"><button className="ed-btn" onClick={() => setPick(true)}>{I.image} {node.src ? "Replace image" : "Choose image"}</button>{node.src && <button className="ed-btn ghost" onClick={() => ed.updateNode(node.id, (n) => { if (n.type === "image") n.src = ""; }, "Remove image")}>Remove</button>}</div>
            <Field label={`Alt text · ${lang.toUpperCase()}`}><input value={node.alt[lang]} onChange={(e) => ed.setText(node.id, "alt", lang, e.target.value)} /></Field>
          </Group>
          <Group title="Size & fit">
            <Num label="Height" value={s.height} min={60} max={900} step={5} unit="px" onChange={(v) => sty("Height", (x) => { x.height = v; })} />
            <Sel label="Aspect ratio" value={s.aspect ?? "auto"} options={[["auto", "Auto (16:9 placeholder)"], ["1/1", "1:1"], ["4/3", "4:3"], ["3/2", "3:2"], ["16/9", "16:9"]]} onChange={(v) => sty("Aspect ratio", (x) => { x.aspect = v; x.height = undefined; })} />
            <Sel label="Object fit" value={s.fit ?? "cover"} options={[["cover", "Cover"], ["contain", "Contain"], ["fill", "Fill"]]} onChange={(v) => sty("Object fit", (x) => { x.fit = v; })} />
            <Sel label="Object position" value={s.position ?? "center"} options={[["center", "Center"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"]]} onChange={(v) => sty("Object position", (x) => { x.position = v; })} />
            <Num label="Corner radius" value={s.radius} min={0} max={48} unit="px" onChange={(v) => sty("Corner radius", (x) => { x.radius = v; })} />
          </Group>
          {pick && <MediaPicker current={node.src} onClose={() => setPick(false)} onPick={(src) => ed.updateNode(node.id, (n) => { if (n.type === "image") n.src = src; }, "Replace image")} />}
        </>
      )}

      {(node.type === "button" || node.type === "link") && (
        <Group title="Content">
          <Field label={`Label · ${lang.toUpperCase()}`}><input value={node.label[lang]} onChange={(e) => ed.setText(node.id, "label", lang, e.target.value)} /></Field>
          <Field label="Destination" hint={HREF_HELP}>
            <input list="dest-list" value={node.href} onChange={(e) => ed.updateNode(node.id, (n) => { if (n.type === "button" || n.type === "link") n.href = e.target.value; }, "Change destination", `href:${node.id}`)} />
            <DestList />
          </Field>
          <Field label="Destination · Indonesian (optional)" hint="Leave empty to use the same destination."><input list="dest-list" value={node.hrefId ?? ""} onChange={(e) => ed.updateNode(node.id, (n) => { if (n.type === "button" || n.type === "link") n.hrefId = e.target.value || undefined; }, "Change destination", `hrefid:${node.id}`)} /></Field>
        </Group>
      )}
      {node.type === "button" && (
        <Group title="Button style">
          <Sel label="Variant" value={node.variant} options={[["forest", "Primary"], ["gold", "Secondary"], ["maize", "Maize"], ["line", "Outline"]]} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "button") n.variant = v; }, "Button variant")} />
          <Seg label="Size" value={node.size} options={[["sm", "S"], ["md", "M"], ["lg", "L"]]} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "button") n.size = v; }, "Button size")} />
          <Seg label="Alignment" value={s.self ?? "left"} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => sty("Button alignment", (x) => { x.self = v; })} />
          <Num label="Border radius" value={s.radius} min={0} max={40} unit="px" auto={ed.data.design.buttonRadius} onChange={(v) => sty("Button radius", (x) => { x.radius = v; })} />
        </Group>
      )}
      {node.type === "link" && <Group title="Style"><ColorField label="Color" value={s.color} onChange={(v) => sty("Link color", (x) => { x.color = v; })} /><Num label="Font size" value={s.size} min={10} max={48} unit="px" onChange={(v) => sty("Font size", (x) => { x.size = v; })} /></Group>}

      {node.type === "container" && (
        <Group title="Container layout">
          <Sel label="Look" value={node.variant ?? "none"} options={[["none", "Plain group"], ["card", "Card"], ["pair", "Buy / Supply pair"], ["steps", "Numbered steps"], ["chips", "Tags"], ["crumbs", "Breadcrumb"], ["channels", "Contact options (list)"], ["channel", "Contact option (box)"]]} onChange={(v) => ed.updateNode(node.id, (n) => { if (n.type === "container") n.variant = v === "none" ? undefined : (v as ContainerVariant); }, "Container look")} />
          <Sel label="Layout" value={s.layout ?? "stack"} options={[["stack", "Stack"], ["row", "Row (wraps)"], ["grid", "Grid"]]} onChange={(v) => sty("Container layout", (x) => { x.layout = v; if (v === "grid" && !x.columns) x.columns = 2; })} />
          {s.layout === "grid" && <Num label="Columns" value={s.columns ?? 2} min={1} max={4} onChange={(v) => sty("Columns", (x) => { x.columns = v ?? 1; })} />}
          <Num label="Gap" value={s.gap ?? 12} min={0} max={80} unit="px" onChange={(v) => sty("Gap", (x) => { x.gap = v ?? 0; })} />
          {node.children.length === 0 && <p className="ed-note">Empty. Add components from the Add tab while this is selected.</p>}
        </Group>
      )}
      {node.type === "card" && (
        <Group title="Card">
          <Field label={`Title · ${lang.toUpperCase()}`}><input value={node.title[lang]} onChange={(e) => ed.setText(node.id, "title", lang, e.target.value)} /></Field>
          {node.variant === "step" && <Field label={`Text · ${lang.toUpperCase()}`}><input value={node.text[lang]} onChange={(e) => ed.setText(node.id, "text", lang, e.target.value)} /></Field>}
          {node.variant === "image" && <>
            {node.src && /* eslint-disable-next-line @next/next/no-img-element */ <img className="ed-thumb" src={node.src} alt="" />}
            <div className="ed-row2"><button className="ed-btn" onClick={() => setPick(true)}>{I.image} {node.src ? "Replace image" : "Choose image"}</button>{node.src && <button className="ed-btn ghost" onClick={() => ed.updateNode(node.id, (n) => { if (n.type === "card") n.src = ""; }, "Remove image")}>Remove</button>}</div>
            {pick && <MediaPicker current={node.src} onClose={() => setPick(false)} onPick={(src) => ed.updateNode(node.id, (n) => { if (n.type === "card") n.src = src; }, "Replace image")} />}
          </>}
        </Group>
      )}
      {node.type === "facts" && (
        <Group title="Facts list">
          <p className="ed-hint">Click a label or value on the canvas to edit it in {lang === "en" ? "English" : "Indonesian"}.</p>
          <button className="ed-btn" onClick={() => ed.updateNode(node.id, (n) => { if (n.type === "facts") n.rows.push({ id: uid("r"), label: { en: "Label", id: "Label" }, value: { en: "Value", id: "Nilai" } }); }, "Add row")}>{I.plus} Add row</button>
          {node.rows.map((r) => <div className="ed-rowitem" key={r.id}><span>{r.label[lang] || "(empty)"}</span><label className="ed-check" title="Show the value in grey italics"><input type="checkbox" checked={!!r.soon} onChange={(e) => ed.updateNode(node.id, (n) => { if (n.type === "facts") { const row = n.rows.find((x) => x.id === r.id); if (row) row.soon = e.target.checked || undefined; } }, "Facts row style")} /> muted</label><button className="ed-x" title="Remove row" onClick={() => ed.updateNode(node.id, (n) => { if (n.type === "facts") n.rows = n.rows.filter((x) => x.id !== r.id); }, "Remove row")}>{I.x}</button></div>)}
        </Group>
      )}
      {node.type === "spacer" && <Group title="Spacer"><Num label="Height" value={s.height ?? 32} min={8} max={400} unit="px" onChange={(v) => sty("Spacer height", (x) => { x.height = v ?? 32; })} /></Group>}
      {node.type === "divider" && <Group title="Divider"><ColorField label="Color" value={s.color} onChange={(v) => sty("Divider color", (x) => { x.color = v; })} /><Num label="Thickness" value={s.height ?? 2} min={1} max={12} unit="px" onChange={(v) => sty("Divider thickness", (x) => { x.height = v ?? 2; })} /></Group>}
      {node.type === "graphic" && <p className="ed-note">Decorative illustration from the BMS site. It can be moved, hidden or deleted.</p>}

      {showWidth && node.type !== "button" && (
        <Group title="Placement">
          <Num label="Width" value={s.width} min={10} max={100} step={0.5} unit="%" auto={100} onChange={(v) => sty("Width", (x) => { x.width = v; })} />
          {node.type !== "graphic" && <Seg label="Align in parent" value={s.self ?? "left"} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} onChange={(v) => sty("Align in parent", (x) => { x.self = v; })} />}
        </Group>
      )}
      {node.type === "button" && <Group title="Placement"><Num label="Width" value={s.width} min={10} max={100} unit="%" auto={100} onChange={(v) => sty("Width", (x) => { x.width = v; })} /></Group>}
    </div>
  );
}
