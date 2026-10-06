import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ExternalLink } from "lucide-react";
import { PageHeader, Pill, formatDate } from "@/components/ui";
import { requireTeacher } from "@/lib/auth";
import { curriculumClasses, curriculumTree, getCurriculum, type CurriculumTreeNode } from "@/lib/lehrplan";

export const metadata = { title: "Lehrplan" };

const countAll = (n: CurriculumTreeNode): number => n.children.reduce((a, c) => a + 1 + countAll(c), 0);
const skillsIn = (n: CurriculumTreeNode, into = new Set<string>()): Set<string> => {
  n.skills.forEach((s) => into.add(s.id));
  n.children.forEach((c) => skillsIn(c, into));
  return into;
};
/** Long names are shortened with "…" in the package; the full wording is in text. */
/** Name and text often differ only by the closing punctuation of the source. */
const same = (a: string, b: string) => a.replace(/[\s.;:,…]+$/, "") === b.replace(/[\s.;:,…]+$/, "");
const fullName = (n: CurriculumTreeNode) => (n.name.endsWith("…") && n.text ? n.text : n.name);

/** Mehr › Lehrplan › one curriculum: the official wording per class, with the skills that practise it. */
export default async function CurriculumTreePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ klasse?: string }> }) {
  await requireTeacher();
  const { key } = await params;
  const sp = await searchParams;
  const c = getCurriculum(key);
  if (!c) notFound();
  const classes = curriculumClasses(c.id);
  const klasse = sp.klasse === "alle" ? null : (classes.find((k) => String(k.klasse) === sp.klasse)?.klasse ?? classes[0]?.klasse ?? null);
  const roots = curriculumTree(c.id, klasse);
  const all = curriculumTree(c.id);
  const total = all.reduce((a, r) => a + 1 + countAll(r), 0);
  const linked = all.reduce((set, r) => skillsIn(r, set), new Set<string>()).size;
  const levels = roots.flatMap((r) => (r.kind === "klasse" ? [r] : r.children.length ? r.children : [r]));

  return (
    <>
      <PageHeader title={c.name} back={{ href: "/mehr/lehrplan", label: "Lehrplan" }} />
      <div className="-mt-4 mb-6 flex max-w-[920px] flex-wrap items-center gap-1.5">
        <Pill>{c.version}</Pill>
        {c.valid_from && <Pill>in Kraft seit {formatDate(c.valid_from, { day: "numeric", month: "short", year: "numeric" })}</Pill>}
        <Pill>
          <span className="num">{total}</span> Einträge
        </Pill>
        <Pill tone={linked ? "accent" : "neutral"}>
          <span className="num">{linked}</span> Fähigkeiten verknüpft
        </Pill>
        {c.source?.url && (
          <a href={c.source.url} target="_blank" rel="noreferrer" className="link ml-1 inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium">
            Originaltext im RIS <ExternalLink size={13} aria-hidden />
          </a>
        )}
      </div>

      {classes.length > 1 && (
        <nav className="no-print mb-8 flex max-w-full gap-1.5 overflow-x-auto pb-1" aria-label="Klasse">
          {[...classes.map((k) => [String(k.klasse), k.name] as const), ["alle", "Alle"] as const].map(([value, label]) => {
            const active = value === "alle" ? klasse === null : String(klasse) === value;
            return (
              <Link
                key={value}
                href={`/mehr/lehrplan/${encodeURIComponent(c.key)}?klasse=${value}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[14px] font-medium whitespace-nowrap ${active ? "bg-ink text-surface" : "bg-panel text-ink-2 hover:text-ink"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="grid max-w-[920px] gap-10">
        {levels.map((level) => (
          <section key={level.id} aria-label={level.name}>
            {level.kind === "klasse" && (
              <>
                <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{level.name}</h2>
                {level.text && <p className="mt-1 text-[14px] text-ink-2">{level.text}</p>}
              </>
            )}
            <div className="mt-3 grid gap-2">
              {level.children.map((n) => (n.children.length ? <Group key={n.id} node={n} top /> : <Entry key={n.id} node={n} boxed />))}
            </div>
          </section>
        ))}
        {levels.length === 0 && <p className="text-[14px] text-ink-3">Keine Einträge.</p>}
      </div>
    </>
  );
}

function Group({ node, top = false }: { node: CurriculumTreeNode; top?: boolean }) {
  const skills = skillsIn(node).size;
  const title = fullName(node);
  const intro = node.text && !same(node.text, title) ? node.text : "";
  const leaves = node.children.filter((c) => !c.children.length);
  return (
    <details className={`group/lp ${top ? "panel" : "border-l-2 border-line pl-3"}`} open={!top || undefined}>
      <summary className={`flex min-h-[44px] cursor-pointer list-none items-center gap-2 ${top ? "px-4 py-2" : "py-1"} [&::-webkit-details-marker]:hidden`}>
        <ChevronDown size={16} aria-hidden className="shrink-0 text-ink-3 transition-transform group-open/lp:rotate-180" />
        <span className={`min-w-0 flex-1 ${top ? "font-semibold" : "text-[14.5px] font-medium"}`}>{title}</span>
        {top && (
          <span className="num shrink-0 text-[12.5px] text-ink-3">
            {countAll(node)}
            {skills > 0 && <span className="text-accent"> · {skills} Fähigk.</span>}
          </span>
        )}
      </summary>
      <div className={`grid gap-2 ${top ? "px-4 pb-4" : "pb-2"}`}>
        {intro && <p className="text-[13.5px] text-ink-2">{intro}</p>}
        <SkillChips node={node} />
        {leaves.length > 0 && (
          <ul className="grid gap-1.5">
            {leaves.map((c) => (
              <Entry key={c.id} node={c} />
            ))}
          </ul>
        )}
        {node.children
          .filter((c) => c.children.length)
          .map((c) => (
            <Group key={c.id} node={c} />
          ))}
      </div>
    </details>
  );
}

function Entry({ node, boxed = false }: { node: CurriculumTreeNode; boxed?: boolean }) {
  const label = node.text && !same(node.text, node.name) && !node.name.endsWith("…") ? node.name : "";
  const body = node.text || node.name;
  const Tag = boxed ? "div" : "li";
  return (
    <Tag className={`text-[14px] leading-relaxed ${boxed ? "panel px-4 py-3" : "flex gap-2"}`}>
      {!boxed && (
        <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-ink-3" />
      )}
      <span className="min-w-0">
        {label && <span className="font-medium">{label}: </span>}
        {body}
        <SkillChips node={node} />
      </span>
    </Tag>
  );
}

function SkillChips({ node }: { node: CurriculumTreeNode }) {
  if (!node.skills.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {node.skills.map((s) => (
        <Link key={s.id} href={`/uebungen/neu?skill=${encodeURIComponent(s.id)}`} title="Übung zu dieser Fähigkeit erstellen" className="rounded-full bg-accent-wash px-2.5 py-0.5 text-[12.5px] font-medium text-accent hover:underline">
          {s.name}
        </Link>
      ))}
    </span>
  );
}
