import { Elysia, t } from "elysia";
import { db, sqlite } from "../db";
import { purchases, purchaseItems, products, suppliers } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { eventBus } from "../index";

export const purchasesRoutes = new Elysia({ prefix: "/api/purchases" })
  .get("/", () => db.select().from(purchases))

  .get("/:id", ({ params: { id } }) =>
    db.select().from(purchases).where(eq(purchases.id, Number(id))).get()
  )

  .post("/", async ({ body }) => {
    const { supplierId, items, note } = body;

    return await sqlite.transaction(async (tx) => {
      // Calculate total
      let total = 0;
      for (const item of items) {
        const product = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get();
        if (!product) throw new Error(`Product ${item.productId} not found`);
        total += item.purchasePrice * item.quantity;
      }

      // Determine next invoice number (start from 1 on fresh installs)
      const maxRow = await tx.select({ maxInvoice: sql<number>`COALESCE(MAX(${purchases.invoiceNo}), 0)` }).from(purchases).get();
      const nextInvoice = (maxRow?.maxInvoice || 0) + 1;

      // Insert purchase record (include generated invoice number)
      const [purchase] = await tx
        .insert(purchases)
        .values({ supplierId, total, note, invoiceNo: nextInvoice })
        .returning();

      // Insert purchase items and update stock & purchase price
      for (const item of items) {
        const product = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get();
        await tx.insert(purchaseItems).values({
          purchaseId: purchase.id,
          productId: item.productId,
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          total: item.purchasePrice * item.quantity,
        });
        // Increase stock
        const newStock = product.stock + item.quantity;
        // Optionally update product's purchase price (if using FIFO or latest)
        await tx
          .update(products)
          .set({
            stock: newStock,
            purchasePrice: item.purchasePrice, // update to latest purchase price
            updatedAt: new Date().toISOString(),
          })
          .where(eq(products.id, item.productId));

        // 🔔 Emit SSE event for stock change
        eventBus.emit("update", {
          type: "stock_change",
          productId: item.productId,
          newStock,
          productName: product.name,
        });
      }

      // Update supplier balance
      await tx
        .update(suppliers)
        .set({
          balance: sql`(SELECT COALESCE(SUM(total),0) - COALESCE(SUM(amount),0) 
                       FROM purchases p LEFT JOIN supplier_payments sp ON p.supplier_id = sp.supplier_id 
                       WHERE p.supplier_id = ${supplierId})`,
        })
        .where(eq(suppliers.id, supplierId));

      // Emit purchase event (useful for stock reports)
      eventBus.emit("update", {
        type: "new_purchase",
        purchaseId: purchase.id,
        total,
        timestamp: new Date().toISOString(),
      });

      return purchase;
    });
  }, {
    body: t.Object({
      supplierId: t.Number(),
      items: t.Array(
        t.Object({
          productId: t.Number(),
          quantity: t.Number(),
          purchasePrice: t.Number(),
        })
      ),
      note: t.Optional(t.String()),
    }),
  });