import { Elysia, t } from "elysia";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .get("/", () => db.select().from(settings))
  .get("/:key", ({ params: { key } }) => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value;
  })
  .put("/:key", ({ params: { key }, body: { value } }) => {
    return db.insert(settings).values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .returning().get();
  }, {
    body: t.Object({ value: t.String() })
  });