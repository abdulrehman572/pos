import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { EventEmitter } from "events";
// Ensure database migrations run on startup
import "./db/migrate";

// Import all route modules
import { productsRoutes } from "./routes/products";
import { salesRoutes } from "./routes/sales";
import { purchasesRoutes } from "./routes/purchases";
import { customersRoutes } from "./routes/customers";
import { suppliersRoutes } from "./routes/suppliers";
import { paymentsRoutes } from "./routes/payments";
import { expensesRoutes } from "./routes/expenses";
import { settingsRoutes } from "./routes/settings";
import { backupRoutes } from "./routes/backup";
import { reportsRoutes } from "./routes/reports";

// Event bus for SSE
export const eventBus = new EventEmitter();

const app = new Elysia()
  // ETag middleware for all GET /api/* responses
  .onBeforeHandle(({ request, set }) => {
    if (request.method === "GET" && request.url.startsWith("/api/")) {
      // Simple ETag based on timestamp (you could improve with content hashing)
      set.headers["ETag"] = `W/"${Date.now()}"`;
    }
  })
  // Serve static frontend files
  .use(staticPlugin({ assets: "./frontend", prefix: "" }))
  // Mount all API routes
  .use(productsRoutes)
  .use(salesRoutes)
  .use(purchasesRoutes)
  .use(customersRoutes)
  .use(suppliersRoutes)
  .use(paymentsRoutes)
  .use(expensesRoutes)
  .use(settingsRoutes)
  .use(backupRoutes)
  .use(reportsRoutes)
  // SSE endpoint for real‑time updates
  .get("/api/events", ({ set, request }) => {
    set.headers["content-type"] = "text/event-stream";
    set.headers["cache-control"] = "no-cache";
    const stream = new ReadableStream({
      start(controller) {
        const listener = (data: any) => {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        };
        eventBus.on("update", listener);
        request.signal?.addEventListener("abort", () => {
          eventBus.off("update", listener);
          controller.close();
        });
      },
    });
    return stream;
  })
  .listen(3000);

console.log(`🦊 Elysia running at ${app.server?.hostname}:${app.server?.port}`);