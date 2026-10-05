/**
 * Live connections of whiteboards. Every open board (teacher laptop, student tablet) holds one
 * Server-Sent-Events stream; changes are pushed to all other streams of the same board.
 *
 * SSE fits the existing stack: plain Next.js route handlers, no extra server process, works through
 * any proxy that speaks HTTP, and browsers reconnect by themselves. Sending goes over normal POST
 * requests. The hub lives in memory, so the app must run as one server process (as `npm start` does).
 */
export type HubEvent = { type: string; [k: string]: unknown };
type Sub = { clientId: string; role: "lehrer" | "schueler"; name: string; pageId: number | null; send: (e: HubEvent) => void };

const g = globalThis as unknown as { __wbHub?: Map<number, Set<Sub>> };
const boards = (g.__wbHub ??= new Map());

export function subscribe(boardId: number, sub: Sub): () => void {
  let set = boards.get(boardId);
  if (!set) boards.set(boardId, (set = new Set()));
  set.add(sub);
  publishPresence(boardId);
  return () => {
    set!.delete(sub);
    if (set!.size === 0) boards.delete(boardId);
    publishPresence(boardId);
  };
}

/** Sends to every device on the board except the one the change came from. */
export function publish(boardId: number, event: HubEvent, exceptClientId?: string) {
  for (const s of boards.get(boardId) ?? []) {
    if (s.clientId === exceptClientId) continue;
    try {
      s.send(event);
    } catch {
      // a closed stream is removed by its own abort handler
    }
  }
}

/** Remembers which page a device shows, for "Schüler ist auf Seite 2". */
export function notePage(boardId: number, clientId: string, pageId: number) {
  for (const s of boards.get(boardId) ?? []) if (s.clientId === clientId && s.pageId !== pageId) {
    s.pageId = pageId;
    publishPresence(boardId);
  }
}

export function presence(boardId: number) {
  return [...(boards.get(boardId) ?? [])].map((s) => ({ clientId: s.clientId, role: s.role, name: s.name, pageId: s.pageId }));
}

function publishPresence(boardId: number) {
  publish(boardId, { type: "presence", people: presence(boardId) });
}
