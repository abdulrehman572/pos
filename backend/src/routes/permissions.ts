import { Elysia, t } from "elysia";
import { db } from "../db";
import { permissions } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const permissionsRoutes = new Elysia({ prefix: "/api/permissions" })
  .get("/:userId", async ({ params: { userId } }) => {
    const perms = await db.select().from(permissions).where(eq(permissions.userId, Number(userId)));
    return perms;
  })
  .post("/:userId", async ({ params: { userId }, body }) => {
    const { pageKey, allowed } = body;
    const existing = await db.select().from(permissions).where(and(eq(permissions.userId, Number(userId)), eq(permissions.pageKey, pageKey))).get();
    if (existing) {
      await db.update(permissions).set({ allowed }).where(and(eq(permissions.userId, Number(userId)), eq(permissions.pageKey, pageKey)));
    } else {
      await db.insert(permissions).values({ userId: Number(userId), pageKey, allowed });
    }
    return { success: true };
  }, {
    body: t.Object({ pageKey: t.String(), allowed: t.Number() })
  });