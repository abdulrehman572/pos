import { Elysia, t } from "elysia";
import { db } from "../db";
import { customerPayments, supplierPayments, customers, suppliers } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const paymentsRoutes = new Elysia({ prefix: "/payments" })
  .post("/customer", async ({ body }) => {
    const { customerId, amount, date, note } = body;
    const payment = await db.insert(customerPayments).values({
      customerId, amount, date: date || new Date().toISOString(), note
    }).returning().get();
    // Recalculate customer balance
    await db.update(customers).set({
      balance: sql`(SELECT COALESCE(SUM(s.total),0) - COALESCE(SUM(cp.amount),0) 
                   FROM sales s LEFT JOIN customer_payments cp ON s.customer_id = cp.customer_id 
                   WHERE s.customer_id = ${customerId})`
    }).where(eq(customers.id, customerId));
    return payment;
  }, {
    body: t.Object({
      customerId: t.Number(),
      amount: t.Number(),
      date: t.Optional(t.String()),
      note: t.Optional(t.String())
    })
  })
  .post("/supplier", async ({ body }) => {
    const { supplierId, amount, date, note } = body;
    const payment = await db.insert(supplierPayments).values({
      supplierId, amount, date: date || new Date().toISOString(), note
    }).returning().get();
    await db.update(suppliers).set({
      balance: sql`(SELECT COALESCE(SUM(p.total),0) - COALESCE(SUM(sp.amount),0) 
                   FROM purchases p LEFT JOIN supplier_payments sp ON p.supplier_id = sp.supplier_id 
                   WHERE p.supplier_id = ${supplierId})`
    }).where(eq(suppliers.id, supplierId));
    return payment;
  })
  .get("/customer/:customerId/ledger", ({ params: { customerId } }) => {
    return db.select().from(customerPayments).where(eq(customerPayments.customerId, Number(customerId)));
  })
  .get("/supplier/:supplierId/ledger", ({ params: { supplierId } }) => {
    return db.select().from(supplierPayments).where(eq(supplierPayments.supplierId, Number(supplierId)));
  });