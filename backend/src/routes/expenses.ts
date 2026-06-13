import { Elysia, t } from "elysia";
import { db } from "../db";
import { expenses } from "../db/schema";
import { eq } from "drizzle-orm";

export const expensesRoutes = new Elysia({ prefix: "/api/expenses" })
  .get("/", () => db.select().from(expenses))
  .post("/", ({ body }) => {
    return db.insert(expenses).values(body).returning().get();
  }, {
    body: t.Object({
      description: t.String(),
      amount: t.Number(),
      date: t.Optional(t.String()),
      category: t.Optional(t.String())
    })
  })
  .delete("/:id", ({ params: { id } }) => {
    return db.delete(expenses).where(eq(expenses.id, Number(id))).returning().get();
  });