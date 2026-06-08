import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .use(jwt({ name: "jwt", secret: process.env.JWT_SECRET || "your-secret-key" }))
  .post("/login", async ({ body, jwt, set }) => {
    const { username, password } = body;
    const user = await db.select().from(users).where(eq(users.username, username)).get();
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }
    const token = await jwt.sign({ id: user.id, role: user.role });
    return { token, user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, photoBase64: user.photoBase64 } };
  }, {
    body: t.Object({ username: t.String(), password: t.String() })
  })
  .post("/register", async ({ body, jwt, set }) => {
    // Only admin can register new users (we'll enforce via middleware)
    const { username, password, fullName, phone, role } = body;
    const existing = await db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      set.status = 400;
      return { error: "Username already exists" };
    }
    const hash = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      username, password_hash: hash, fullName, phone, role: role || "seller"
    }).returning();
    const token = await jwt.sign({ id: newUser.id, role: newUser.role });
    return { token, user: { id: newUser.id, username, fullName, role: newUser.role } };
  }, {
    body: t.Object({ username: t.String(), password: t.String(), fullName: t.String(), phone: t.Optional(t.String()), role: t.Optional(t.String()) })
  })
  .get("/profile", async ({ jwt, request, set }) => {
    const auth = request.headers.get("authorization");
    if (!auth) { set.status = 401; return { error: "No token" }; }
    const token = auth.split(" ")[1];
    const payload = await jwt.verify(token);
    if (!payload) { set.status = 401; return { error: "Invalid token" }; }
    const user = await db.select().from(users).where(eq(users.id, payload.id)).get();
    if (!user) { set.status = 404; return { error: "User not found" }; }
    return { id: user.id, username: user.username, fullName: user.fullName, phone: user.phone, role: user.role, photoBase64: user.photoBase64 };
  })
  .put("/profile", async ({ jwt, request, set, body }) => {
    const auth = request.headers.get("authorization");
    if (!auth) { set.status = 401; return { error: "No token" }; }
    const token = auth.split(" ")[1];
    const payload = await jwt.verify(token);
    if (!payload) { set.status = 401; return { error: "Invalid token" }; }
    const { fullName, phone, photoBase64, newPassword } = body;
    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (phone) updateData.phone = phone;
    if (photoBase64) updateData.photoBase64 = photoBase64;
    if (newPassword) updateData.password_hash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set(updateData).where(eq(users.id, payload.id));
    return { success: true };
  }, {
    body: t.Object({ fullName: t.Optional(t.String()), phone: t.Optional(t.String()), photoBase64: t.Optional(t.String()), newPassword: t.Optional(t.String()) })
  });