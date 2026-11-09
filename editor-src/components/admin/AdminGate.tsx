"use client";
import { useEffect, useState } from "react";
import { api, type ContentResponse } from "@/lib/api";
import type { MediaItem } from "@/lib/model";
import { EditorProvider } from "@/lib/store";
import AdminApp from "./AdminApp";

/** Loads the published content + media list from the PHP API (401 → back to the login page), then mounts the editor. */
export default function AdminGate() {
  const [boot, setBoot] = useState<{ initial: ContentResponse; media: MediaItem[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([api.content(), api.media()])
      .then(([initial, m]) => { if (live) setBoot({ initial, media: m.items }); })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : "Could not load"); });
    return () => { live = false; };
  }, []);
  if (err) return <div style={{ padding: 40, font: "16px system-ui" }}><p><b>Could not load the editor.</b> {err}</p><p><button onClick={() => location.reload()}>Try again</button></p></div>;
  if (!boot) return <div style={{ padding: 40, font: "16px system-ui", color: "#555" }}>Loading editor…</div>;
  return <EditorProvider initial={boot.initial} media={boot.media}><AdminApp /></EditorProvider>;
}
