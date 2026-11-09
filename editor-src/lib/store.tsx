"use client";
// Editor state. The page model lives in memory while editing (with undo/redo); "Save & publish" sends it to the PHP API,
// which validates it and writes it to the server. Nothing is kept in localStorage or cookies by this module.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { cloneFresh, isContainer, locate, uid, containsId, type CatalogueItem, type EditorData, type Lang, type Loc, type MediaItem, type Node, type Page, type Section } from "./model";
import { api as server, ApiError, type ContentResponse } from "./api";

export type Device = "desktop" | "tablet" | "mobile";
export type View = "overview" | "editor" | "pages" | "catalogue" | "media" | "languages" | "design" | "inquiries" | "account";
export type Drag = { id: string; kind: "section" | "node" } | null;
export interface Ui {
  lang: Lang; pageId: string; selectedId: string | null; device: Device; zoom: number; preview: boolean; view: View;
  collapsed: string[]; log: { t: number; label: string }[]; drag: Drag; toast: string | null; leftTab: "layers" | "add";
}
interface State { present: EditorData; past: EditorData[]; future: EditorData[]; ui: Ui; media: MediaItem[]; lastKey: string; lastAt: number; dirty: number; savedDirty: number; rev: number; savedAt: number | null; saving: boolean; conflict: boolean }

type Action =
  | { type: "commit"; fn: (d: EditorData) => void; label: string; key?: string; at: number }
  | { type: "undo" } | { type: "redo" }
  | { type: "loaded"; data: EditorData; rev: number; savedAt: number | null; toast?: string }
  | { type: "saved"; rev: number; savedAt: number; atDirty: number }
  | { type: "flags"; patch: Partial<Pick<State, "saving" | "conflict">> }
  | { type: "ui"; patch: Partial<Ui> }
  | { type: "media"; fn: (m: MediaItem[]) => MediaItem[] };

const newUi = (): Ui => ({ lang: "en", pageId: "home", selectedId: null, device: "desktop", zoom: 100, preview: false, view: "overview", collapsed: [], log: [], drag: null, toast: null, leftTab: "layers" });
const init = (p: { initial: ContentResponse; media: MediaItem[] }): State => ({ present: p.initial.data, past: [], future: [], ui: newUi(), media: p.media, lastKey: "", lastAt: 0, dirty: 0, savedDirty: 0, rev: p.initial.rev, savedAt: p.initial.savedAt, saving: false, conflict: false });
const HISTORY_MAX = 100;
const COALESCE_MS = 900;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "commit": {
      const next = structuredClone(s.present);
      a.fn(next);
      const coalesce = !!a.key && a.key === s.lastKey && a.at - s.lastAt < COALESCE_MS && s.past.length > 0;
      const past = coalesce ? s.past : [...s.past, s.present].slice(-HISTORY_MAX);
      const log = coalesce ? s.ui.log : [{ t: a.at, label: a.label }, ...s.ui.log].slice(0, 12);
      return { ...s, present: next, past, future: [], lastKey: a.key ?? "", lastAt: a.at, dirty: s.dirty + 1, ui: { ...s.ui, log } };
    }
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return fix({ ...s, present: prev, past: s.past.slice(0, -1), future: [s.present, ...s.future], lastKey: "", ui: { ...s.ui, toast: "Undone" } });
    }
    case "redo": {
      if (!s.future.length) return s;
      const [nx, ...rest] = s.future;
      return fix({ ...s, present: nx, past: [...s.past, s.present], future: rest, lastKey: "", ui: { ...s.ui, toast: "Redone" } });
    }
    case "loaded": return fix({ ...s, present: a.data, past: [], future: [], lastKey: "", dirty: 0, savedDirty: 0, rev: a.rev, savedAt: a.savedAt, conflict: false, saving: false, ui: { ...s.ui, selectedId: null, toast: a.toast ?? s.ui.toast } });
    case "saved": return { ...s, rev: a.rev, savedAt: a.savedAt, savedDirty: a.atDirty, saving: false, conflict: false, ui: { ...s.ui, toast: "Saved and published" } };
    case "flags": return { ...s, ...a.patch };
    case "ui": return { ...s, ui: { ...s.ui, ...a.patch } };
    case "media": return { ...s, media: a.fn(s.media) };
  }
}
/** after undo/redo make sure selection and page still exist */
function fix(s: State): State {
  const page = s.present.pages.find((p) => p.id === s.ui.pageId) ?? s.present.pages[0];
  const sel = s.ui.selectedId && locate(page, s.ui.selectedId) ? s.ui.selectedId : null;
  return { ...s, ui: { ...s.ui, pageId: page.id, selectedId: sel } };
}

export interface Api {
  data: EditorData; ui: Ui; media: MediaItem[]; canUndo: boolean; canRedo: boolean; dirty: number;
  isDirty: boolean; rev: number; savedAt: number | null; saving: boolean; conflict: boolean; user: string;
  save: (force?: boolean) => Promise<boolean>; discard: () => Promise<void>; setRevision: (data: EditorData, rev: number, toast: string) => void;
  page: Page; selected: ReturnType<typeof locate>;
  commit: (label: string, fn: (d: EditorData) => void, key?: string) => void;
  patchUi: (patch: Partial<Ui>) => void;
  select: (id: string | null) => void;
  undo: () => void; redo: () => void; toast: (m: string) => void;
  addMedia: (file: File) => Promise<MediaItem | null>; removeMedia: (id: string) => Promise<boolean>;
  // page-model helpers (all go through commit)
  updateNode: (id: string, fn: (n: Node) => void, label?: string, key?: string) => void;
  updateSection: (id: string, fn: (s: Section) => void, label?: string, key?: string) => void;
  setText: (id: string, field: "text" | "label" | "title" | "alt", lang: Lang, value: string) => void;
  insertNode: (node: Node, target?: string | null) => void;
  insertSection: (section: Section, afterId?: string | null) => void;
  removeItem: (id: string) => void; duplicateItem: (id: string) => void;
  moveSectionTo: (id: string, targetId: string, after: boolean) => void;
  moveNodeTo: (id: string, targetId: string, after: boolean) => void;
  moveNodeInto: (id: string, containerOrSectionId: string) => void;
  nudge: (id: string, dir: -1 | 1) => void;
  toggleVisible: (id: string) => void;
  catalogue: { add: () => string; update: (id: string, fn: (c: CatalogueItem) => void, key?: string) => void; remove: (id: string) => void; move: (id: string, dir: -1 | 1) => void };
}
const Ctx = createContext<Api | null>(null);
export const useEditor = () => { const c = useContext(Ctx); if (!c) throw new Error("EditorProvider missing"); return c; };

const findPage = (d: EditorData, pageId: string) => d.pages.find((p) => p.id === pageId)!;

export function EditorProvider({ children, initial, media }: { children: ReactNode; initial: ContentResponse; media: MediaItem[] }) {
  const [s, dispatch] = useReducer(reducer, { initial, media }, init);
  const sRef = useRef(s); sRef.current = s;
  const user = initial.user;

  const commit = useCallback((label: string, fn: (d: EditorData) => void, key?: string) => dispatch({ type: "commit", fn, label, key, at: Date.now() }), []);
  const patchUi = useCallback((patch: Partial<Ui>) => dispatch({ type: "ui", patch }), []);
  const toast = useCallback((m: string) => dispatch({ type: "ui", patch: { toast: m } }), []);
  const pageId = s.ui.pageId;

  // toast auto-dismiss
  useEffect(() => { if (!s.ui.toast) return; const t = setTimeout(() => dispatch({ type: "ui", patch: { toast: null } }), 3200); return () => clearTimeout(t); }, [s.ui.toast]);
  // warn before leaving with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (sRef.current.dirty !== sRef.current.savedDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const api = useMemo<Api>(() => {
    const pg = (d: EditorData) => findPage(d, pageId);
    const updateNode: Api["updateNode"] = (id, fn, label = "Edit element", key) =>
      commit(label, (d) => { const l = locate(pg(d), id); if (l?.node) fn(l.node); }, key);
    const updateSection: Api["updateSection"] = (id, fn, label = "Edit section", key) =>
      commit(label, (d) => { const sec = pg(d).sections.find((x) => x.id === id); if (sec) fn(sec); }, key);
    const removeFrom = (page: Page, id: string): Node | Section | null => {
      const l = locate(page, id);
      if (!l) return null;
      if (!l.node) { const i = page.sections.indexOf(l.section); return page.sections.splice(i, 1)[0]; }
      return l.siblings!.splice(l.index!, 1)[0];
    };
    const save = async (force = false): Promise<boolean> => {
      const cur = sRef.current;
      if (cur.saving) return false;
      dispatch({ type: "flags", patch: { saving: true } });
      try {
        const r = await server.save(cur.present, cur.rev, force);
        dispatch({ type: "saved", rev: r.rev, savedAt: r.savedAt, atDirty: cur.dirty });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) dispatch({ type: "flags", patch: { saving: false, conflict: true } });
        else dispatch({ type: "flags", patch: { saving: false } });
        dispatch({ type: "ui", patch: { toast: e instanceof Error ? e.message : "Save failed" } });
        return false;
      }
    };
    const discard = async () => {
      try { const c = await server.content(); dispatch({ type: "loaded", data: c.data, rev: c.rev, savedAt: c.savedAt, toast: "Reloaded the published version" }); }
      catch (e) { dispatch({ type: "ui", patch: { toast: e instanceof Error ? e.message : "Reload failed" } }); }
    };
    return {
      data: s.present, ui: s.ui, media: s.media, canUndo: s.past.length > 0, canRedo: s.future.length > 0, dirty: s.dirty,
      isDirty: s.dirty !== s.savedDirty, rev: s.rev, savedAt: s.savedAt, saving: s.saving, conflict: s.conflict, user,
      save, discard, setRevision: (data, rev, toast) => dispatch({ type: "loaded", data, rev, savedAt: Date.now() / 1000, toast }),
      page: findPage(s.present, pageId), selected: locate(findPage(s.present, pageId), s.ui.selectedId),
      commit, patchUi, toast,
      select: (id) => patchUi({ selectedId: id }),
      undo: () => dispatch({ type: "undo" }), redo: () => dispatch({ type: "redo" }),
      addMedia: async (file) => {
        try { const r = await server.upload(file); dispatch({ type: "media", fn: (m) => [...m, r.item] }); return r.item; }
        catch (e) { dispatch({ type: "ui", patch: { toast: e instanceof Error ? e.message : "Upload failed" } }); return null; }
      },
      removeMedia: async (id) => {
        try { await server.deleteMedia(id); dispatch({ type: "media", fn: (m) => m.filter((x) => x.id !== id) }); return true; }
        catch (e) { dispatch({ type: "ui", patch: { toast: e instanceof Error ? e.message : "Could not delete" } }); return false; }
      },
      updateNode, updateSection,
      setText: (id, field, lang, value) => updateNode(id, (n) => { ((n as unknown as Record<string, Loc>)[field])[lang] = value; }, "Edit text", `text:${id}:${field}:${lang}`),
      insertNode: (node, target) => commit(`Add ${node.type}`, (d) => {
        const page = pg(d);
        const t = locate(page, target ?? null) ?? (page.sections.length ? { section: page.sections[page.sections.length - 1] } : null);
        if (!t) return;
        if (!t.node) t.section.children.push(node);
        else if (isContainer(t.node)) t.node.children.push(node);
        else t.siblings!.splice(t.index! + 1, 0, node);
      }),
      insertSection: (section, afterId) => commit(`Add section`, (d) => {
        const page = pg(d); const l = locate(page, afterId ?? null);
        const i = l ? page.sections.indexOf(l.section) + 1 : page.sections.length;
        page.sections.splice(i, 0, section);
      }),
      removeItem: (id) => commit("Delete", (d) => { removeFrom(pg(d), id); }),
      duplicateItem: (id) => commit("Duplicate", (d) => {
        const page = pg(d); const l = locate(page, id); if (!l) return;
        if (!l.node) { const c = cloneFresh(l.section); c.name = `${l.section.name} (copy)`; page.sections.splice(page.sections.indexOf(l.section) + 1, 0, c); }
        else l.siblings!.splice(l.index! + 1, 0, cloneFresh(l.node));
      }),
      moveSectionTo: (id, targetId, after) => commit("Reorder sections", (d) => {
        const page = pg(d); if (id === targetId) return;
        const moved = removeFrom(page, id) as Section | null; if (!moved) return;
        const ti = page.sections.findIndex((x) => x.id === targetId);
        page.sections.splice(ti + (after ? 1 : 0), 0, moved);
      }),
      moveNodeTo: (id, targetId, after) => commit("Move element", (d) => {
        const page = pg(d); if (id === targetId) return;
        const src = locate(page, id); if (!src?.node) return;
        if (containsId(src.node, targetId)) return; // cannot drop inside itself
        const moved = removeFrom(page, id) as Node;
        const t = locate(page, targetId); if (!t?.node) { src.siblings!.splice(src.index!, 0, moved); return; }
        t.siblings!.splice(t.index! + (after ? 1 : 0), 0, moved);
      }),
      moveNodeInto: (id, destId) => commit("Move element", (d) => {
        const page = pg(d);
        const src = locate(page, id); if (!src?.node || containsId(src.node, destId)) return;
        const dest = locate(page, destId); if (!dest) return;
        if (dest.node && !isContainer(dest.node)) return;
        const moved = removeFrom(page, id) as Node;
        (dest.node ? (dest.node as Extract<Node, { type: "container" }>).children : dest.section.children).push(moved);
      }),
      nudge: (id, dir) => commit(dir < 0 ? "Move up" : "Move down", (d) => {
        const page = pg(d); const l = locate(page, id); if (!l) return;
        const arr = l.node ? l.siblings! : page.sections; const i = l.node ? l.index! : page.sections.indexOf(l.section); const j = i + dir;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }),
      toggleVisible: (id) => commit("Toggle visibility", (d) => { const l = locate(pg(d), id); if (!l) return; if (l.node) l.node.visible = !l.node.visible; else l.section.visible = !l.section.visible; }),
      catalogue: {
        add: () => {
          const id = uid("m");
          commit("Add catalogue entry", (d) => { d.catalogue.push({ id, slug: `new-material-${d.catalogue.length + 1}`, name: { en: "New commodity", id: "Komoditas baru" }, desc: { en: "", id: "" }, cat: "agri", image: "", visible: true }); });
          return id;
        },
        update: (id, fn, key) => commit("Edit catalogue entry", (d) => { const c = d.catalogue.find((x) => x.id === id); if (c) fn(c); }, key),
        remove: (id) => commit("Delete catalogue entry", (d) => { d.catalogue = d.catalogue.filter((x) => x.id !== id); }),
        move: (id, dir) => commit("Reorder catalogue", (d) => { const i = d.catalogue.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= d.catalogue.length) return; [d.catalogue[i], d.catalogue[j]] = [d.catalogue[j], d.catalogue[i]]; }),
      },
    };
  }, [s, pageId, commit, patchUi, toast, user]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
