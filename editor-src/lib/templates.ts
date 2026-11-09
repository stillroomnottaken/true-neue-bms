import { uid, type Loc, type Node, type NodeType, type Section, type SectionKind, type SectionStyle } from "./model";

const L = (en: string, id: string): Loc => ({ en, id });
const b = (style = {}) => ({ id: uid("n"), visible: true, style });

export const NODE_TEMPLATES: { type: NodeType | "twocol"; label: string; hint: string; make: () => Node }[] = [
  { type: "heading", label: "Heading", hint: "Title text", make: () => ({ ...b(), type: "heading", level: 2, text: L("New heading", "Judul baru") }) },
  { type: "paragraph", label: "Paragraph", hint: "Body text", make: () => ({ ...b(), type: "paragraph", text: L("Write something here.", "Tulis sesuatu di sini.") }) },
  { type: "richtext", label: "Rich text", hint: "Multi-line text", make: () => ({ ...b(), type: "richtext", text: L("First line.\nSecond line.", "Baris pertama.\nBaris kedua.") }) },
  { type: "image", label: "Image", hint: "Pick from media", make: () => ({ ...b({ aspect: "16/9", fit: "cover" }), type: "image", src: "", alt: L("Image", "Gambar") }) },
  { type: "button", label: "Button", hint: "Label + link", make: () => ({ ...b(), type: "button", label: L("Button", "Tombol"), href: "@contact", variant: "forest", size: "md" }) },
  { type: "link", label: "Link", hint: "Text link", make: () => ({ ...b(), type: "link", label: L("Learn more →", "Selengkapnya →"), href: "@about" }) },
  { type: "divider", label: "Divider", hint: "Horizontal line", make: () => ({ ...b(), type: "divider" }) },
  { type: "spacer", label: "Spacer", hint: "Vertical space", make: () => ({ ...b({ height: 32 }), type: "spacer" }) },
  { type: "container", label: "Container", hint: "Group elements", make: () => ({ ...b({ layout: "stack", gap: 12 }), type: "container", children: [] }) },
  { type: "twocol", label: "Two columns", hint: "Nested 2-col grid", make: () => ({ ...b({ layout: "grid", columns: 2, gap: 20 }), type: "container", children: [
    { ...b({ layout: "stack", gap: 10 }), type: "container", children: [{ ...b(), type: "heading", level: 3, text: L("Left column", "Kolom kiri") }, { ...b(), type: "paragraph", text: L("Text for the left column.", "Teks untuk kolom kiri.") }] },
    { ...b({ layout: "stack", gap: 10 }), type: "container", children: [{ ...b(), type: "heading", level: 3, text: L("Right column", "Kolom kanan") }, { ...b(), type: "paragraph", text: L("Text for the right column.", "Teks untuk kolom kanan.") }] },
  ] }) },
];

const sec = (kind: SectionKind, name: string, style: Partial<SectionStyle>, children: Node[]): Section => ({
  id: uid("s"), kind, name, visible: true, children,
  style: { layout: "stack", columns: 1, padTop: 56, padBottom: 56, marginTop: 0, marginBottom: 0, gap: 16, align: "left", ...style },
});
const T = (type: "heading" | "paragraph" | "eyebrow", en: string, id: string, extra = {}, level: 1 | 2 | 3 = 2): Node =>
  (type === "heading" ? { ...b(extra), type, level, text: L(en, id) } : { ...b(extra), type, text: L(en, id) }) as Node;
const BTN = (en: string, id: string, variant: "forest" | "gold" | "maize" | "line" = "forest", size: "sm" | "md" | "lg" = "lg"): Node => ({ ...b(), type: "button", label: L(en, id), href: "@contact", variant, size });
const IMG = (): Node => ({ ...b({ aspect: "4/3", fit: "cover" }), type: "image", src: "", alt: L("Image", "Gambar") });

export const SECTION_TEMPLATES: { label: string; hint: string; make: () => Section }[] = [
  { label: "Hero", hint: "Headline, text, button", make: () => sec("hero", "Hero", { layout: "columns", columns: 2, gap: 32, padTop: 52, padBottom: 48, bg: "var(--paper)" }, [
    { ...b({ layout: "stack", gap: 12 }), type: "container", children: [T("eyebrow", "New hero", "Hero baru"), T("heading", "A clear headline goes here", "Judul yang jelas ada di sini", {}, 1), T("paragraph", "Support it with one or two sentences.", "Dukung dengan satu atau dua kalimat.", { size: 18 }), BTN("CONTACT US", "HUBUNGI KAMI", "gold")] },
    IMG(),
  ]) },
  { label: "Image & text", hint: "Two columns", make: () => sec("content", "Image and text", { layout: "columns", columns: 2, gap: 40 }, [
    IMG(), { ...b({ layout: "stack", gap: 12 }), type: "container", children: [T("heading", "Section title", "Judul bagian"), T("paragraph", "Describe this part of the business in your own words.", "Jelaskan bagian bisnis ini dengan kata-kata Anda."), BTN("Learn more", "Selengkapnya", "line", "sm")] },
  ]) },
  { label: "Two-column section", hint: "Text beside text", make: () => sec("content", "Two columns", { layout: "columns", columns: 2, gap: 40, align: "left" }, [
    { ...b({ layout: "stack", gap: 10 }), type: "container", children: [T("heading", "Left title", "Judul kiri"), T("paragraph", "Left text.", "Teks kiri.")] },
    { ...b({ layout: "stack", gap: 10 }), type: "container", children: [T("heading", "Right title", "Judul kanan"), T("paragraph", "Right text.", "Teks kanan.")] },
  ]) },
  { label: "Grid section", hint: "3 cards", make: () => sec("content", "Grid", { layout: "grid", columns: 3, gap: 16 },
    [1, 2, 3].map((i): Node => ({ ...b(), type: "card", variant: "image", title: L(`Card ${i}`, `Kartu ${i}`), text: L("", ""), src: "" }))) },
  { label: "Catalogue grid", hint: "Live catalogue entries", make: () => sec("catalogue", "Catalogue grid", { columns: 3 }, []) },
  { label: "Call to action", hint: "Dark strip + button", make: () => sec("cta", "Call to action", { bg: "var(--forest)", layout: "columns", columns: 2, gap: 40, padTop: 52, padBottom: 52 }, [
    { ...b({ layout: "stack", gap: 6 }), type: "container", children: [T("heading", "Ready to talk?", "Siap berbincang?", { size: 32 }), T("paragraph", "One short line that invites the next step.", "Satu kalimat singkat yang mengajak ke langkah berikutnya.")] },
    BTN("CONTACT US", "HUBUNGI KAMI", "maize"),
  ]) },
  { label: "Page header", hint: "Coloured title band", make: () => ({ ...sec("band", "Page header", { padTop: 40, padBottom: 40, gap: 0 }, [
    T("eyebrow", "Section label", "Label bagian"), T("heading", "Page title", "Judul halaman", {}, 1), { ...T("paragraph", "One line that explains the page.", "Satu kalimat yang menjelaskan halaman."), variant: "lead" } as Node,
  ]), variant: "head-maize" }) },
  { label: "Ribbon link", hint: "Clickable banner row", make: () => ({ ...sec("band", "Ribbon", { padTop: 32, padBottom: 32, layout: "columns", columns: 2, gap: 28 }, [
    T("eyebrow", "Tag", "Tag"), { ...b({ layout: "stack", gap: 0 }), type: "container", children: [T("heading", "A short headline", "Judul singkat"), T("paragraph", "One line of support.", "Satu kalimat pendukung.")] } as Node,
  ]), variant: "ribbon-maize", href: "@catalogue" }) },
  { label: "Enquiry form", hint: "Buyer / supplier form", make: () => ({ ...sec("form", "Enquiry form", { layout: "columns", columns: 2, gap: 32 }, [
    T("heading", "Prefer to talk?", "Lebih suka bicara langsung?"), T("paragraph", "Message the team directly.", "Kirim pesan langsung ke tim."),
  ]), form: "buyer", formTitle: L("Send an enquiry", "Kirim permintaan"), formHint: L("", "") }) },
  { label: "Blank section", hint: "Empty, then add elements", make: () => sec("content", "Blank section", {}, []) },
];
