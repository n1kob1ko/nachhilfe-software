"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  CloudOff,
  Download,
  Heading,
  Italic,
  Loader2,
  Maximize2,
  Minimize2,
  Pilcrow,
  Redo2,
  Save,
  Send,
  Underline,
  Undo2,
} from "lucide-react";
import {
  countChars,
  countWords,
  docKey,
  docToHtml,
  type TextDoc,
} from "@/lib/text-doc";
import { readDom } from "./read-dom";
import { StoryColumn, StoryStrip, type StoryPictures } from "./story/StoryPictures";
import { saveTextFile } from "./save-file";

export type TextState = { body: TextDoc; version: number; updatedAt: string };

type Props = {
  textId: number;
  /** POST endpoint of the save route (teacher or tablet) */
  saveUrl: string;
  initial: TextState;
  title: string;
  prompt: string;
  /** e.g. "Deutsch · Erlebniserzählung" */
  meta?: string;
  /** larger writing on the tablet */
  large?: boolean;
  /** links next to the title, e.g. "PDF / Drucken" (hidden in Vollbild) */
  actions?: React.ReactNode;
  /** where the copy on this device is kept, plus the text id; the student laptop uses its own prefix so it can clean up */
  backupPrefix?: string;
  /** Bildgeschichte: the pictures stay in view while writing (next to the text, or above it on a narrow screen) */
  pictures?: StoryPictures;
  /** the word count the teacher asked for, shown with the count */
  targetWords?: number | null;
  /** "Abgeben" on the student's device: POST endpoint, and where to go afterwards */
  handIn?: { url: string; home: string };
};

type Status =
  | "gespeichert"
  | "geaendert"
  | "speichert"
  | "offline"
  | "konflikt"
  | "abgemeldet"
  | "gesperrt"
  | "fehler";
/** title too, so a copy can still be saved as a file after the page that knew the title is gone */
type Backup = { base: number; key: string; body: TextDoc; at: number; title?: string };

const SAVE_AFTER_MS = 1200;
const SAVE_AT_LEAST_MS = 8000;
const KEEPALIVE_MAX = 60_000;

const clock = (iso: string | number) =>
  // fixed zone: the server renders it first, the browser must show the same
  new Date(iso).toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vienna",
  });
function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}
function writeBackup(key: string, b: Backup | null) {
  try {
    if (b) localStorage.setItem(key, JSON.stringify(b));
    else localStorage.removeItem(key);
  } catch {
    // private mode or storage full: saving to the server still works
  }
}

function Tool({
  on,
  label,
  onClick,
  children,
}: {
  on?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2.5 text-[14px] font-semibold transition-colors ${on ? "bg-ink text-surface" : "text-ink hover:bg-panel"}`}
    >
      {children}
    </button>
  );
}

/**
 * The writing area of a Textarbeit: paragraphs and headings, bold/italic/underline, undo/redo, word and
 * character count, Vollbild. Saves by itself shortly after typing stops (and at least every few seconds
 * while typing), keeps a copy on the device until the server has it, and retries when the connection
 * is back. Nothing typed is thrown away without the writer choosing so.
 */
export function TextEditor({
  textId,
  saveUrl,
  initial,
  title,
  prompt,
  meta,
  large,
  actions,
  backupPrefix = "lernheft-text-",
  pictures,
  targetWords,
  handIn,
}: Props) {
  const store = `${backupPrefix}${textId}`;
  const editor = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const version = useRef(initial.version);
  const savedKey = useRef(docKey(initial.body));
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtySince = useRef<number | null>(null);
  const failures = useRef(0);
  const backupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** the text as last read from the screen; still there when the editor is already gone */
  const latest = useRef<TextDoc>(initial.body);
  const lastRange = useRef<Range | null>(null);
  const statusRef = useRef<Status>("gespeichert");

  const [status, setStatus] = useState<Status>("gespeichert");
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [counts, setCounts] = useState({
    words: countWords(initial.body),
    chars: countChars(initial.body),
  });
  const [empty, setEmpty] = useState(initial.body.length === 0);
  const [marks, setMarks] = useState({
    b: false,
    i: false,
    u: false,
    h: false,
  });
  const [focus, setFocus] = useState(false);
  const [conflict, setConflict] = useState<null | {
    version: number;
    body: TextDoc;
    updatedAt: string;
  }>(null);
  const [offerBackup, setOfferBackup] = useState<Backup | null>(null);
  const [restored, setRestored] = useState(false);
  // typing before the page is ready would be lost when the editor takes over: editable only then
  const [ready, setReady] = useState(false);
  // the text as HTML, already from the server; React never sets it again (edits stay untouched)
  const [firstHtml] = useState(() => docToHtml(initial.body));
  statusRef.current = status;

  const read = useCallback((): TextDoc => {
    if (editor.current) latest.current = readDom(editor.current);
    return latest.current;
  }, []);

  const show = useCallback((doc: TextDoc) => {
    if (!editor.current) return;
    editor.current.innerHTML = docToHtml(doc);
    latest.current = doc;
    setCounts({ words: countWords(doc), chars: countChars(doc) });
    setEmpty(doc.length === 0);
  }, []);

  // ---------- saving ----------

  const save = useCallback(
    async (o: { force?: boolean } = {}) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (inFlight.current) {
        again.current = true;
        return;
      }
      const doc = read();
      const key = docKey(doc);
      if (key === savedKey.current && !o.force) {
        dirtySince.current = null;
        setStatus((s) => (s === "konflikt" ? s : "gespeichert"));
        writeBackup(store, null);
        return;
      }
      inFlight.current = true;
      setStatus("speichert");
      try {
        const res = await fetch(saveUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: version.current,
            body: doc,
            force: Boolean(o.force),
          }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        // signed out: the app answers with its login page instead of the save
        if (res.ok && (res.redirected || typeof data.version !== "number")) {
          setStatus("abgemeldet");
        } else if (res.ok) {
          version.current = data.version;
          savedKey.current = key;
          failures.current = 0;
          setSavedAt(data.updatedAt);
          setConflict(null);
          if (docKey(read()) === key) {
            dirtySince.current = null;
            writeBackup(store, null);
            setStatus("gespeichert");
          } else {
            setStatus("geaendert");
            again.current = true;
          }
        } else if (res.status === 409) {
          setConflict({
            version: data.version,
            body: data.body,
            updatedAt: data.updatedAt,
          });
          setStatus("konflikt");
        } else if (res.status === 401) {
          setStatus("abgemeldet");
        } else if (res.status === 403 || res.status === 404) {
          setStatus("gesperrt");
        } else if (res.status === 400 || res.status === 413) {
          setStatus("fehler");
        } else throw new Error(String(res.status));
      } catch {
        // no connection (or the server is restarting): try again, later and later
        failures.current++;
        setStatus("offline");
        const wait = Math.min(
          30_000,
          2000 * 2 ** Math.min(4, failures.current - 1),
        );
        timer.current = setTimeout(() => void save(), wait);
      } finally {
        inFlight.current = false;
        if (again.current) {
          again.current = false;
          timer.current = setTimeout(() => void save(), 300);
        }
      }
    },
    [read, saveUrl, store],
  );

  /** When the page goes away: hand the last changes to the browser so they arrive even without the page. */
  const flush = useCallback(() => {
    const doc = editor.current ? read() : latest.current;
    const key = docKey(doc);
    if (key === savedKey.current) return;
    writeBackup(store, {
      base: version.current,
      key,
      body: doc,
      at: Date.now(),
      title,
    });
    const body = JSON.stringify({ version: version.current, body: doc });
    if (body.length > KEEPALIVE_MAX) return;
    try {
      void fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // the copy on the device is enough
    }
  }, [read, saveUrl, store, title]);

  const changed = useCallback(() => {
    const doc = read();
    setCounts({ words: countWords(doc), chars: countChars(doc) });
    setEmpty(doc.length === 0);
    const key = docKey(doc);
    const status = statusRef.current;
    if (key === savedKey.current) {
      if (!inFlight.current && status !== "konflikt") setStatus("gespeichert");
      return;
    }
    if (status !== "konflikt" && status !== "offline" && !inFlight.current)
      setStatus("geaendert");
    dirtySince.current ??= Date.now();
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(
      () =>
        writeBackup(store, {
          base: version.current,
          key,
          body: doc,
          at: Date.now(),
          title,
        }),
      400,
    );
    if (
      status === "konflikt" ||
      status === "gesperrt" ||
      status === "abgemeldet"
    )
      return;
    if (timer.current) clearTimeout(timer.current);
    const waited = Date.now() - dirtySince.current;
    timer.current = setTimeout(
      () => void save(),
      waited >= SAVE_AT_LEAST_MS ? 0 : SAVE_AFTER_MS,
    );
  }, [read, save, store, title]);

  // ---------- start: content, a copy left on this device, browser settings ----------

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      // older browsers: their default is fine
    }
    show(initial.body);
    setReady(true);
    const b = readBackup(store);
    if (b && b.key !== docKey(initial.body)) {
      if (b.base === initial.version) {
        // typed here, not yet saved, nothing changed elsewhere: continue with it
        show(b.body);
        setRestored(true);
        dirtySince.current = Date.now();
        setStatus("geaendert");
        timer.current = setTimeout(() => void save(), 500);
      } else setOfferBackup(b);
    } else if (b) writeBackup(store, null);
    // only once per text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textId]);

  // a newer version from another device (teacher's laptop ↔ tablet), as long as nothing is typed here;
  // if something is, saving it shows the conflict and nothing is overwritten
  const takeRemote = useCallback(
    (r: TextState) => {
      if (r.version <= version.current) return;
      if (docKey(read()) !== savedKey.current) return;
      version.current = r.version;
      savedKey.current = docKey(r.body);
      setSavedAt(r.updatedAt);
      show(r.body);
    },
    [read, show],
  );
  useEffect(() => takeRemote(initial), [initial, takeRemote]);
  useEffect(() => {
    const remote = (e: Event) => {
      const d = (e as CustomEvent<TextState & { textId: number }>).detail;
      if (d.textId === textId) takeRemote(d);
    };
    window.addEventListener("lernheft-text-remote", remote);
    return () => window.removeEventListener("lernheft-text-remote", remote);
  }, [takeRemote, textId]);

  useEffect(() => {
    const online = () => {
      if (docKey(read()) !== savedKey.current) void save();
    };
    // the connection is gone: say at once that the latest changes are only on this device
    const offline = () => {
      const doc = read();
      const key = docKey(doc);
      if (key === savedKey.current) return;
      writeBackup(store, { base: version.current, key, body: doc, at: Date.now(), title });
      if (statusRef.current === "geaendert" || statusRef.current === "speichert") setStatus("offline");
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (docKey(read()) === savedKey.current) return;
      flush();
      // the page itself leaves (the unit ended, the laptop signs out): the copy on the device is enough, no question
      if (document.documentElement.dataset.leaving) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // "Abmelden" on the laptop: save now, without waiting for the pause after typing
    const now = () => void save();
    window.addEventListener("lernheft-save-now", now);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("lernheft-save-now", now);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [flush, read, save, store, title]);

  // leaving the text inside the app (tablet switches view, unit ends): send what is not saved yet
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (backupTimer.current) clearTimeout(backupTimer.current);
      flush();
    },
    [flush],
  );

  // ---------- formatting ----------

  const updateMarks = useCallback(() => {
    const sel = document.getSelection();
    const node = sel?.anchorNode;
    if (!node || !editor.current?.contains(node)) return;
    if (sel.rangeCount) lastRange.current = sel.getRangeAt(0).cloneRange();
    const el =
      node.nodeType === Node.ELEMENT_NODE
        ? (node as Element)
        : node.parentElement;
    setMarks({
      b: document.queryCommandState("bold"),
      i: document.queryCommandState("italic"),
      u: document.queryCommandState("underline"),
      h: Boolean(el?.closest("h1,h2,h3,h4,h5,h6")),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateMarks);
    return () => document.removeEventListener("selectionchange", updateMarks);
  }, [updateMarks]);

  const exec = (cmd: string, value?: string) => {
    const el = editor.current;
    if (!el) return;
    el.focus();
    // a tap on a button can move the selection away (tablets): put it back where the writer was
    const sel = document.getSelection();
    if (
      sel &&
      lastRange.current &&
      !(sel.anchorNode && el.contains(sel.anchorNode))
    ) {
      sel.removeAllRanges();
      sel.addRange(lastRange.current);
    }
    document.execCommand(cmd, false, value);
    updateMarks();
    changed();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    }
  };

  // only plain text comes in: no foreign fonts, colours or links in a student's text
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text)
      document.execCommand("insertText", false, text.replace(/\r\n?/g, "\n"));
  };

  const onInput = () => {
    const el = editor.current;
    if (el && (el.innerHTML === "" || el.innerHTML === "<br>")) {
      el.innerHTML = "<p><br></p>";
      const r = document.createRange();
      r.setStart(el.firstChild!, 0);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(r);
    }
    changed();
  };

  // ---------- Vollbild ----------

  const toggleFocus = async () => {
    const next = !focus;
    setFocus(next);
    try {
      if (
        next &&
        shell.current?.requestFullscreen &&
        !document.fullscreenElement
      )
        await shell.current.requestFullscreen();
      if (!next && document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // no real fullscreen (e.g. iPad): the writing area still fills the screen
    }
    setTimeout(() => editor.current?.focus(), 50);
  };

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFocus(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focus) setFocus(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [focus]);

  // ---------- conflict and copy on this device ----------

  const keepMine = () => void save({ force: true });
  const takeTheirs = () => {
    if (!conflict) return;
    version.current = conflict.version;
    savedKey.current = docKey(conflict.body);
    show(conflict.body);
    writeBackup(store, null);
    setConflict(null);
    setSavedAt(conflict.updatedAt);
    setStatus("gespeichert");
  };
  const useBackup = () => {
    if (!offerBackup) return;
    show(offerBackup.body);
    setOfferBackup(null);
    void save({ force: true });
  };
  const dropBackup = () => {
    writeBackup(store, null);
    setOfferBackup(null);
  };

  // ---------- Abgeben (student's device) ----------

  const [handing, setHanding] = useState<null | "fragen" | "laeuft">(null);
  const [handError, setHandError] = useState<string | null>(null);
  /** Saves first and hands in only what the server has: nothing typed stays behind. */
  const submitHandIn = async () => {
    if (!handIn) return;
    setHanding("laeuft");
    setHandError(null);
    await save();
    for (let i = 0; i < 50 && (inFlight.current || timer.current); i++) await new Promise((r) => setTimeout(r, 200));
    if (docKey(read()) !== savedKey.current) {
      setHandError("Noch nicht gespeichert. Prüfe die Verbindung und tippe dann noch einmal auf „Abgeben“.");
      setHanding(null);
      return;
    }
    try {
      const res = await fetch(handIn.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: version.current }), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.assign(handIn.home);
        return;
      }
      setHandError(data.error ?? "Abgeben ging nicht. Bitte noch einmal versuchen.");
    } catch {
      setHandError("Keine Verbindung. Dein Text ist gespeichert, bitte gleich noch einmal abgeben.");
    }
    setHanding(null);
  };

  const statusView = {
    gespeichert: {
      icon: <CheckCircle2 size={16} aria-hidden />,
      text: `Gespeichert ${clock(savedAt)}`,
      tone: "text-green",
    },
    geaendert: {
      icon: <Save size={16} aria-hidden />,
      text: "Wird gleich gespeichert",
      tone: "text-ink-2",
    },
    speichert: {
      icon: <Loader2 size={16} className="animate-spin" aria-hidden />,
      text: "Speichert …",
      tone: "text-ink-2",
    },
    offline: {
      icon: <CloudOff size={16} aria-hidden />,
      text: "Nicht gespeichert · offline",
      tone: "text-red",
    },
    konflikt: {
      icon: <AlertTriangle size={16} aria-hidden />,
      text: "Woanders geändert",
      tone: "text-red",
    },
    abgemeldet: {
      icon: <AlertTriangle size={16} aria-hidden />,
      text: "Nicht angemeldet",
      tone: "text-red",
    },
    gesperrt: {
      icon: <AlertTriangle size={16} aria-hidden />,
      text: "Kann hier nicht gespeichert werden",
      tone: "text-red",
    },
    fehler: {
      icon: <AlertTriangle size={16} aria-hidden />,
      text: "Nicht gespeichert",
      tone: "text-red",
    },
  }[status];
  const unsynced =
    status === "offline" ||
    status === "abgemeldet" ||
    status === "gesperrt" ||
    status === "fehler";

  const main = (
    <>

        {unsynced && (
          <div
            role="alert"
            className="mt-3 rounded-2xl border-2 border-amber bg-amber-wash px-4 py-3 text-[14px]"
            data-testid="unsynced"
          >
            <p className="flex items-start gap-2 text-[15px] font-semibold">
              <CloudOff size={18} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                Noch nicht gespeichert: Deine letzten Änderungen sind nur auf
                diesem Gerät.
              </span>
            </p>
            <p className="mt-1 text-ink-2">
              {status === "offline" && (
                <>
                  Keine Verbindung. Schreib ruhig weiter: Der Text wird
                  gespeichert, sobald die Verbindung wieder da ist.
                </>
              )}
              {status === "abgemeldet" && (
                <>
                  Die Anmeldung ist abgelaufen. Bitte in einem neuen Tab anmelden,
                  dann hier „Speichern“ tippen.
                </>
              )}
              {status === "gesperrt" && (
                <>
                  Dieser Text kann auf diesem Gerät nicht mehr gespeichert werden
                  (die Einheit ist vorbei).
                </>
              )}
              {status === "fehler" && (
                <>Der Text ist zu lang oder enthält etwas Unerwartetes.</>
              )}{" "}
              Zuletzt gespeichert: {clock(savedAt)}. Schließe das Fenster erst,
              wenn hier „Gespeichert“ steht, oder sichere den Text vorher als
              Datei.
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-2"
              onClick={() => saveTextFile(title, read())}
            >
              <Download size={14} aria-hidden /> Als Datei sichern
            </button>
          </div>
        )}
        {conflict && (
          <div
            role="alert"
            className="mt-3 rounded-2xl bg-red-wash px-4 py-3 text-[14px]"
          >
            <p>
              <b>Dieser Text wurde inzwischen auf einem anderen Gerät geändert</b>{" "}
              ({clock(conflict.updatedAt)}, {countWords(conflict.body)} Wörter).
              Welche Fassung soll gelten?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={keepMine}
              >
                Meine Fassung behalten ({counts.words} Wörter)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={takeTheirs}
              >
                Andere Fassung laden
              </button>
            </div>
          </div>
        )}
        {offerBackup && (
          <div
            role="alert"
            className="mt-3 rounded-2xl bg-amber-wash px-4 py-3 text-[14px]"
          >
            <p>
              <b>Auf diesem Gerät gibt es eine nicht gespeicherte Fassung</b> von{" "}
              {clock(offerBackup.at)} ({countWords(offerBackup.body)} Wörter).
              Inzwischen wurde der Text woanders geändert.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={useBackup}
              >
                Diese Fassung verwenden
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={dropBackup}
              >
                Verwerfen
              </button>
            </div>
          </div>
        )}
        {restored && status !== "offline" && (
          <p role="status" className="mt-3 text-[13px] text-ink-2">
            Nicht gespeicherte Änderungen von diesem Gerät wurden
            wiederhergestellt.
          </p>
        )}

        <div className="tx-paper">
          <div
            ref={editor}
            className={`tx-editor ${large ? "tx-large" : ""}`}
            contentEditable={ready}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: firstHtml }}
            data-ready={ready}
            role="textbox"
            aria-multiline="true"
            aria-label={`Text: ${title}`}
            data-empty={empty}
            data-testid="text-area"
            spellCheck
            lang="de"
            onInput={onInput}
            onKeyDown={onKeyDown}
            onKeyUp={updateMarks}
            onMouseUp={updateMarks}
            onPaste={onPaste}
            onDrop={(e) => e.preventDefault()}
          />
        </div>
        <p className="tx-count" data-testid="text-count">
          <span className="num">{counts.words.toLocaleString("de-AT")}</span>{" "}
          {counts.words === 1 ? "Wort" : "Wörter"}
          {targetWords ? (
            <span data-testid="wortziel">
              {" "}
              (Ziel: ca. <span className="num">{targetWords.toLocaleString("de-AT")}</span>)
            </span>
          ) : null}{" "}
          ·{" "}
          <span className="num">{counts.chars.toLocaleString("de-AT")}</span>{" "}
          Zeichen
          <span
            className={`ml-3 inline-flex items-center gap-1.5 md:hidden ${statusView.tone}`}
          >
            {statusView.icon} {statusView.text}
          </span>
        </p>
        {handIn && (
          <div className="tx-handin" data-testid="abgeben-bereich">
            {handing === "fragen" ? (
              <>
                <p className="text-[15px] font-semibold">Bist du fertig? Dann gib deine Geschichte ab.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={() => void submitHandIn()} data-testid="abgeben-ja">
                    <Send size={16} aria-hidden /> Ja, abgeben
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setHanding(null)}>
                    Weiterschreiben
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn btn-primary" disabled={handing === "laeuft" || empty} onClick={() => setHanding("fragen")} data-testid="abgeben">
                <Send size={16} aria-hidden /> {handing === "laeuft" ? "Wird abgegeben …" : "Abgeben"}
              </button>
            )}
            {handError && (
              <p className="text-[14px] text-red" role="alert">
                {handError}
              </p>
            )}
          </div>
        )}
    </>
  );

  return (
    <div
      ref={shell}
      className={`${focus ? "tx-focus" : "tx-shell"}${pictures ? " tx-story" : ""}`}
      data-testid="text-editor"
      data-status={status}
    >
      <header className={focus ? "sr-only" : "mb-4"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {meta && (
              <p className="text-[13px] font-medium text-ink-2">{meta}</p>
            )}
            <h1
              className={`${large ? "text-[26px]" : "text-[24px]"} leading-tight font-semibold tracking-[-0.02em]`}
            >
              {title}
            </h1>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {prompt && (
          <div className="mt-3 rounded-2xl bg-panel px-4 py-3">
            <p className="text-[12px] font-semibold tracking-[0.04em] text-ink-2 uppercase">
              Aufgabe
            </p>
            <p className="mt-0.5 text-[15px] whitespace-pre-line">{prompt}</p>
          </div>
        )}
      </header>
      {pictures ? (
        <div className="tx-story-grid">
          <StoryColumn p={pictures} />
          <div className="tx-story-main">
            <div className="tx-sticky">
              <StoryStrip p={pictures} />
              <div role="toolbar" aria-label="Text bearbeiten" className="tx-toolbar">
                <div className="flex items-center gap-0.5">
                  <Tool
                    label="Absatz"
                    on={!marks.h}
                    onClick={() => exec("formatBlock", "<p>")}
                  >
                    <Pilcrow size={17} aria-hidden />{" "}
                    <span className="hidden sm:inline">Text</span>
                  </Tool>
                  <Tool
                    label="Überschrift"
                    on={marks.h}
                    onClick={() => exec("formatBlock", marks.h ? "<p>" : "<h2>")}
                  >
                    <Heading size={17} aria-hidden />{" "}
                    <span className="hidden sm:inline">Überschrift</span>
                  </Tool>
                </div>
                <span className="tx-sep" aria-hidden />
                <div className="flex items-center gap-0.5">
                  <Tool label="Fett" on={marks.b} onClick={() => exec("bold")}>
                    <Bold size={18} aria-hidden />
                  </Tool>
                  <Tool label="Kursiv" on={marks.i} onClick={() => exec("italic")}>
                    <Italic size={18} aria-hidden />
                  </Tool>
                  <Tool
                    label="Unterstrichen"
                    on={marks.u}
                    onClick={() => exec("underline")}
                  >
                    <Underline size={18} aria-hidden />
                  </Tool>
                </div>
                <span className="tx-sep" aria-hidden />
                <div className="flex items-center gap-0.5">
                  <Tool label="Rückgängig" onClick={() => exec("undo")}>
                    <Undo2 size={18} aria-hidden />
                  </Tool>
                  <Tool label="Wiederholen" onClick={() => exec("redo")}>
                    <Redo2 size={18} aria-hidden />
                  </Tool>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <span
                    className={`hidden items-center gap-1.5 px-2 text-[13px] font-medium md:inline-flex ${statusView.tone}`}
                    role="status"
                    aria-live="polite"
                    data-testid="save-status"
                    data-status={status}
                  >
                    {statusView.icon} {statusView.text}
                  </span>
                  <Tool
                    label={focus ? "Vollbild beenden" : "Vollbild"}
                    onClick={() => void toggleFocus()}
                  >
                    {focus ? (
                      <Minimize2 size={18} aria-hidden />
                    ) : (
                      <Maximize2 size={18} aria-hidden />
                    )}
                  </Tool>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void save()}
                    className="btn btn-primary h-11 min-h-11 px-4"
                    disabled={status === "speichert"}
                  >
                    <Save size={16} aria-hidden /> Speichern
                  </button>
                </div>
              </div>
            </div>
            {main}
          </div>
        </div>
      ) : (
        <>
          <div role="toolbar" aria-label="Text bearbeiten" className="tx-toolbar">
            <div className="flex items-center gap-0.5">
              <Tool
                label="Absatz"
                on={!marks.h}
                onClick={() => exec("formatBlock", "<p>")}
              >
                <Pilcrow size={17} aria-hidden />{" "}
                <span className="hidden sm:inline">Text</span>
              </Tool>
              <Tool
                label="Überschrift"
                on={marks.h}
                onClick={() => exec("formatBlock", marks.h ? "<p>" : "<h2>")}
              >
                <Heading size={17} aria-hidden />{" "}
                <span className="hidden sm:inline">Überschrift</span>
              </Tool>
            </div>
            <span className="tx-sep" aria-hidden />
            <div className="flex items-center gap-0.5">
              <Tool label="Fett" on={marks.b} onClick={() => exec("bold")}>
                <Bold size={18} aria-hidden />
              </Tool>
              <Tool label="Kursiv" on={marks.i} onClick={() => exec("italic")}>
                <Italic size={18} aria-hidden />
              </Tool>
              <Tool
                label="Unterstrichen"
                on={marks.u}
                onClick={() => exec("underline")}
              >
                <Underline size={18} aria-hidden />
              </Tool>
            </div>
            <span className="tx-sep" aria-hidden />
            <div className="flex items-center gap-0.5">
              <Tool label="Rückgängig" onClick={() => exec("undo")}>
                <Undo2 size={18} aria-hidden />
              </Tool>
              <Tool label="Wiederholen" onClick={() => exec("redo")}>
                <Redo2 size={18} aria-hidden />
              </Tool>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span
                className={`hidden items-center gap-1.5 px-2 text-[13px] font-medium md:inline-flex ${statusView.tone}`}
                role="status"
                aria-live="polite"
                data-testid="save-status"
                data-status={status}
              >
                {statusView.icon} {statusView.text}
              </span>
              <Tool
                label={focus ? "Vollbild beenden" : "Vollbild"}
                onClick={() => void toggleFocus()}
              >
                {focus ? (
                  <Minimize2 size={18} aria-hidden />
                ) : (
                  <Maximize2 size={18} aria-hidden />
                )}
              </Tool>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void save()}
                className="btn btn-primary h-11 min-h-11 px-4"
                disabled={status === "speichert"}
              >
                <Save size={16} aria-hidden /> Speichern
              </button>
            </div>
          </div>
          {main}
        </>
      )}
    </div>
  );
}
