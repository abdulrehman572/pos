import { Elysia, t } from "elysia";
import { db } from "../db";
import { jazzcashTransactions, jazzcashSettings, jazzcashProfit, cashMovements } from "../db/schema";
import { eq } from "drizzle-orm";

export const jazzcashRoutes = new Elysia({ prefix: "/api/jazzcash" })
  .get("/settings", async () => {
    let settings = await db.select().from(jazzcashSettings).get();
    if (!settings) {
      await db.insert(jazzcashSettings).values({ sendFeePercent: 0, receiveFeePercent: 0 });
      settings = { sendFeePercent: 0, receiveFeePercent: 0 };
    }
    return settings;
  })
  .put("/settings", async ({ body }) => {
    const { sendFeePercent, receiveFeePercent } = body;
    await db.update(jazzcashSettings).set({ sendFeePercent, receiveFeePercent }).where(eq(jazzcashSettings.id, 1));
    return { success: true };
  }, { body: t.Object({ sendFeePercent: t.Number(), receiveFeePercent: t.Number() }) })
  .post("/transaction", async ({ body }) => {
    const { type, amount, note } = body;
    const settings = await db.select().from(jazzcashSettings).get();
    let fee = 0;
    let netAmount = amount;
    if (type === "sent") {
      fee = (amount * (settings?.sendFeePercent || 0)) / 100;
      netAmount = amount + fee;
    } else if (type === "received") {
      fee = (amount * (settings?.receiveFeePercent || 0)) / 100;
      netAmount = amount - fee;
    }
    // Insert transaction
    await db.insert(jazzcashTransactions).values({ type, amount: netAmount, note, date: new Date().toISOString() });
    if (fee > 0) {
      await db.insert(jazzcashProfit).values({ amount: fee, date: new Date().toISOString(), note: `${type} fee` });
    }
    if (type === "sent") {
      await db.insert(cashMovements).values({ type: "jazzcash_sent", amount: netAmount });
    }
    return { success: true, fee };
  }, { body: t.Object({ type: t.String(), amount: t.Number(), note: t.Optional(t.String()) }) })
  .get("/profit", async () => {
    const total = await db.select({ total: sql<number>`SUM(amount)` }).from(jazzcashProfit).get();
    return { profit: total?.total || 0 };
  });