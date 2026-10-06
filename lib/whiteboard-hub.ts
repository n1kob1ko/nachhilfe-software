/**
 * Live connections. Every open screen holds one Server-Sent-Events stream on a channel and gets
 * the events published there. Channels: a board id (number) for whiteboards, "geraet:<teacher id>"
 * for a teacher's student tablet and "einheit:<unit id>" for the live status on the teacher's laptop.
 *
 * SSE fits the existing stack: plain Next.js route handlers, no extra server process, works through
 * any proxy that speaks HTTP, and browsers reconnect by themselves. Sending goes over normal POST
 * requests. The hub lives in memory, so the app must run as one server process (as `npm start` does).
 */
export type HubEvent = { type: string; [k: string]: unknown };
export type Channel = number | string;
type Sub = { clientId: string; role: "lehrer" | "schueler"; name: string; pageId: number | null; send: (e: HubEvent) => void };

const g = globalThis as unknown as { __wbHub?: Map<Channel, Set<Sub>> };
const boards = (g.__wbHub ??= new Map());

export function subscribe(boardId: Channel, sub: Sub): () => void {
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

/** Sends to every device on the channel except the one the change came from. */
export function publish(boardId: Channel, event: HubEvent, exceptClientId?: string) {
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
export function notePage(boardId: Channel, clientId: string, pageId: number) {
  for (const s of boards.get(boardId) ?? []) if (s.clientId === clientId && s.pageId !== pageId) {
    s.pageId = pageId;
    publishPresence(boardId);
  }
}

export function presence(boardId: Channel) {
  return [...(boards.get(boardId) ?? [])].map((s) => ({ clientId: s.clientId, role: s.role, name: s.name, pageId: s.pageId }));
}

function publishPresence(boardId: Channel) {
  publish(boardId, { type: "presence", people: presence(boardId) });
}

type StreamOptions = {
  role: Sub["role"];
  name: string;
  /** first event: the current state */
  hello: () => HubEvent;
  /** every ping (20 s) and once at the start, e.g. to note when a tablet was last seen */
  onAlive?: () => void;
  /** after subscribing and after leaving, e.g. to tell the teacher that the tablet came or went */
  onPresence?: () => void;
};

/** The SSE response of one screen on a channel: first `hello`, then every event published there. */
export function stream(channel: Channel, request: Request, o: StreamOptions): Response {
  const clientId = new URL(request.url).searchParams.get("client")?.slice(0, 40) || crypto.randomUUID();
  const enc = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream({
    start(controller) {
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      send(o.hello());
      const unsubscribe = subscribe(channel, { clientId, role: o.role, name: o.name, pageId: null, send });
      o.onAlive?.();
      o.onPresence?.();
      // a comment line every 20 s keeps proxies and tablets from closing an idle connection
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
          o.onAlive?.();
        } catch {
          cleanup();
        }
      }, 20_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        cleanup = () => {};
        o.onPresence?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform keeps the compression middleware from buffering the stream
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** True while at least one screen of that role holds a stream on the channel. */
export function isOnline(channel: Channel, role?: Sub["role"]) {
  return [...(boards.get(channel) ?? [])].some((s) => !role || s.role === role);
}
