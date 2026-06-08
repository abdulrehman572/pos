import { Elysia } from "elysia";
type Event = { type: string; payload: any };
const listeners: ((event: Event) => void)[] = [];
export function emit(event: Event) { for (const listener of listeners) listener(event); }
export const eventsRoutes = new Elysia({ prefix: "/api/events" })
  .get("/", ({ set }) => {
    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Connection"] = "keep-alive";
    const stream = new ReadableStream({
      start(controller) {
        const listener = (event: Event) => controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        listeners.push(listener);
        const heartbeat = setInterval(() => controller.enqueue(": heartbeat\n\n"), 30000);
        const cleanup = () => { clearInterval(heartbeat); const idx = listeners.indexOf(listener); if (idx !== -1) listeners.splice(idx, 1); };
        (stream as any).onCancel = cleanup;
        (controller as any).onCancel = cleanup;
      },
    });
    return stream;
  });
