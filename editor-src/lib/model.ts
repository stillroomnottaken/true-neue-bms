// Structured page model: Page → Sections → (Containers →) Elements.
// Plain serialisable data only. No HTML or script is ever stored as content.

export type Lang = "en" | "id";
export type Loc = { en: string; id: string };

export interface Style {
  // text
  font?: "default" | "serif" | "sans" | "mono";
  size?: number; // px
  weight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number; // px
  maxWidth?: number; // px
  // box
  width?: number; // % of parent
  height?: number; // px
  aspect?: "auto" | "1/1" | "4/3" | "16/9" | "3/2";
  fit?: "cover" | "contain" | "fill";
  position?: string; // object-position
  radius?: number;
  self?: "left" | "center" | "right"; // alignment of the element in its parent
  gap?: number;
  layout?: "stack" | "row" | "grid";
  columns?: number;
}

interface Base { id: string; visible: boolean; name?: string; style: Style; only?: Lang }
export type Heading = Base & { type: "heading"; level: 1 | 2 | 3; text: Loc };
export type ParagraphVariant = "lead" | "muted" | "note";
export type Paragraph = Base & { type: "paragraph" | "richtext" | "eyebrow"; text: Loc; variant?: ParagraphVariant };
export type ImageEl = Base & { type: "image"; src: string; alt: Loc };
export type ButtonEl = Base & { type: "button"; label: Loc; href: string; hrefId?: string; variant: "forest" | "gold" | "maize" | "line"; size: "sm" | "md" | "lg" };
export type LinkEl = Base & { type: "link"; label: Loc; href: string; hrefId?: string };
export type DividerEl = Base & { type: "divider" };
export type SpacerEl = Base & { type: "spacer" };
export type FactsEl = Base & { type: "facts"; rows: { id: string; label: Loc; value: Loc; soon?: boolean }[] };
export type CardEl = Base & { type: "card"; variant: "image" | "step"; title: Loc; text: Loc; src: string };
export type GraphicEl = Base & { type: "graphic"; kind: "net" | "flow" };
export type ContainerVariant = "card" | "channels" | "channel" | "steps" | "chips" | "crumbs" | "pair";
export type ContainerEl = Base & { type: "container"; children: Node[]; variant?: ContainerVariant };
export type Node = Heading | Paragraph | ImageEl | ButtonEl | LinkEl | DividerEl | SpacerEl | FactsEl | CardEl | GraphicEl | ContainerEl;
export type NodeType = Node["type"];

export type SectionKind = "hero" | "band" | "content" | "catalogue" | "cta" | "contact" | "form";
export type SectionVariant = "head-maize" | "head-gold" | "head-moss" | "head-forest" | "ribbon-maize" | "ribbon-gold" | "ribbon-moss" | "ribbon-noir" | "alt";
export interface SectionStyle {
  bg?: string; bgImage?: string; tone?: "dark" | "light";
  contentWidth?: number; layout: "stack" | "columns" | "grid"; columns: number;
  padTop: number; padBottom: number; marginTop: number; marginBottom: number;
  gap: number; align: "left" | "center" | "right" | "stretch"; minHeight?: number;
}
export interface Section { id: string; kind: SectionKind; name: string; visible: boolean; style: SectionStyle; children: Node[]; variant?: SectionVariant; only?: Lang; href?: string; hrefId?: string; form?: "buyer" | "supplier"; formTitle?: Loc; formHint?: Loc }
export interface Page { id: string; name: Loc; slug: Loc; title?: Loc; desc?: Loc; inBar?: boolean; inMenu?: boolean; sections: Section[] }

export interface CatalogueItem {
  id: string; slug: string; name: Loc; desc: Loc; cat: "agri" | "bio" | "industrial"; image: string; visible: boolean; detail?: boolean;
  /** further explanation (shown on its own page); an entry that has one gets an underlined, clickable name */
  info?: Loc; underline?: string;
}
export interface Design {
  primary: string; secondary: string; background: string; font: "default" | "serif" | "sans" | "mono";
  h1: number; body: number; buttonStyle: "solid" | "outline"; buttonRadius: number; sectionSpacing: number; contentWidth: number;
}
export interface MediaItem { id: string; name: string; src: string; origin: "sample" | "project" | "upload" }
export interface Redirect { id: string; from: string; to: string; code: 301 | 302 }
export interface EditorData { pages: Page[]; catalogue: CatalogueItem[]; design: Design; redirects: Redirect[] }

export const CATS: Record<CatalogueItem["cat"], Loc> = {
  agri: { en: "Agricultural commodities", id: "Komoditas pertanian" },
  bio: { en: "Bio-based materials", id: "Bahan berbasis hayati" },
  industrial: { en: "Industrial", id: "Industri" },
};

let counter = 0;
export const uid = (p = "n") => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const isContainer = (n: Node): n is ContainerEl => n.type === "container";
export const isTextual = (n: Node): n is Heading | Paragraph => n.type === "heading" || n.type === "paragraph" || n.type === "richtext" || n.type === "eyebrow";

/** Walk every node (depth first) with its parent children array. */
export function walk(children: Node[], fn: (n: Node, siblings: Node[], index: number) => boolean | void): boolean {
  for (let i = 0; i < children.length; i++) {
    const n = children[i];
    if (fn(n, children, i) === true) return true;
    if (isContainer(n) && walk(n.children, fn)) return true;
  }
  return false;
}

export interface Located { section: Section; node?: Node; siblings?: Node[]; index?: number; parent?: ContainerEl }
export function locate(page: Page, id: string | null): Located | null {
  if (!id) return null;
  for (const section of page.sections) {
    if (section.id === id) return { section };
    let found: Located | null = null;
    const visit = (children: Node[], parent?: ContainerEl) => {
      for (let i = 0; i < children.length; i++) {
        const n = children[i];
        if (n.id === id) { found = { section, node: n, siblings: children, index: i, parent }; return true; }
        if (isContainer(n) && visit(n.children, n)) return true;
      }
      return false;
    };
    if (visit(section.children)) return found;
  }
  return null;
}

export function containsId(n: Node | Section, id: string): boolean {
  if (n.id === id) return true;
  return hasChildren(n) ? n.children.some((c) => containsId(c, id)) : false;
}
function hasChildren(n: Node | Section): n is ContainerEl | Section { return "children" in n; }

/** Deep clone with fresh ids (used by duplicate and by templates). */
export function cloneFresh<T extends Node | Section>(item: T): T {
  const c = structuredClone(item) as T;
  const re = (x: Node | Section) => {
    x.id = uid(x.id.split("_")[0] || "n");
    if ("rows" in x) x.rows.forEach((r) => (r.id = uid("r")));
    if (hasChildren(x)) x.children.forEach(re);
  };
  re(c);
  return c;
}

export function textOf(n: Node, lang: Lang): string {
  switch (n.type) {
    case "heading": case "paragraph": case "richtext": case "eyebrow": return n.text[lang];
    case "button": case "link": return n.label[lang];
    case "card": return n.title[lang];
    case "image": return n.alt[lang] || "Image";
    default: return n.type;
  }
}
export const nodeLabel = (n: Node, lang: Lang) => n.name || { heading: "Heading", paragraph: "Paragraph", richtext: "Rich text", eyebrow: "Eyebrow", image: "Image", button: "Button", link: "Link", divider: "Divider", spacer: "Spacer", facts: "Facts list", card: "Card", graphic: "Graphic", container: "Container" }[n.type] + (isTextual(n) || n.type === "button" || n.type === "link" || n.type === "card" ? ` · ${textOf(n, lang).slice(0, 22)}` : "");

export function countSections(d: EditorData) { return d.pages.reduce((a, p) => a + p.sections.length, 0); }
/** Link target as the live site resolves it: "@page?query", "@whatsapp?text=…", "@email?subject=…" or a plain URL. */
export const resolveHref = (href: string, d: EditorData, lang: Lang): string => {
  if (href.startsWith("@")) {
    const [key, qs] = href.slice(1).split("?");
    const q = qs ? `?${qs}` : "";
    if (key === "whatsapp") return `https://wa.me/${SITE_FACTS.whatsapp}${q}`;
    if (key === "email") return `mailto:${SITE_FACTS.email}${q}`;
    const p = d.pages.find((x) => x.id === key);
    if (!p) return "#";
    const slug = p.slug[lang];
    const base = lang === "en" ? (slug ? `/${slug}` : "/") : (slug ? `/id/${slug}` : "/id/");
    return `${base}${q}`;
  }
  return href || "#";
};
/** href for a button/link/section, honouring the Indonesian override */
/** Which page (and language) lives at a site address like "/about" or "/id/kontak"; null if none. */
export const pageForUrl = (d: EditorData, url: string): { page: Page; lang: Lang } | null => {
  const path = url.split("?")[0].split("#")[0];
  for (const p of d.pages) for (const l of ["en", "id"] as Lang[]) if (resolveHref(`@${p.id}`, d, l).split("?")[0] === path) return { page: p, lang: l };
  return null;
};
/** Where a catalogue name links to on the live site (own page, generated explanation page, or nothing) */
export const materialLink = (d: EditorData, m: CatalogueItem, lang: Lang): string | null => {
  if (m.detail && d.pages.some((p) => p.id === m.slug)) return resolveHref(`@${m.slug}`, d, lang);
  if ((m.info?.en ?? "").trim() || (m.info?.id ?? "").trim()) return `${lang === "en" ? "" : "/id"}/material/${m.slug}`;
  return null;
};
export const hrefFor = (n: { href?: string; hrefId?: string }, lang: Lang) => (lang === "id" && n.hrefId ? n.hrefId : n.href ?? "");
export const SITE_FACTS = { whatsapp: "6281289090842", email: "contact.ptbms@gmail.com", nib: "0807240054536" };
/** {count} {nib} {email} {wa} {year} in editable text */
export const tok = (s: string, d: EditorData) => (s.includes("{") ? s.replace(/\{count\}/g, String(d.catalogue.filter((m) => m.visible).length)).replace(/\{nib\}/g, SITE_FACTS.nib).replace(/\{email\}/g, SITE_FACTS.email).replace(/\{wa\}/g, SITE_FACTS.whatsapp).replace(/\{year\}/g, String(new Date().getFullYear())) : s);
