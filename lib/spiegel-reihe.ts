/**
 * Schüler-Bildschirm (lib/spiegel.ts): the order of the tablet's packets at the teacher.
 *
 * The tablet does not wait for one packet's answer before it sends the next (on mobile data one answer
 * took ~130 ms, so the copy only moved 6–7 times a second; niko 2026-11-24 „immer noch laggy“). Packets
 * that travel side by side can arrive out of order, but rrweb must play them in order: each packet carries
 * its recording (`s`, new on every start of the recording) and number (`n`, from 0), and this queue hands
 * them out in order. A packet that does not come within `frist` ms is skipped; the copy then waits for the
 * next full picture (the caller asks the tablet for one). A packet that starts with a full picture (`neustart`)
 * needs nothing before it: the gap in front of it is skipped at once.
 */
export class SpiegelReihe<E> {
  private strom: string | null = null;
  private naechste = 0;
  private warten = new Map<number, E[]>();
  private luecke: number | null = null;

  constructor(
    private readonly frist = 1500,
    private readonly neustart: (events: E[]) => boolean = () => false,
  ) {}

  /** A packet arrived: the packets that can be played now, in order. */
  rein(s: unknown, n: unknown, events: E[], jetzt: number): E[][] {
    // a tablet with the old page (no numbers): as it comes
    if (typeof s !== "string" || typeof n !== "number" || !Number.isInteger(n) || n < 0) return [events];
    if (s !== this.strom) {
      // a recording starts at 0: one of its first packets may overtake packet 0 (the full picture);
      // a teacher who comes later starts where the recording is
      this.strom = s;
      this.naechste = n < 5 ? 0 : n;
      this.warten.clear();
      this.luecke = null;
    }
    if (n < this.naechste || this.warten.has(n)) return [];
    if (n > this.naechste && this.neustart(events)) {
      // a full picture: what is missing before it does not matter any more
      for (const k of [...this.warten.keys()]) if (k < n) this.warten.delete(k);
      this.naechste = n;
    }
    this.warten.set(n, events);
    return this.raus(jetzt);
  }

  /** When a missing packet is overdue: skip it. `uebersprungen` means the copy needs a full picture. */
  faellig(jetzt: number): { pakete: E[][]; uebersprungen: boolean } {
    if (this.luecke === null || jetzt - this.luecke < this.frist) return { pakete: [], uebersprungen: false };
    this.naechste = Math.min(...this.warten.keys());
    this.luecke = null;
    return { pakete: this.raus(jetzt), uebersprungen: true };
  }

  /** ms until `faellig` has something to do, or null */
  wartezeit(jetzt: number): number | null {
    return this.luecke === null ? null : Math.max(0, this.frist - (jetzt - this.luecke));
  }

  private raus(jetzt: number): E[][] {
    const out: E[][] = [];
    for (let p = this.warten.get(this.naechste); p; p = this.warten.get(this.naechste)) {
      out.push(p);
      this.warten.delete(this.naechste);
      this.naechste++;
    }
    this.luecke = this.warten.size ? (this.luecke ?? jetzt) : null;
    return out;
  }
}
