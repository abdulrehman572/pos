import { Elysia, t } from "elysia";
import { db, sqlite } from "../db";
import { sales, saleItems, products, customers } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { eventBus } from "../index";

export const salesRoutes = new Elysia({ prefix: "/sales" })
  .get("/", () => db.select().from(sales))

  .get("/:id", ({ params: { id } }) =>
    db.select().from(sales).where(eq(sales.id, Number(id))).get()
  )

  .post("/", async ({ body }) => {
    const { customerId, items, paymentMethod, discount = 0, note } = body;

    // Begin transaction
    return await sqlite.transaction(async (tx) => {
      // Calculate totals
      let subtotal = 0;
      for (const item of items) {
        const product = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get();
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
        subtotal += product.sellingPrice * item.quantity;
      }
      const total = subtotal - discount;

      // Insert sale record
      const [sale] = await tx
        .insert(sales)
        .values({
          customerId: customerId || null,
          subtotal,
          discount,
          total,
          paymentMethod,
          note,
        })
        .returning();

      // Insert sale items and update stock
      for (const item of items) {
        const product = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get();
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          total: product.sellingPrice * item.quantity,
        });
        // Reduce stock
        const newStock = product.stock - item.quantity;
        await tx
          .update(products)
          .set({ stock: newStock, updatedAt: new Date().toISOString() })
          .where(eq(products.id, item.productId));

        // 🔔 Emit SSE event for stock change
        eventBus.emit("update", {
          type: "stock_change",
          productId: item.productId,
          newStock,
          productName: product.name,
        });

        // 🔔 Emit low stock alert if threshold crossed
        if (newStock <= product.lowStockThreshold) {
          eventBus.emit("update", {
            type: "low_stock",
            productId: item.productId,
            productName: product.name,
            stock: newStock,
            threshold: product.lowStockThreshold,
          });
        }
      }

      // Update customer balance if customer exists
      if (customerId) {
        // Assuming balance = total sales - payments
        await tx
          .update(customers)
          .set({
            balance: sql`(SELECT COALESCE(SUM(total),0) - COALESCE(SUM(amount),0) 
                         FROM sales s LEFT JOIN customer_payments cp ON s.customer_id = cp.customer_id 
                         WHERE s.customer_id = ${customerId})`,
          })
          .where(eq(customers.id, customerId));
      }

      // Emit new sale event for dashboard
      eventBus.emit("update", {
        type: "new_sale",
        saleId: sale.id,
        total,
        timestamp: new Date().toISOString(),
      });

      return sale;
    });
  }, {
    body: t.Object({
      customerId: t.Optional(t.Number()),
      items: t.Array(
        t.Object({
          productId: t.Number(),
          quantity: t.Number(),
        })
      ),
      paymentMethod: t.String(),
      discount: t.Optional(t.Number()),
      note: t.Optional(t.String()),
    }),
  });