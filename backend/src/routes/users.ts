import { Elysia, t } from "elysia";
import { db } from "../db";
import { users, permissions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .get("/", async ({ request, set }) => {
    // Middleware: check role admin (we'll implement a separate middleware)
    const all = await db.select().from(users);
    return all;
  })
  .post("/", async ({ body }) => {
    const { username, password, fullName, phone, role } = body;
    const hash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({ username, password_hash: hash, fullName, phone, role }).returning();
    // Assign default permissions: allow all pages for new user (admin can later modify)
    const defaultPages = ['dashboard','billing','purchase','khata','products','analytics','payments','jazzcash','settings'];
    for (const page of defaultPages) {
      await db.insert(permissions).values({ userId: newUser.id, pageKey: page, allowed: 1 });
    }
    return newUser;
  }, {
    body: t.Object({ username: t.String(), password: t.String(), fullName: t.String(), phone: t.Optional(t.String()), role: t.String() })
  })
  .put("/:id", async ({ params: { id }, body }) => {
    const { fullName, phone, role, password } = body;
    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);
    await db.update(users).set(updateData).where(eq(users.id, Number(id)));
    return { success: true };
  })
  .delete("/:id", async ({ params: { id } }) => {
    await db.delete(users).where(eq(users.id, Number(id)));
    await db.delete(permissions).where(eq(permissions.userId, Number(id)));
    return { success: true };
  });