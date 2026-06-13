import { Elysia, t } from "elysia";
import { db } from "../db";
import { customers, sales, customerPayments } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const customersRoutes = new Elysia({ prefix: "/api/customers" })
  // GET all customers (paginated)
  .get("/", async ({ query: { page = "1", limit = "20" } }) => {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const items = await db.select()
      .from(customers)
      .limit(parseInt(limit))
      .offset(offset)
      .all();
    const total = await db.select({ count: sql<number>`count(*)` }).from(customers).get();
    return { data: items, total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) };
  })

  // GET single customer
  .get("/:id", async ({ params: { id }, set }) => {
    const customer = await db.select().from(customers).where(eq(customers.id, Number(id))).get();
    if (!customer) {
      set.status = 404;
      return { error: "Customer not found" };
    }
    return customer;
  })

  // POST create customer
  .post("/", async ({ body, set }) => {
    // Prevent duplicate by phone if provided
    if (body.phone) {
      const existing = await db.select().from(customers).where(sql`${customers.phone} = ${body.phone}`).get();
      if (existing) {
        set.status = 409;
        return { error: 'Customer with this phone already exists', existing };
      }
    }
    const [newCustomer] = await db.insert(customers).values(body).returning().all();
    set.status = 201;
    return newCustomer;
  }, {
    body: t.Object({
      name: t.String(),
      phone: t.Optional(t.String()),
      address: t.Optional(t.String()),
      balance: t.Optional(t.Number()),
    }),
  })

  // PUT update customer
  .put("/:id", async ({ params: { id }, body, set }) => {
    const updated = await db.update(customers)
      .set(body)
      .where(eq(customers.id, Number(id)))
      .returning()
      .get();
    if (!updated) {
      set.status = 404;
      return { error: "Customer not found" };
    }
    return updated;
  })

  // DELETE customer (only if balance zero)
  .delete("/:id", async ({ params: { id }, set }) => {
    const customer = await db.select().from(customers).where(eq(customers.id, Number(id))).get();
    if (!customer) {
      set.status = 404;
      return { error: "Customer not found" };
    }
    if (customer.balance !== 0) {
      set.status = 400;
      return { error: "Cannot delete customer with outstanding balance" };
    }
    await db.delete(customers).where(eq(customers.id, Number(id))).run();
    return { success: true };
  })

  // GET ledger (all sales + payments) for a customer
  .get("/:id/ledger", async ({ params: { id }, set }) => {
    const customer = await db.select().from(customers).where(eq(customers.id, Number(id))).get();
    if (!customer) {
      set.status = 404;
      return { error: "Customer not found" };
    }
    // Get sales
    const salesList = await db.select({
      date: sales.date,
      type: sql<string>`'sale'`,
      amount: sales.total,
      paid: sales.amountPaid,
      due: sql<number>`${sales.total} - ${sales.amountPaid}`,
      description: sql<string>`'Sale #' || ${sales.id}`,
    }).from(sales).where(eq(sales.customerId, Number(id))).all();

    // Get payments
    const paymentsList = await db.select({
      date: customerPayments.date,
      type: sql<string>`'payment'`,
      amount: customerPayments.amount,
      paid: sql<number>`0`,
      due: sql<number>`0`,
      description: customerPayments.note,
    }).from(customerPayments).where(eq(customerPayments.customerId, Number(id))).all();

    // Combine and sort by date
    const ledger = [...salesList, ...paymentsList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { customer: customer.name, ledger };
  });