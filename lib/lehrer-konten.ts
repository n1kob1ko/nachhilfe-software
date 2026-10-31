/**
 * Konten der Lehrer verwalten (Erweitert › Lehrer › Accounts, 2026-10-31): Rolle geben und Konto löschen.
 *
 * Rollen gibt es zwei, wie bisher: **Lehrer** und **Verwaltung** (`teachers.is_admin`). Regeln:
 * - nur die Verwaltung ändert Rollen, löscht oder (de)aktiviert Konten;
 * - niemand ändert die eigene Rolle oder löscht das eigene Konto;
 * - es bleibt immer mindestens ein aktives Konto mit Verwaltung.
 * Wer handelt, kommt als Id und wird hier aus der Datenbank gelesen, nie aus dem Formular oder dem Cookie;
 * eine neue Rolle gilt damit ab der nächsten Anfrage (`lib/auth.ts` liest `is_admin` jedes Mal neu).
 *
 * Löschen verliert nichts aus dem Unterricht:
 * - ein Konto **ohne Verlauf** (keine Zeile außerhalb der reinen Kontotabellen zeigt auf es) wird wirklich gelöscht;
 * - sonst wird es **entfernt** (`teachers.deleted_at`): `active = 0`, Passwort und Sitzungen weg, Tablets getrennt,
 *   der Benutzername intern umbenannt und damit frei. Der Name bleibt, damit Dokumentation, Abrechnung und
 *   Verlauf zeigen, wer unterrichtet hat. Jede bestehende Abfrage mit `active = 1` blendet es aus,
 *   `listAllTeachers` ebenso.
 * Vorher: seine Schüler übernimmt der gewählte Lehrer (auch in „erlaubte Lehrer“), seine künftigen Plätze ohne
 * Einheit verlassen den Wochenplan (wie „Platz löschen“), vergangene bleiben als Verlauf. Läuft gerade eine
 * Einheit von ihm, wird nicht gelöscht.
 */
import { db } from "./db";
import { istAdmin } from "./planung/berechtigungen";
import { parseIdListe, slotDatum } from "./planung/repo";
import { wienerDatum, wienerMinuten } from "./planung/zeit";

export type Ergebnis = { ok: true; hinweis: string } | { ok: false; fehler: string };

/** Was die Regeln von einem Konto wissen müssen. */
export type Konto = { id: number; name: string; is_admin: number; active: number; deleted_at: string | null };

/** Tabellen, die nur zum Zugang gehören (Sitzungen, Tablets, Kopplungscodes, „gesehen“-Haken): sie sind kein Verlauf. */
const NUR_KONTO = new Set(["teacher_sessions", "student_devices", "device_pair_codes", "laptop_codes", "todo_gesehen"]);

/** Der interne Benutzername eines entfernten Kontos. `usernameFor` erzeugt nie ein „#“, also ist der alte Name wieder frei. */
export const entfernterBenutzername = (id: number) => `#geloescht-${id}`;

// ---------- Regeln (rein, ohne Datenbank) ----------

const istVerwaltung = (k: Konto | null): k is Konto => !!k && istAdmin(k) && Number(k.active) === 1 && !k.deleted_at;

/** Darf `akteur` dem Konto `ziel` die Rolle geben? `aktiveVerwaltung`: aktive Konten mit Verwaltung, `ziel` mitgezählt. */
export function rollenFehler(akteur: Konto | null, ziel: Konto | null, verwaltung: boolean, aktiveVerwaltung: number): string | null {
  if (!istVerwaltung(akteur)) return "Rollen vergibt nur die Verwaltung.";
  if (!ziel || ziel.deleted_at) return "Dieses Konto gibt es nicht mehr.";
  if (ziel.id === akteur.id) return "Die eigene Rolle ändert eine andere Verwaltung.";
  if (!verwaltung && istVerwaltung(ziel) && aktiveVerwaltung <= 1) return "Es muss immer eine Verwaltung geben.";
  return null;
}

/** Darf `akteur` das Konto `ziel` deaktivieren oder wieder aktivieren? */
export function aktivFehler(akteur: Konto | null, ziel: Konto | null, aktiv: boolean, aktiveVerwaltung: number): string | null {
  if (!istVerwaltung(akteur)) return "Konten verwaltet nur die Verwaltung.";
  if (!ziel || ziel.deleted_at) return "Dieses Konto gibt es nicht mehr.";
  if (ziel.id === akteur.id) return "Das eigene Konto deaktiviert eine andere Verwaltung.";
  if (!aktiv && istVerwaltung(ziel) && aktiveVerwaltung <= 1) return "Es muss immer eine Verwaltung geben.";
  return null;
}

export type LoeschLage = {
  aktiveVerwaltung: number;
  /** Schüler, bei denen gerade eine Einheit dieses Lehrers läuft */
  laufend: string[];
  /** wie viele Schüler diesen Lehrer als Lehrer haben (`students.teacher_id`) */
  schueler: number;
  /** wer sie übernimmt */
  nachfolger: Konto | null;
};

/** Darf `akteur` das Konto `ziel` löschen? Ein Grund in einfachen Worten, sonst null. */
export function loeschFehler(akteur: Konto | null, ziel: Konto | null, lage: LoeschLage): string | null {
  if (!istVerwaltung(akteur)) return "Konten löscht nur die Verwaltung.";
  if (!ziel || ziel.deleted_at) return "Dieses Konto gibt es nicht mehr.";
  if (ziel.id === akteur.id) return "Das eigene Konto löscht eine andere Verwaltung.";
  if (istVerwaltung(ziel) && lage.aktiveVerwaltung <= 1) return "Das ist die letzte Verwaltung. Erst einem anderen Konto die Rolle Verwaltung geben.";
  if (lage.laufend.length) return `Gerade läuft eine Einheit mit ${lage.laufend.join(" und ")}. Erst beenden, dann löschen.`;
  const n = lage.nachfolger;
  if (lage.schueler > 0 && (!n || n.id === ziel.id || Number(n.active) !== 1 || n.deleted_at)) return "Bitte wählen, wer die Schüler übernimmt.";
  return null;
}

// ---------- Lesen ----------

export function getKonto(id: number | null | undefined): Konto | null {
  if (!id) return null;
  return (db().prepare("SELECT id, name, is_admin, active, deleted_at FROM teachers WHERE id = ?").get(id) as Konto | undefined) ?? null;
}

export function aktiveVerwaltung(): number {
  return (db().prepare("SELECT COUNT(*) AS n FROM teachers WHERE is_admin = 1 AND active = 1 AND deleted_at IS NULL").get() as { n: number }).n;
}

/** Jede Spalte, die per Fremdschlüssel auf `teachers` zeigt (auch künftige Tabellen), außer den reinen Kontotabellen. */
export function lehrerVerweisSpalten(): { tabelle: string; spalte: string }[] {
  const conn = db();
  const tabellen = (conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((t) => t.name);
  const out: { tabelle: string; spalte: string }[] = [];
  for (const tabelle of tabellen) {
    if (NUR_KONTO.has(tabelle)) continue;
    for (const fk of conn.prepare(`PRAGMA foreign_key_list("${tabelle}")`).all() as { table: string; from: string }[]) {
      if (fk.table === "teachers") out.push({ tabelle, spalte: fk.from });
    }
  }
  return out;
}

/** Hat dieser Lehrer Spuren im Unterricht (Einheiten, Dokumentation, Abrechnung, Übungen, Plätze …)? */
export function hatVerlauf(teacherId: number): boolean {
  return lehrerVerweisSpalten().some(({ tabelle, spalte }) => db().prepare(`SELECT 1 FROM "${tabelle}" WHERE "${spalte}" = ? LIMIT 1`).get(teacherId));
}

/** Künftige Plätze ohne Einheit: Datum nach heute, oder heute mit Start nach jetzt (Europe/Vienna). */
function kuenftigePlaetze(teacherId: number, now: Date): number[] {
  const heute = wienerDatum(now);
  const minuten = wienerMinuten(now);
  const zeilen = db().prepare("SELECT id, week_start, weekday, start_min FROM geplante_einheiten WHERE teacher_id = ? AND unit_id IS NULL").all(teacherId) as {
    id: number;
    week_start: string;
    weekday: number;
    start_min: number;
  }[];
  return zeilen
    .filter((z) => {
      const datum = slotDatum(z.week_start, z.weekday);
      return datum > heute || (datum === heute && z.start_min > minuten);
    })
    .map((z) => z.id);
}

function laufendeSchueler(teacherId: number): string[] {
  return (db().prepare("SELECT s.name FROM units u JOIN students s ON s.id = u.student_id WHERE u.teacher_id = ? AND u.status = 'gestartet' ORDER BY s.name").all(teacherId) as { name: string }[]).map(
    (r) => r.name,
  );
}

export type LoeschVorschau = {
  konto: Konto;
  schueler: { id: number; name: string }[];
  plaetze: number;
  laufend: string[];
  /** true: es bleibt Verlauf, das Konto wird entfernt statt ganz gelöscht */
  verlauf: boolean;
};

/** Was beim Löschen passiert, für den Bestätigungsschritt. */
export function loeschVorschau(teacherId: number, now: Date = new Date()): LoeschVorschau | null {
  const konto = getKonto(teacherId);
  if (!konto || konto.deleted_at) return null;
  const schueler = db().prepare("SELECT id, name FROM students WHERE teacher_id = ? ORDER BY name COLLATE NOCASE").all(teacherId) as { id: number; name: string }[];
  const plaetze = kuenftigePlaetze(teacherId, now);
  // Verlauf ohne die Schüler (sie wechseln) und ohne die künftigen Plätze (sie gehen)
  const verlauf = lehrerVerweisSpalten().some(({ tabelle, spalte }) => {
    if (tabelle === "students" && spalte === "teacher_id") return false;
    if (tabelle === "geplante_einheiten" && spalte === "teacher_id") {
      const { n } = db().prepare("SELECT COUNT(*) AS n FROM geplante_einheiten WHERE teacher_id = ?").get(teacherId) as { n: number };
      return n > plaetze.length;
    }
    return !!db().prepare(`SELECT 1 FROM "${tabelle}" WHERE "${spalte}" = ? LIMIT 1`).get(teacherId);
  });
  return { konto, schueler, plaetze: plaetze.length, laufend: laufendeSchueler(teacherId), verlauf };
}

// ---------- Schreiben ----------

export function setzeRolle(akteurId: number, zielId: number, verwaltung: boolean): Ergebnis {
  const ziel = getKonto(zielId);
  const fehler = rollenFehler(getKonto(akteurId), ziel, verwaltung, aktiveVerwaltung());
  if (fehler || !ziel) return { ok: false, fehler: fehler ?? "Dieses Konto gibt es nicht mehr." };
  db().prepare("UPDATE teachers SET is_admin = ? WHERE id = ? AND deleted_at IS NULL").run(verwaltung ? 1 : 0, zielId);
  return { ok: true, hinweis: `${ziel.name} hat jetzt die Rolle ${verwaltung ? "Verwaltung" : "Lehrer"}.` };
}

export function setzeAktiv(akteurId: number, zielId: number, aktiv: boolean): Ergebnis {
  const ziel = getKonto(zielId);
  const fehler = aktivFehler(getKonto(akteurId), ziel, aktiv, aktiveVerwaltung());
  if (fehler || !ziel) return { ok: false, fehler: fehler ?? "Dieses Konto gibt es nicht mehr." };
  db().prepare("UPDATE teachers SET active = ? WHERE id = ? AND deleted_at IS NULL").run(aktiv ? 1 : 0, zielId);
  if (!aktiv) db().prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(zielId);
  return { ok: true, hinweis: `${ziel.name} ist ${aktiv ? "wieder aktiv" : "deaktiviert"}.` };
}

/**
 * Löscht das Konto `zielId`; seine Schüler übernimmt `nachfolgerId`. Alles in einer Transaktion: entweder passiert
 * alles oder nichts. `art`: „geloescht“ = ganz weg, „entfernt“ = Konto weg, Name bleibt im Verlauf.
 */
export function loescheLehrer(akteurId: number, zielId: number, nachfolgerId: number | null, now: Date = new Date()): Ergebnis & { art?: "geloescht" | "entfernt" } {
  const conn = db();
  const ziel = getKonto(zielId);
  const akteur = getKonto(akteurId);
  const nachfolger = getKonto(nachfolgerId);
  const vorschau = ziel && !ziel.deleted_at ? loeschVorschau(zielId, now) : null;
  const fehler = loeschFehler(akteur, ziel, {
    aktiveVerwaltung: aktiveVerwaltung(),
    laufend: vorschau?.laufend ?? [],
    schueler: vorschau?.schueler.length ?? 0,
    nachfolger,
  });
  if (fehler || !ziel || !vorschau || !akteur) return { ok: false, fehler: fehler ?? "Dieses Konto gibt es nicht mehr." };
  // wer „erlaubte Lehrer“-Listen auffüllt, wenn sonst niemand drinstünde: der Nachfolger, sonst wer löscht
  const ersatz = nachfolger && nachfolger.id !== zielId && Number(nachfolger.active) === 1 && !nachfolger.deleted_at ? nachfolger : akteur;

  const art = conn.transaction((): "geloescht" | "entfernt" => {
    conn.prepare("UPDATE students SET teacher_id = ? WHERE teacher_id = ?").run(ersatz.id, zielId);
    // „erlaubte Lehrer“: der Gelöschte fällt heraus; stand nur er drin, steht dort jetzt der Nachfolger (statt „alle“)
    const setze = conn.prepare("UPDATE students SET erlaubte_lehrer = ? WHERE id = ?");
    for (const s of conn.prepare("SELECT id, erlaubte_lehrer FROM students WHERE erlaubte_lehrer <> '[]'").all() as { id: number; erlaubte_lehrer: string }[]) {
      const ids = parseIdListe(s.erlaubte_lehrer);
      if (!ids.includes(zielId)) continue;
      const rest = ids.filter((id) => id !== zielId);
      setze.run(JSON.stringify(rest.length ? rest : [ersatz.id]), s.id);
    }
    const loesche = conn.prepare("DELETE FROM geplante_einheiten WHERE id = ?");
    for (const id of kuenftigePlaetze(zielId, now)) loesche.run(id);
    conn.prepare("DELETE FROM availability_overrides WHERE owner_type = 'teacher' AND owner_id = ?").run(zielId);
    conn.prepare("DELETE FROM teacher_sessions WHERE teacher_id = ?").run(zielId);

    if (!hatVerlauf(zielId)) {
      conn.prepare("DELETE FROM teachers WHERE id = ?").run(zielId);
      return "geloescht";
    }
    conn.prepare("UPDATE student_devices SET revoked_at = ? WHERE teacher_id = ? AND revoked_at IS NULL").run(now.toISOString(), zielId);
    conn.prepare("DELETE FROM device_pair_codes WHERE teacher_id = ?").run(zielId);
    conn
      .prepare(
        `UPDATE teachers SET deleted_at = ?, active = 0, is_admin = 0, username = ?, password_hash = NULL, must_change_password = 0,
           availability = NULL, weekly_target_min = NULL, preferred_room_ids = '[]' WHERE id = ?`,
      )
      .run(now.toISOString(), entfernterBenutzername(zielId), zielId);
    return "entfernt";
  })();

  const teile = [art === "geloescht" ? `${ziel.name} ist gelöscht.` : `Das Konto von ${ziel.name} ist gelöscht. Der Name bleibt in Dokumentation und Abrechnung.`];
  if (vorschau.schueler.length) teile.push(`${vorschau.schueler.length === 1 ? "Den Schüler" : `Die ${vorschau.schueler.length} Schüler`} übernimmt ${ersatz.name}.`);
  if (vorschau.plaetze) teile.push(`${vorschau.plaetze === 1 ? "Ein künftiger Platz ist" : `${vorschau.plaetze} künftige Plätze sind`} aus dem Wochenplan genommen.`);
  return { ok: true, hinweis: teile.join(" "), art };
}
