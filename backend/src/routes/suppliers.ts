import { Elysia, t } from "elysia";
import { db } from "../db";
import { suppliers } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const suppliersRoutes = new Elysia({ prefix: "/api/suppliers" })
  .get("/", () => db.select().from(suppliers))
  .get("/:id", ({ params: { id } }) => 
    db.select().from(suppliers).where(eq(suppliers.id, Number(id))).get()
  )
  .post("/", async ({ body, set }) => {
    // avoid duplicate supplier names
    const existing = await db.select().from(suppliers).where(sql`${suppliers.name} = ${body.name}`).get();
    if (existing) {
      set.status = 409;
      return { error: 'Supplier already exists', existing };
    }
    return db.insert(suppliers).values(body).returning().get();
  }, {
    body: t.Object({
      name: t.String(),
      contact: t.Optional(t.String()),
      address: t.Optional(t.String()),
      openingBalance: t.Optional(t.Number())
    })
  })
  .put("/:id", ({ params: { id }, body }) => {
    return db.update(suppliers).set(body).where(eq(suppliers.id, Number(id))).returning().get();
  })
  .delete("/:id", ({ params: { id } }) => {
    return db.delete(suppliers).where(eq(suppliers.id, Number(id))).returning().get();
  });