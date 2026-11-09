"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { I } from "../icons";

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="ed-field"><span className="ed-lbl">{label}</span>{children}{hint && <small className="ed-hint">{hint}</small>}</label>
);
export const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="ed-group"><h4>{title}</h4>{children}</section>
);
export function Num({ label, value, onChange, min, max, step = 1, unit, auto }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; min: number; max: number; step?: number; unit?: string; auto?: number }) {
  const shown = value ?? auto ?? min;
  return (
    <div className="ed-field">
      <span className="ed-lbl">{label}{value === undefined && auto === undefined ? <em> auto</em> : null}</span>
      <div className="ed-num">
        <input type="range" min={min} max={max} step={step} value={shown} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        <input type="number" min={min} max={max} step={step} value={value ?? ""} placeholder="auto" onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(min, Math.min(max, Number(e.target.value))))} aria-label={`${label} value`} />
        {unit && <span className="ed-unit">{unit}</span>}
        {value !== undefined && auto === undefined && <button className="ed-x" title="Reset to auto" onClick={() => onChange(undefined)}>{I.x}</button>}
      </div>
    </div>
  );
}
export function Sel<T extends string>({ label, value, options, onChange }: { label: string; value: T | undefined; options: [T, string][]; onChange: (v: T) => void }) {
  return <Field label={label}><select value={value ?? options[0][0]} onChange={(e) => onChange(e.target.value as T)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>;
}
export function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T | undefined; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ed-field"><span className="ed-lbl">{label}</span>
      <div className="ed-seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>
    </div>
  );
}
const SWATCHES: [string, string][] = [["var(--paper)", "Paper"], ["var(--paper-2)", "Paper 2"], ["var(--maize)", "Maize"], ["var(--moss)", "Pesto"], ["var(--forest)", "Primary"], ["var(--gold)", "Secondary"], ["var(--noir)", "Café noir"], ["var(--deep)", "Deep"]];
export function ColorField({ label, value, onChange, allowClear = true }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; allowClear?: boolean }) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#888888";
  return (
    <div className="ed-field"><span className="ed-lbl">{label}</span>
      <div className="ed-swatches">
        {SWATCHES.map(([v, n]) => <button key={v} type="button" title={n} aria-label={n} aria-pressed={value === v} className="ed-sw" style={{ background: v }} onClick={() => onChange(v)} />)}
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label} custom`} />
        {allowClear && value && <button className="ed-x" title="Clear" onClick={() => onChange(undefined)}>{I.x}</button>}
      </div>
    </div>
  );
}
export const Switch = ({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) => (
  <div className="ed-field ed-row"><span className="ed-lbl">{label}</span><button role="switch" aria-checked={on} className="ed-switch" onClick={() => onChange(!on)}><i /></button></div>
);
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="ed-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ed-modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header><b>{title}</b><button className="ed-ibtn" onClick={onClose} aria-label="Close">{I.x}</button></header>
        <div className="ed-modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Link target picker: a site page, WhatsApp, e-mail or a web address. Value format: "@page?query", "@whatsapp?text=…", "@email?subject=…", "/path" or "https://…". */
export function Dest({ label, value, onChange, pages, optional, onOpen, hint }: {
  label: string; value: string; onChange: (v: string) => void; pages: { id: string; name: string }[]; optional?: boolean; onOpen?: (pageId: string) => void; hint?: string;
}) {
  const m = /^@([a-z0-9-]+)(?:\?(.*))?$/.exec(value);
  const key = value === "" ? "" : m ? m[1] : "url";
  const extra = m ? m[2] ?? "" : value;
  const isPage = !!m && pages.some((p) => p.id === m[1]);
  const set = (k: string, x: string) => onChange(k === "" ? "" : k === "url" ? x : `@${k}${x ? `?${x}` : ""}`);
  return (
    <div className="ed-field">
      <span className="ed-lbl">{label}</span>
      <select value={key} onChange={(e) => set(e.target.value, e.target.value === "url" ? "https://" : key === "url" ? "" : extra)}>
        {optional && <option value="">(same as English)</option>}
        <optgroup label="Pages on this site">{pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
        <optgroup label="Contact"><option value="whatsapp">WhatsApp chat</option><option value="email">E-mail to BMS</option></optgroup>
        <option value="url">A web address (URL)…</option>
      </select>
      {key !== "" && (
        <input style={{ marginTop: 6 }} value={extra} onChange={(e) => set(key, e.target.value)}
          placeholder={key === "url" ? "https://example.com" : key === "whatsapp" ? "text=Hello%20BMS" : key === "email" ? "subject=Hello" : "optional, e.g. material=cocoa"} />
      )}
      {(hint || (isPage && onOpen)) && <span className="ed-hint">{hint}{isPage && onOpen && <> <button type="button" className="ed-btn sm ghost" onClick={() => onOpen(m![1])}>Open this page</button></>}</span>}
    </div>
  );
}
