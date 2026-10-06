#!/usr/bin/env python3
"""
Converts the official RIS Lehrplan texts (Volksschule, Mittelschule, AHS, HTL) into
"lernheft-curriculum/1" packages in curriculum/. Only the Fachlehrpläne Deutsch, Englisch
(Lebende Fremdsprache) and Mathematik are taken over.

The wording stays as in RIS. Cleaned are only: page headers, line breaks, footnote numbers
(references to the übergreifende Themen, e.g. "interpretieren;10") and fractions that the
text export split onto several lines ("6\n10" -> "6/10"). Formulas from the PDF text can still
look broken; the RIS link of every package leads to the original.

Usage (input: RIS "Text"-export of each Anlage, HTL as `pdftotext -layout`):
  python3 scripts/lehrplan_import.py --vs vs.txt --ms ms.txt --ahs ahs.txt --htl htl-layout.txt
"""
import argparse
import collections
import json
import math
import os
import re
import sys

DASH = "– "
STEM = "Die Schülerinnen und Schüler können"
HEADER = re.compile(r"^(Bundesrecht konsolidiert|www\.ris\.bka\.gv\.at.*|Seite \d+ von \d+)$")
FRACTION_PART = r"(?:\d+|[\U0001D400-\U0001D7FF]+)"  # digits or math italic letters alone on a line
CONJ = {"und", "oder", "bzw", "bzw.", "sowie", "als", "bis"}
ABBREV = re.compile(r"(\bd\. ?h\.|\bdh\.|\bzB\.|\bz\. ?B\.|\bbzw\.|\busw\.|\bua\.|\bvgl\.|\betc\.|\bNr\.)$")


# ---------------------------------------------------------------- text cleaning

def footnotes(s: str) -> str:
    """Removes the footnote numbers 1-13 RIS puts behind words and punctuation."""
    s = re.sub(r"(?<=[a-zäöüß]{3})\d{1,2}(?=[a-zäöüß]{2})", " ", s)  # "Sprache5aufgefasst"
    s = re.sub(r"(?<=[a-zäöüß]{3})\d{1,2}(?:,\s?\d{1,2})*(?=[\s;:,.)]|$)", "", s)  # "Darstellungen6,"
    # "interpretieren;10", "Sprachvergleiche).5, 7"; only after a word, never inside formulas ("2,5", "4); 5 −")
    s = re.sub(r"(?<=[a-zäöüß])(\)[.;:,]?|[.;:,])\s?\d{1,2}(?:,\s?\d{1,2})*(?=\s|$)", r"\1", s)
    return s


def join(lines: list[str]) -> str:
    """Joins wrapped lines; two lines that are only digits are a fraction."""
    parts: list[str] = []
    i = 0
    while i < len(lines):
        a = lines[i].strip()
        if re.fullmatch(FRACTION_PART, a) and i + 1 < len(lines) and re.fullmatch(FRACTION_PART, lines[i + 1].strip()):
            parts.append(f"{a}/{lines[i + 1].strip()}")
            i += 2
            continue
        tail = re.search(r"\s(" + FRACTION_PART + r")$", a)
        if tail and i + 2 < len(lines) and re.fullmatch(FRACTION_PART, lines[i + 1].strip()) and lines[i + 2].strip().startswith("="):
            parts.append(f"{a}/{lines[i + 1].strip()}")  # "… von 𝑎" + "𝑏" + "=" is the fraction 𝑎/𝑏
            i += 2
            continue
        parts.append(a)
        i += 1
    out = ""
    for p in parts:
        if not out:
            out = p
        elif out.endswith("-") and p[:1].islower() and p.split(" ")[0] not in CONJ:
            out += p  # word split by a hyphen at the line end
        else:
            out += " " + p
    out = footnotes(out)
    out = re.sub(r"(?<=[\s(])á(?=[\s),])", "α", out)  # the RIS text export turns α into á
    out = re.sub(r"\s+([;,.)])", r"\1", out)
    out = re.sub(r"\(\s+", "(", out)
    out = re.sub(r"\s{2,}", " ", out)
    return out.strip()


def strip_end(s: str) -> str:
    return re.sub(r"[;,.]$", "", s.strip()).strip()


def short_name(text: str, limit: int = 90) -> str:
    """Name for the tree: the wording itself, shortened at a word boundary when long."""
    t = strip_end(text)
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(",;:") + " …"


def norm(s: str) -> str:
    return re.sub(r"[^a-zäöüß0-9]+", "", footnotes(s).lower())


def words(s: str) -> set[str]:
    return set(re.findall(r"[a-zäöüß]{3,}", footnotes(s).lower()))


def read(path: str, start: int, end: int, heading: str) -> list[str]:
    """Lines [start, end) of a RIS text export (1-based), without page headers."""
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n").replace("\r", "") for l in f]
    first = lines[start - 1].strip()
    assert first.startswith(heading), f"{path}:{start}: erwartet „{heading}“, gefunden „{first}“"
    out = []
    for l in lines[start:end - 1]:
        if not l.strip() or HEADER.match(l.strip()):
            continue
        out.append(l)
    return out


# ---------------------------------------------------------------- package builder

class Builder:
    def __init__(self, prefix: str, subject_name: str, offset: int, grade_word: str):
        self.prefix = prefix
        self.offset = offset
        self.grade_word = grade_word
        self.nodes: list[dict] = []
        self.by_code: dict[str, dict] = {}
        self.counters: dict[str, int] = {}
        self.add(None, prefix, "fach", subject_name)

    def add(self, parent: str | None, code: str, kind: str, name: str, text: str = "", **extra) -> str:
        assert code not in self.by_code, f"Code doppelt: {code}"
        n = {"code": code, "kind": kind, "name": name}
        if parent:
            n["parent"] = parent
        if text:
            n["text"] = text
        for k, v in extra.items():
            if v not in (None, ""):
                n[k] = v
        self.nodes.append(n)
        self.by_code[code] = n
        return code

    def child(self, parent: str, letter: str, kind: str, name: str, text: str = "", **extra) -> str:
        key = f"{parent}|{letter}"
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.add(parent, f"{parent}-{letter}{self.counters[key]}", kind, name, text, **extra)

    def grade(self, klasse: int, label: str | None = None) -> str:
        code = f"{self.prefix}-{klasse}"
        if code not in self.by_code:
            self.add(self.prefix, code, "klasse", label or f"{klasse}. {self.grade_word}", klasse=klasse, schulstufe=self.offset + klasse)
        return code

    def append_text(self, code: str, text: str):
        n = self.by_code[code]
        n["text"] = (n.get("text", "") + "\n\n" + text).strip() if text else n.get("text", "")


# ---------------------------------------------------------------- RIS text parser (VS, MS, AHS)

GRADE = re.compile(r"^(\d)\.(Klasse|Schulstufe)(?:\((?:\d\.und\d\.)?Semester\))?(?:–Kompetenzmodul(\d))?:?$")
SEMESTER = re.compile(r"^(\d)\.Semester(?:–Kompetenzmodul(\d))?:?$")
KB = re.compile(r"^(Integrativer )?Kompetenzbereich(?: (\d):)? (.+)$")
LABELLED = re.compile(r"^([A-ZÄÖÜ][^:–]{2,70}):\s(.+)$")


def compact(s: str) -> str:
    return re.sub(r"\s+", "", s)


def parse_ris(lines: list[str], b: Builder, *, start_marker: str, anwendung: str = "bereich", precision_marker: str | None = None, labelled: bool = False) -> Builder:
    """
    State machine over one Fachlehrplan. Recognises grade lines ("1 . K l a s s e :"), semester
    lines, "Kompetenzbereich …", the stem "Die Schülerinnen und Schüler können …", dash items,
    "Anwendungsbereiche", headings directly before a list and (AHS Oberstufe Deutsch)
    paragraphs of the form "Bezeichnung: Text".
    """
    exact = [k for k, l in enumerate(lines) if l.strip() == start_marker]
    i = exact[0] if exact else next(k for k, l in enumerate(lines) if l.strip().startswith(start_marker))
    lines = lines[i + 1:]
    klasse = sem = kb = None  # codes
    kb_name = ""
    mode = None  # kompetenz | anwendung | inhalt | thema
    owner = None  # code the next dash items belong to
    item: list[str] | None = None
    item_kind = None
    stem: list[str] | None = None
    prose: list[str] = []
    precision = False
    group = None  # Anwendungsbereiche group code
    target_for_stem = None

    def container():
        return sem or klasse

    def flush_item():
        nonlocal item
        if item is None:
            return
        text = join(item)
        item = None
        if not text:
            return
        if item_kind == "labelled":
            m = LABELLED.match(text)
            b.child(owner, "T", "thema", m.group(1), m.group(2), klasse=b.by_code[klasse]["klasse"], schulstufe=b.by_code[klasse]["schulstufe"], competency_area=kb_name)
            return
        letter, kind = {"kompetenz": ("K", "kompetenz"), "anwendung": ("A", "anwendungsbereich"), "inhalt": ("I", "inhalt"), "thema": ("K", "kompetenz")}[item_kind]
        b.child(owner, letter, kind, short_name(text), text, klasse=b.by_code[klasse]["klasse"], schulstufe=b.by_code[klasse]["schulstufe"], competency_area=kb_name)

    def flush_prose(as_heading: bool):
        nonlocal prose, owner, mode, kb_name
        if not prose:
            return
        text = join(prose)
        parts = prose
        prose = []
        if as_heading and klasse:
            # "Sprechen" + "An Gesprächen teilnehmen …" are two heading levels on separate lines
            name = strip_end(text.rstrip(":")) if any(p.endswith(" ") for p in parts[:-1]) else " – ".join(strip_end(footnotes(p.strip())) for p in parts)
            parent = container() if precision else (kb or container())  # e.g. "Vorschläge für den Einsatz digitaler Technologien in der 1. Klasse"
            owner = b.child(parent, "T", "thema", name, klasse=b.by_code[klasse]["klasse"], schulstufe=b.by_code[klasse]["schulstufe"], competency_area=kb_name, content_area=name)
            mode = "inhalt" if precision else "thema"
        elif klasse:
            b.append_text(kb or group or container(), text)

    def flush_stem():
        nonlocal stem, owner, mode
        if stem is None:
            return
        text = join(stem)
        stem = None
        rest = text[len(STEM):].strip().lstrip(",").strip()
        if precision:
            # "Die Schülerinnen und Schüler können X." restates a Kompetenz of this class: details go below it
            # the wording can differ slightly ("sowie" / "und"), so the closest Kompetenz by words wins
            want = words(rest)
            scored = sorted(((len(want & words(n["text"])) / len(want | words(n["text"])), n["code"]) for n in b.nodes if n["kind"] == "kompetenz" and n.get("parent") == kb), reverse=True)
            assert scored and scored[0][0] >= 0.5 and (len(scored) == 1 or scored[1][0] < scored[0][0]), f"{b.prefix}: Präzisierung ohne eindeutige Kompetenz: {rest[:80]} {scored[:2]}"
            owner = scored[0][1]
            mode = "inhalt"
        else:
            if re.search(r"[a-zäöüß]", rest) and kb:
                b.append_text(kb, text)
            owner = kb or container()
            mode = "kompetenz"

    for idx, raw in enumerate(lines):
        line = raw.strip()
        nxt = lines[idx + 1].strip() if idx + 1 < len(lines) else ""
        c = compact(line)
        if line.startswith("1Bildungs-"):
            break  # legend of the übergreifende Themen at the end of a Fachlehrplan

        g = GRADE.match(c)
        s = SEMESTER.match(c)
        k = KB.match(line) if len(line) < 100 and not line.startswith("Kompetenzbereiche") else None
        if g or s or k or line.startswith(STEM) or c in ("Anwendungsbereiche", "Anwendungsbereiche:") or (precision_marker and line.startswith(precision_marker)):
            flush_item()
            flush_stem()
            flush_prose(False)
        if g:
            klasse = b.grade(int(g.group(1)))
            sem = kb = group = None
            kb_name = ""
            if g.group(3):
                b.append_text(klasse, f"Kompetenzmodul {g.group(3)}")
            elif "Semester" in c:
                b.append_text(klasse, "1. und 2. Semester")
            mode = owner = None
            continue
        if s:
            label = f"{s.group(1)}. Semester" + (f" – Kompetenzmodul {s.group(2)}" if s.group(2) else "")
            sem = b.child(klasse, "S", "semester", label)
            kb = group = None
            mode = owner = None
            continue
        if k:
            kb_name = k.group(3).strip()
            name = ("Integrativer Kompetenzbereich " if k.group(1) else "") + kb_name
            if precision:
                same = [n for n in b.nodes if n["kind"] == "kompetenzbereich" and n.get("parent") == container() and n["name"] == name]
                assert len(same) == 1, f"{b.prefix}: Kompetenzbereich {name} in der Präzisierung nicht gefunden"
                kb = same[0]["code"]
                group = None
                mode = owner = None
                continue
            kb = b.child(container(), "B", "kompetenzbereich", name, klasse=b.by_code[klasse]["klasse"], schulstufe=b.by_code[klasse]["schulstufe"], competency_area=kb_name)
            group = None
            mode = owner = None
            continue
        if precision_marker and line.startswith(precision_marker):
            precision = True
            klasse = sem = kb = None
            continue
        if c in ("Anwendungsbereiche", "Anwendungsbereiche:"):
            parent = kb if anwendung == "bereich" and kb else container()
            group = b.child(parent, "A", "anwendungsbereiche", "Anwendungsbereiche", klasse=b.by_code[klasse]["klasse"], schulstufe=b.by_code[klasse]["schulstufe"], competency_area=kb_name if parent == kb else "")
            owner = group
            mode = "anwendung"
            kb = None if parent != kb else kb
            continue
        if line.startswith(STEM):
            stem = [line]
            continue
        if stem is not None and not line.startswith(DASH):
            stem.append(line)
            continue
        if line.startswith(DASH):
            flush_item()
            flush_stem()
            if prose:
                flush_prose(True)
            if owner is None:
                owner = kb or container()
                mode = mode or "kompetenz"
            item = [line[len(DASH):]]
            item_kind = mode if mode in ("kompetenz", "anwendung", "inhalt", "thema") else "kompetenz"
            continue
        # labelled paragraph ("Hörverständnis: …"), AHS Oberstufe Deutsch
        if labelled and LABELLED.match(line) and (not item or not lines[idx - 1].endswith(" ")):
            flush_item()
            if prose:
                flush_prose(True)
            if owner is None:
                owner = kb or container()
            item = [line]
            item_kind = "labelled"
            continue
        # continuation or prose
        prev = lines[idx - 1] if idx else ""
        if item is not None:
            starts_low = not re.match(r"^[A-ZÄÖÜ]", line)
            open_paren = "".join(item).count("(") > "".join(item).count(")")
            after = lines[idx + 2].strip() if idx + 2 < len(lines) else ""
            heading_next = nxt.startswith(DASH) or nxt.startswith(STEM) or (labelled and bool(LABELLED.match(nxt))) or (" " not in line and len(line) < 30 and after.startswith(DASH))
            ended = bool(re.search(r"[.;:!?]$", strip_footnote_tail(prev.strip()))) and not ABBREV.search(prev.strip())
            list_goes_on = not heading_next and (strip_footnote_tail(line).endswith(";") or strip_footnote_tail(nxt).endswith(";"))
            long_paragraph = item_kind == "labelled" and (len(line) > 50 or bool(re.search(r"[;,.]", line)))  # headings there are short
            if prev.endswith(" ") or starts_low or open_paren or list_goes_on or long_paragraph or (not heading_next and not ended):
                item.append(line)
                continue
            flush_item()
        prose.append(line)
    flush_item()
    flush_stem()
    flush_prose(False)
    return b


def strip_footnote_tail(s: str) -> str:
    return re.sub(r"(?<=[.;:,)])\s?\d{1,2}(?:,\s?\d{1,2})*$", "", s)


# ---------------------------------------------------------------- HTL parser (pdftotext -layout)

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5}


def read_layout(path: str, heading: str, until: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n").replace("\r", "").replace("\f", "") for l in f]
    start = next(i for i, l in enumerate(lines) if l.strip() == heading and i > 1000)
    end = next(i for i, l in enumerate(lines) if i > start and l.strip() == until)
    out = []
    for l in lines[start + 1:end]:
        t = l.strip()
        if not t or HEADER.match(re.sub(r"\s+", " ", t)) or re.match(r"^www\.ris\.bka\.gv\.at\s+Seite", t):
            continue
        out.append(re.sub(r"(?<=\S) {2,}", " ", l.rstrip()))
    return out


def parse_htl(lines: list[str], b: Builder, paragraphs: bool = False) -> Builder:
    """Jahrgang → (Semester) → Bildungs- und Lehraufgabe (Bereich → Kompetenzen) → Lehrstoff (Thema: Inhalt)."""
    klasse = sem = None
    bereich = None
    bereich_name = ""
    mode = None
    closed = False
    item: list[str] | None = None
    topic: tuple[str, list[str]] | None = None
    lehrstoff = None

    def cont():
        return sem or klasse

    def meta():
        n = b.by_code[klasse]
        return {"klasse": n["klasse"], "schulstufe": n["schulstufe"]}

    def flush():
        nonlocal item, topic
        if item:
            text = join(item)
            b.child(bereich or cont(), "K", "kompetenz", short_name(text), text, competency_area=bereich_name, **meta())
        item = None
        if topic:
            name, body = topic
            if body:
                text = "\n".join(join([p]) for p in body) if paragraphs else join(body)  # one paragraph per line where the source has them
                b.child(lehrstoff, "L", "lehrstoff", name, text, content_area=name, **meta())
            else:
                b.append_text(lehrstoff, name + ":")  # an introduction such as "Festigung aller Fertigkeiten in folgenden Bereichen:"
        topic = None

    for raw in lines:
        t = raw.strip()
        indent = len(raw) - len(raw.lstrip())
        m = re.match(r"^([IV]+)\. Jahrgang\s*(?:\((.+?)\s*\))?\s*(?:–\s*Kompetenzmodul (\d+))?:$", t)
        if m:
            flush()
            klasse = b.grade(ROMAN[m.group(1)], f"{m.group(1)}. Jahrgang")
            closed = False
            sem = bereich = lehrstoff = None
            bereich_name = ""
            if m.group(2):
                b.append_text(klasse, re.sub(r"S\s+emester", "Semester", m.group(2)))
            if m.group(3):
                b.append_text(klasse, f"Kompetenzmodul {m.group(3)}")
            mode = None
            continue
        if t == "Schularbeiten:":
            flush()
            mode = None
            closed = True  # until the next Jahrgang or Semester
            continue
        m = re.match(r"^(\d+)\. Semester(?: – Kompetenzmodul (\d+))?:$", t)
        if m:
            flush()
            sem = b.child(klasse, "S", "semester", t.rstrip(":"))
            closed = False
            bereich = lehrstoff = None
            bereich_name = ""
            mode = None
            continue
        if klasse is None or closed:
            continue
        if t == "Bildungs- und Lehraufgabe:":
            flush()
            mode = "kompetenz"
            bereich = None
            bereich_name = ""
            continue
        if t == "Lehrstoff:":
            flush()
            mode = "lehrstoff"
            lehrstoff = b.child(cont(), "L", "lehrstoffbereich", "Lehrstoff", **meta())
            continue
        if mode == "kompetenz":
            if t.startswith(STEM):
                continue
            if re.match(r"^Bereich ", t) and indent < 2:
                flush()
                bereich_name = t[len("Bereich "):].rstrip(":").removeprefix("– ")
                bereich = b.child(cont(), "B", "kompetenzbereich", bereich_name, competency_area=bereich_name, **meta())
                continue
            if t.startswith(DASH):
                flush()
                item = [t[len(DASH):]]
                continue
            if item is not None:
                item.append(t)
            continue
        if mode == "lehrstoff":
            if indent == 0 and t.endswith(":") and len(t) < 90:
                flush()
                topic = (t.rstrip(":"), [])
                continue
            if topic:
                topic[1].append(t)
            continue
    flush()
    return b


# ---------------------------------------------------------------- HAK (RIS text export with letter-spaced headings)

# The RIS PDF of the HAK sets headings letter by letter ("B e r e ic h Zu h ö r e n"). Such lines are
# put back together word by word using the words of the same document.
WORD = re.compile(r"[A-Za-zÄÖÜäöüß]+")
def is_spaced(l):
    toks = l.split()
    return len(toks) >= 4 and sum(len(t) <= 2 for t in toks) / len(toks) >= 0.6
# compounds that occur in this text only letter-spaced
EXTRA = ["folgender", "seitenverhältnisse", "umwandlungen", "wachstumsmodelle", "wahrscheinlichkeitsfunktion", "wahrscheinlichkeitsdichte", "polynom", "zentral", "korrelations", "koeffizient"]
def spaced_vocab(lines):
    c = collections.Counter({w: 1 for w in EXTRA})
    for l in lines:
        if l.strip() and not is_spaced(l):
            for w in WORD.findall(l):
                c[w.lower()] += 1
    return c
def segment_word(s, voc):
    # s: letters only (no spaces); returns list of words
    n = len(s); low = s.lower()
    best = [(0.0, -1)] + [(math.inf, -1)] * n
    for i in range(1, n + 1):
        for j in range(max(0, i - 30), i):
            w = low[j:i]
            f = voc.get(w, 0)
            if f:
                cost = 1 + 0.1 / (1 + math.log(1 + f))
            elif i - j == 1:
                cost = 6
            else:
                continue
            if best[j][0] + cost < best[i][0]:
                best[i] = (best[j][0] + cost, j)
    out, i = [], n
    while i > 0:
        j = best[i][1]; out.append(s[j:i]); i = j
    return out[::-1]
def despace(l, voc):
    t = l.replace(" ", "")
    # split into letter runs and other chars
    parts = re.findall(r"[A-Za-zÄÖÜäöüß]+|[^A-Za-zÄÖÜäöüß]", t)
    out = ""
    for p in parts:
        if WORD.fullmatch(p):
            ws = segment_word(p, voc)
            piece = " ".join(ws)
            if out and not out.endswith((" ", "(", "-", "/")):
                out += " "
            elif out.endswith("-") and ws[0].lower() in ("und", "oder", "bzw"):
                out += " "
            out += piece
        elif p.isdigit():
            out += (" " if out and out[-1].isalpha() else "") + p
        elif p in ",;:)":
            out += p
        elif p == "–":
            out = out.rstrip() + " – "
        elif p == "(":
            out += (" " if out and not out.endswith(" ") else "") + "("
        else:
            out += p
    return re.sub(r"\s+", " ", out).strip()


def read_spaced(path: str, heading: str, until: str) -> list[str]:
    with open(path, encoding="utf-8") as f:
        lines = [l.rstrip("\n").replace("\r", "").replace("\f", "") for l in f]
    voc = spaced_vocab(lines)
    start = next(i for i, l in enumerate(lines) if l.strip() == heading)
    end = next(i for i, l in enumerate(lines) if i > start and l.strip() == until)
    out: list[str] = []
    prev_spaced = wrapped = False
    for l in lines[start + 1:end]:
        t = l.strip()
        if not t or HEADER.match(re.sub(r"\s+", " ", t)) or re.match(r"^www\.ris\.bka\.gv\.at\s+Seite", t):
            continue
        if not is_spaced(t):
            if wrapped and out:
                out[-1] = join([out[-1], t]) if out[-1].endswith("-") else f"{out[-1]} {t}"  # the text export ends wrapped lines with a space
            else:
                out.append(t)
            prev_spaced = False
            wrapped = l.endswith(" ")
            continue
        wrapped = False
        d = despace(t, voc)
        last = out[-1] if out else ""
        if prev_spaced and not last.endswith((":", ",")) and not d.startswith(("Bereich", "–")) and not re.match(r"^[IV\d]+\.", d) and len(d) < 45:
            out[-1] = f"{last} {d}"  # a heading that runs over two lines
        elif prev_spaced and last.startswith("Bereich ") and not d.startswith("Bereich") and not d.endswith(":") and len(d) >= 45:
            out.append(DASH + d)  # a Kompetenz whose dash got lost with the letter spacing
        else:
            out.append(d)
        prev_spaced = True
    return out


# ---------------------------------------------------------------- packages

LICENSE = "amtliches Werk (§ 7 UrhG)"
RIS_DOC = "https://www.ris.bka.gv.at/Dokument.wxe?Abfrage=Bundesnormen&Dokumentnummer={}"

SOURCES = {
    "vs": {
        "key": "ris-vs", "name": "RIS – Lehrplan der Volksschule, Anlage A", "doc": "NOR40271469",
        "school_type": "Volksschule", "version": "BGBl. II Nr. 178/2025", "valid_from": "2025-09-01",
        "attribution_text": "BGBl. Nr. 134/1963 idF BGBl. II Nr. 178/2025", "gesetz": "10009275", "short": "VS", "grade_word": "Schulstufe", "offset": 0,
    },
    "ms": {
        "key": "ris-ms", "name": "RIS – Lehrpläne der Mittelschulen, Anlage 1", "doc": "NOR40271471",
        "school_type": "Mittelschule", "version": "BGBl. II Nr. 178/2025", "valid_from": "2025-09-01",
        "attribution_text": "BGBl. II Nr. 185/2012 idF BGBl. II Nr. 178/2025", "gesetz": "20007850", "short": "MS", "grade_word": "Klasse", "offset": 4,
    },
    "ahs": {
        "key": "ris-ahs", "name": "RIS – Lehrpläne der allgemeinbildenden höheren Schulen, Anlage A", "doc": "NOR40264238",
        "school_type": "Gymnasium", "version": "BGBl. II Nr. 204/2024", "valid_from": "2026-09-01",
        "attribution_text": "BGBl. Nr. 88/1985 idF BGBl. II Nr. 204/2024", "gesetz": "10008568", "short": "AHS", "grade_word": "Klasse", "offset": 4,
    },
    "htl": {
        "key": "ris-htl", "name": "RIS – Lehrpläne der HTL 2015, Anlage 1 (gemeinsame Unterrichtsgegenstände)", "doc": "NOR40237785",
        "school_type": "HTL", "version": "BGBl. II Nr. 383/2021", "valid_from": "2021-09-04",
        "attribution_text": "BGBl. II Nr. 262/2015 idF BGBl. II Nr. 383/2021", "gesetz": "20009288", "short": "HTL", "grade_word": "Jahrgang", "offset": 8,
    },
    "hak": {
        "key": "ris-hak", "name": "RIS – Lehrpläne Handelsakademie und Handelsschule, Anlage A1 (Handelsakademie)", "doc": "NOR40234935",
        "school_type": "HAK", "version": "BGBl. II Nr. 250/2021", "valid_from": "2021-09-01",
        "attribution_text": "BGBl. Nr. 895/1994 idF BGBl. II Nr. 250/2021", "gesetz": "10008944", "short": "HAK", "grade_word": "Jahrgang", "offset": 8,
    },
}

SUBJECT_CODE = {"Deutsch": "DEU", "Englisch": "ENG", "Mathematik": "MAT"}


def package(school: str, subject: str, title: str, b: Builder, note: str, skill_nodes: list) -> dict:
    s = SOURCES[school]
    return {
        "format": "lernheft-curriculum/1",
        "label": f"Lehrplan {s['school_type']} – {title} (RIS)",
        "description": f"Offizieller Lehrplantext aus dem RIS ({s['doc']}), {s['attribution_text']}. {note}".strip(),
        "source": {
            "key": s["key"],
            "name": s["name"],
            "source_type": "lehrplan",
            "url": RIS_DOC.format(s["doc"]),
            "publisher": "Republik Österreich (RIS)",
            "license": LICENSE,
            "attribution_text": s["attribution_text"],
            "notes": f"Gesetzesnummer {s['gesetz']}, Dokumentnummer {s['doc']}, in Kraft seit {s['valid_from'][8:10]}.{s['valid_from'][5:7]}.{s['valid_from'][:4]}. Wortlaut nur um Seitenköpfe, Zeilenumbrüche und Fußnotenziffern bereinigt.",
        },
        "curriculum": {
            "key": f"{s['key']}-{subject.lower()}",
            "name": f"Lehrplan {s['school_type']} – {title}",
            "school_type": s["school_type"],
            "subject": subject,
            "version": s["version"],
            "reference": f"{s['attribution_text']}, {s['doc']}",
            "valid_from": s["valid_from"],
        },
        "nodes": b.nodes,
        "skills": [],
        "skill_nodes": skill_nodes,
    }


def builder(school: str, subject: str, title: str) -> Builder:
    s = SOURCES[school]
    return Builder(f"{s['short']}-{SUBJECT_CODE[subject]}", title, s["offset"], s["grade_word"])


def build(args) -> dict[str, dict]:
    out: dict[str, tuple] = {}

    if args.vs:
        f = args.vs
        out["vs-deutsch"] = ("vs", "Deutsch", "Deutsch", parse_ris(read(f, 3016, 3370, "DEUTSCH"), builder("vs", "Deutsch", "Deutsch"), start_marker="Kompetenzbeschreibungen und Anwendungsbereiche", anwendung="klasse"), "")
        out["vs-englisch"] = ("vs", "Englisch", "Lebende Fremdsprache", parse_ris(read(f, 3756, 4000, "LEBENDE FREMDSPRACHE"), builder("vs", "Englisch", "Lebende Fremdsprache"), start_marker="Kompetenzbeschreibungen und Anwendungsbereiche", anwendung="klasse"), "1. und 2. Schulstufe verbindliche Übung, 3. und 4. Schulstufe Pflichtgegenstand.")
        out["vs-mathematik"] = ("vs", "Mathematik", "Mathematik", parse_ris(read(f, 4338, 4650, "MATHEMATIK"), builder("vs", "Mathematik", "Mathematik"), start_marker="Kompetenzbeschreibungen, Lehrstoff"), "")
    if args.ms:
        f = args.ms
        out["ms-deutsch"] = ("ms", "Deutsch", "Deutsch", parse_ris(read(f, 1704, 2082, "DEUTSCH"), builder("ms", "Deutsch", "Deutsch"), start_marker="Kompetenzbeschreibungen und Anwendungsbereiche"), "")
        out["ms-englisch"] = ("ms", "Englisch", "Erste lebende Fremdsprache", parse_ris(read(f, 2472, 2783, "(ERSTE) LEBENDE FREMDSPRACHE"), builder("ms", "Englisch", "Erste lebende Fremdsprache"), start_marker="Kompetenzbeschreibungen und Anwendungsbereiche", anwendung="klasse"), "")
        out["ms-mathematik"] = ("ms", "Mathematik", "Mathematik", parse_ris(read(f, 3199, 4117, "MATHEMATIK"), builder("ms", "Mathematik", "Mathematik"), start_marker="Kompetenzbereiche (1. bis 4. Klasse)", precision_marker="Anwendungsbereiche (1. bis 4. Klasse)"), "")
    if args.ahs:
        f = args.ahs
        d = builder("ahs", "Deutsch", "Deutsch")
        parse_ris(read(f, 2901, 3285, "DEUTSCH"), d, start_marker="Kompetenzbeschreibungen und Anwendungsbereiche")
        parse_ris(read(f, 9027, 9528, "DEUTSCH"), d, start_marker="Kompetenzbereiche aufgenommen", labelled=True)
        out["ahs-deutsch"] = ("ahs", "Deutsch", "Deutsch", d, "Unterstufe (1.–4. Klasse) und Oberstufe (5.–8. Klasse).")
        e = builder("ahs", "Englisch", "Erste lebende Fremdsprache")
        parse_ris(read(f, 3680, 3990, "ERSTE LEBENDE FREMDSPRACHE"), e, start_marker="Kompetenzbeschreibungen und Anwendungsbereiche", anwendung="klasse")
        parse_ris(read(f, 9528, args.ahs_lf_end, "LEBENDE FREMDSPRACHE"), e, start_marker=args.ahs_lf_start)
        out["ahs-englisch"] = ("ahs", "Englisch", "Erste lebende Fremdsprache", e, "Unterstufe (1.–4. Klasse) und Oberstufe (5.–8. Klasse).")
        m = builder("ahs", "Mathematik", "Mathematik")
        parse_ris(read(f, 4411, 5326, "MATHEMATIK"), m, start_marker="Kompetenzbereiche (1. bis 4. Klasse)", precision_marker="Anwendungsbereiche (1. bis 4. Klasse)")
        parse_ris(read(f, 12624, 13040, "MATHEMATIK"), m, start_marker="Aufbauender Charakter")
        out["ahs-mathematik"] = ("ahs", "Mathematik", "Mathematik", m, "Unterstufe (1.–4. Klasse) und Oberstufe (5.–8. Klasse). Formeln sind aus dem PDF-Text übernommen und können verrutscht sein.")
    if args.htl:
        f = args.htl
        out["htl-deutsch"] = ("htl", "Deutsch", "Deutsch", parse_htl(read_layout(f, "DEUTSCH", "ENGLISCH"), builder("htl", "Deutsch", "Deutsch")), "")
        out["htl-englisch"] = ("htl", "Englisch", "Englisch", parse_htl(read_layout(f, "ENGLISCH", "GEOGRAFIE, GESCHICHTE UND POLITISCHE BILDUNG"), builder("htl", "Englisch", "Englisch")), "")
        out["htl-mathematik"] = ("htl", "Mathematik", "Angewandte Mathematik", parse_htl(read_layout(f, "ANGEWANDTE MATHEMATIK", "NATURWISSENSCHAFTEN"), builder("htl", "Mathematik", "Angewandte Mathematik")), "")
    if args.hak:
        f = args.hak
        out["hak-deutsch"] = ("hak", "Deutsch", "Deutsch", parse_htl(read_spaced(f, "2.1 Deutsch", "2.2 Englisch einschließlich Wirtschaftssprache"), builder("hak", "Deutsch", "Deutsch"), paragraphs=True), "")
        out["hak-englisch"] = ("hak", "Englisch", "Englisch einschließlich Wirtschaftssprache", parse_htl(read_spaced(f, "2.2 Englisch einschließlich Wirtschaftssprache", "2.3 Lebende Fremdsprache"), builder("hak", "Englisch", "Englisch einschließlich Wirtschaftssprache"), paragraphs=True), "")
        out["hak-mathematik"] = ("hak", "Mathematik", "Mathematik und angewandte Mathematik", parse_htl(read_spaced(f, "5.1 Mathematik und angewandte Mathematik", "5.2 Naturwissenschaften"), builder("hak", "Mathematik", "Mathematik und angewandte Mathematik"), paragraphs=True), "")

    mapping = {}
    if args.mapping and os.path.exists(args.mapping):
        with open(args.mapping, encoding="utf-8") as fh:
            mapping = json.load(fh)
    pkgs = {}
    for name, (school, subject, title, b, note) in out.items():
        links = resolve_links(b, mapping.get(name, []), name)
        links = [l for i, l in enumerate(links) if l not in links[:i]]
        pkgs[name] = package(school, subject, title, b, note, links)
    return pkgs


def resolve_links(b: Builder, entries: list, name: str) -> list:
    """
    Mapping entries: [skill_id, node_code_or_prefix, phrase]. The phrase must occur in the text of a
    node at or below the code; the most specific such node is linked. An empty phrase links the node itself.
    """
    out = []
    for skill_id, where, phrase in entries:
        if not phrase:  # the node itself
            cands = [n for n in b.nodes if n["code"] == where]
            assert cands, f"{name}: {skill_id} → {where} fehlt"
            out.append([skill_id, where])
            continue
        cands = [n for n in b.nodes if (n["code"] == where or n["code"].startswith(where + "-")) and phrase.lower() in (n.get("text", "") + " " + n["name"]).lower()]
        cands = [n for n in cands if not any(c is not n and c["code"].startswith(n["code"] + "-") for c in cands)] or cands
        assert cands, f"{name}: {skill_id} → „{phrase}“ nicht in {where} gefunden"
        out.append([skill_id, cands[0]["code"]])
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--vs")
    p.add_argument("--ms")
    p.add_argument("--ahs")
    p.add_argument("--ahs-lf-start", default="Erste lebende Fremdsprache")
    p.add_argument("--ahs-lf-end", type=int, default=9965)
    p.add_argument("--htl")
    p.add_argument("--hak")
    p.add_argument("--mapping", default=os.path.join(os.path.dirname(__file__), "lehrplan_mapping.json"))
    p.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "curriculum"))
    p.add_argument("--dry", action="store_true")
    args = p.parse_args()
    pkgs = build(args)
    for name, pkg in pkgs.items():
        kinds: dict[str, int] = {}
        for n in pkg["nodes"]:
            kinds[n["kind"]] = kinds.get(n["kind"], 0) + 1
        print(f"{name}: {len(pkg['nodes'])} Einträge {kinds} · {len(pkg['skill_nodes'])} Verknüpfungen", file=sys.stderr)
        if not args.dry:
            with open(os.path.join(args.out, f"ris-{name}.json"), "w", encoding="utf-8") as fh:
                json.dump(pkg, fh, ensure_ascii=False, indent=1)
                fh.write("\n")


if __name__ == "__main__":
    main()
