import { normalizeDoc, type Block, type TextDoc } from "@/lib/text-doc";

const CONTAINERS = new Set(["UL", "OL", "TABLE", "TBODY", "THEAD", "TR", "SECTION", "ARTICLE"]);
const BLOCKS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE", "TD", "TH"]);

type Marks = { b: boolean; i: boolean; u: boolean };

function marksOf(el: HTMLElement, m: Marks): Marks {
  const tag = el.tagName;
  let { b, i, u } = m;
  if (tag === "B" || tag === "STRONG") b = true;
  if (tag === "I" || tag === "EM") i = true;
  if (tag === "U" || tag === "INS") u = true;
  // Safari sometimes writes marks as inline styles, also to switch them off
  const st = el.style;
  if (st.fontWeight) b = st.fontWeight === "bold" || Number(st.fontWeight) >= 600;
  if (st.fontStyle) i = st.fontStyle === "italic";
  const deco = st.textDecorationLine || st.textDecoration;
  if (deco) u = deco.includes("underline");
  return { b, i, u };
}

/** Reads the editor's DOM into a document: paragraphs, headings, bold/italic/underline and line breaks. */
export function readDom(root: HTMLElement): TextDoc {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const open = (t: Block["t"]) => {
    cur = { t, r: [] };
    blocks.push(cur);
    return cur;
  };
  const close = () => {
    // the browser keeps a <br> at the end of a block so it stays visible: it is no line of its own
    const last = cur?.r.at(-1);
    if (last && last.x.endsWith("\n")) last.x = last.x.slice(0, -1);
    cur = null;
  };
  const walk = (node: Node, m: Marks) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const x = (child.textContent ?? "").replace(/ /g, " ");
        if (x) (cur ?? open("p")).r.push({ x, ...(m.b ? { b: 1 } : {}), ...(m.i ? { i: 1 } : {}), ...(m.u ? { u: 1 } : {}) });
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (tag === "BR") {
        (cur ?? open("p")).r.push({ x: "\n" });
        continue;
      }
      if (CONTAINERS.has(tag)) {
        close();
        walk(el, m);
        close();
        continue;
      }
      if (BLOCKS.has(tag)) {
        close();
        open(/^H[1-6]$/.test(tag) ? "h" : "p");
        walk(el, marksOf(el, m));
        close();
        continue;
      }
      walk(el, marksOf(el, m));
    }
  };
  walk(root, { b: false, i: false, u: false });
  close();
  return normalizeDoc(blocks);
}
