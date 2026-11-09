"use client";
import { useRef, useState } from "react";
import { useEditor } from "@/lib/store";
import { I } from "../icons";
import { Modal } from "./controls";

export function MediaGrid({ onPick, selectedSrc }: { onPick?: (src: string) => void; selectedSrc?: string }) {
  const ed = useEditor();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f: File) => {
    setBusy(true);
    const it = await ed.addMedia(f);
    setBusy(false);
    if (it) { ed.toast("Image uploaded"); onPick?.(it.src); }
  };
  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from the server? This cannot be undone.`)) return;
    if (await ed.removeMedia(id)) ed.toast("Image deleted");
  };
  return (
    <>
      <div className="ed-media-actions">
        <button className="ed-btn" disabled={busy} onClick={() => file.current?.click()}>{I.upload} {busy ? "Uploading…" : "Upload image…"}</button>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <small className="ed-hint">JPG, PNG, WebP or GIF, up to 5 MB. Prefer WebP under 150 KB for fast pages.</small>
      </div>
      <div className="ed-media-grid">
        {ed.media.map((m) => (
          <figure key={m.id} className={m.src === selectedSrc ? "is-sel" : ""}>
            <button onClick={() => onPick?.(m.src)} disabled={!onPick} title={onPick ? "Use this image" : m.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt={m.name} draggable={false} loading="lazy" />
            </button>
            <figcaption><span>{m.name}</span><em>{m.origin === "upload" ? "uploaded" : "site"}</em>{m.origin === "upload" && <button className="ed-x" onClick={() => void remove(m.id, m.name)} title="Delete from server">{I.trash}</button>}</figcaption>
          </figure>
        ))}
        {ed.media.length === 0 && <p className="ed-empty">No images yet. Upload one.</p>}
      </div>
    </>
  );
}
export function MediaPicker({ onPick, onClose, current }: { onPick: (src: string) => void; onClose: () => void; current?: string }) {
  return <Modal title="Media library" onClose={onClose} wide><MediaGrid selectedSrc={current} onPick={(s) => { onPick(s); onClose(); }} /></Modal>;
}
